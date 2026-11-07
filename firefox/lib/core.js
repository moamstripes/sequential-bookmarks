// Browser-facing logic, identical in both browsers: remembers the ticked folders, spots an
// "Open all in tabs" on one of them and then reloads its bookmarks one after another.
// Call SequentialCore.init() once, synchronously, at the top level of the background script.
(function (root) {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const { BURST_QUIET_MS, LOAD_TIMEOUT_MS, normaliseUrl, planSequence } = root.SequentialBookmarks;

  const TICKED_KEY = "tickedFolders"; // storage.local: ids of the ticked bookmark folders
  const RUNNING_KEY = "runningSequences"; // storage.session: so a sequence survives the background script unloading

  async function getTicked() {
    const stored = await api.storage.local.get(TICKED_KEY);
    return stored[TICKED_KEY] || [];
  }

  async function setTicked(folderId, ticked) {
    const ids = new Set(await getTicked());
    if (ticked) ids.add(folderId);
    else ids.delete(folderId);
    await api.storage.local.set({ [TICKED_KEY]: [...ids] });
  }

  // The URLs of every ticked folder, cached until a bookmark or the ticked set changes.
  let foldersPromise = null;

  async function loadFolders() {
    const folders = [];
    for (const id of await getTicked()) {
      try {
        const children = await api.bookmarks.getChildren(id);
        folders.push({ id, urls: children.filter((b) => b.url).map((b) => b.url) });
      } catch (e) {
        // The folder was deleted, so there is nothing to load.
      }
    }
    return folders;
  }

  function folders() {
    if (!foldersPromise) foldersPromise = loadFolders();
    return foldersPromise;
  }

  function invalidateFolders() {
    foldersPromise = null;
  }

  // Tabs the extension opened or kept itself, so they are never mistaken for a new burst.
  const ownTabs = new Set();
  let burst = new Map(); // tabId -> url, tabs that just landed on a bookmark of a ticked folder
  let burstTimer = null;

  async function noteTab(tabId, url) {
    if (!url || ownTabs.has(tabId) || burst.has(tabId)) return;
    const key = normaliseUrl(url);
    if (!(await folders()).some((f) => f.urls.some((u) => normaliseUrl(u) === key))) return;
    burst.set(tabId, url);
    clearTimeout(burstTimer);
    burstTimer = setTimeout(endBurst, BURST_QUIET_MS);
  }

  async function endBurst() {
    const entries = [...burst].map(([tabId, url]) => ({ tabId, url }));
    burst = new Map();
    const plan = planSequence(entries, await folders());
    if (!plan) return;

    ownTabs.add(plan.keepTabId);
    plan.closeTabIds.forEach((id) => ownTabs.add(id));
    let kept;
    try {
      kept = await api.tabs.get(plan.keepTabId);
      await api.tabs.remove(plan.closeTabIds);
    } catch (e) {
      return; // the user closed the tabs already
    }
    await startSequence({ tabId: kept.id, windowId: kept.windowId, remaining: plan.remainingUrls });
  }

  const running = new Set();

  function saveRunning() {
    return api.storage.session.set({ [RUNNING_KEY]: [...running] });
  }

  async function startSequence(sequence) {
    running.add(sequence);
    await saveRunning();
    await runSequence(sequence);
    running.delete(sequence);
    await saveRunning();
  }

  // Resolves once the tab has loaded, was closed, or took too long.
  function waitForLoad(tabId) {
    return new Promise((resolve) => {
      const isLoaded = (tab) => tab.status === "complete" && tab.url && tab.url !== "about:blank";
      const finish = () => {
        clearTimeout(timer);
        api.tabs.onUpdated.removeListener(onUpdated);
        api.tabs.onRemoved.removeListener(onRemoved);
        resolve();
      };
      const onUpdated = (id, change, tab) => {
        if (id === tabId && isLoaded(tab)) finish();
      };
      const onRemoved = (id) => {
        if (id === tabId) finish();
      };
      const timer = setTimeout(finish, LOAD_TIMEOUT_MS);
      api.tabs.onUpdated.addListener(onUpdated);
      api.tabs.onRemoved.addListener(onRemoved);
      api.tabs.get(tabId).then((tab) => {
        if (isLoaded(tab)) finish();
      }, finish);
    });
  }

  async function runSequence(sequence) {
    while (sequence.remaining.length) {
      await waitForLoad(sequence.tabId);
      const url = sequence.remaining.shift();
      const props = { url, active: false, windowId: sequence.windowId };
      try {
        const previous = await api.tabs.get(sequence.tabId);
        props.windowId = previous.windowId;
        props.index = previous.index + 1;
      } catch (e) {
        // The previous tab was closed, so the next one goes at the end of the window.
      }
      try {
        const tab = await api.tabs.create(props);
        ownTabs.add(tab.id);
        sequence.tabId = tab.id;
        sequence.windowId = tab.windowId;
        await saveRunning();
      } catch (e) {
        return; // the window was closed
      }
    }
  }

  // After the background script was unloaded mid-sequence, carry on where it stopped.
  async function resume() {
    const stored = await api.storage.session.get(RUNNING_KEY);
    for (const sequence of stored[RUNNING_KEY] || []) {
      if (sequence.remaining.length) startSequence(sequence);
    }
  }

  function init() {
    api.tabs.onCreated.addListener((tab) => noteTab(tab.id, tab.url || tab.pendingUrl));
    api.tabs.onUpdated.addListener((tabId, change) => change.url && noteTab(tabId, change.url));
    for (const event of ["onCreated", "onRemoved", "onChanged", "onMoved"]) {
      api.bookmarks[event].addListener(invalidateFolders);
    }
    api.storage.onChanged.addListener((changes, area) => area === "local" && changes[TICKED_KEY] && invalidateFolders());
    resume();
  }

  root.SequentialCore = { init, getTicked, setTicked };
})(globalThis);
