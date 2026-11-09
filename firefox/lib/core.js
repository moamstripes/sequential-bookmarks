// Browser-facing logic, identical in both browsers: remembers the ticked folders, spots an
// "Open all in tabs" on one of them, then reopens its bookmarks one after another.
// Call SequentialCore.init() once, synchronously, at the top level of the background script.
(function (root) {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const S = root.SequentialBookmarks;

  const RUNNING_KEY = "runningSequences"; // storage.session: so a sequence survives the background script unloading
  const KEEP_ALIVE_MS = 20000;

  async function getTicked() {
    const stored = await api.storage.local.get(S.TICKED_KEY);
    return stored[S.TICKED_KEY] || [];
  }

  async function setTicked(folderId, ticked) {
    const ids = new Set(await getTicked());
    if (ticked) ids.add(folderId);
    else ids.delete(folderId);
    await api.storage.local.set({ [S.TICKED_KEY]: [...ids] });
  }

  async function getFolderSettings(folderId) {
    const stored = await api.storage.local.get(S.SETTINGS_KEY);
    return S.normaliseFolderSettings((stored[S.SETTINGS_KEY] || {})[folderId]);
  }

  // The bookmarks of every ticked folder, cached until a bookmark or the ticked set changes. The cache is
  // refilled straight away, so a burst finds it ready instead of waiting on a storage read (which can stall).
  let foldersPromise = null;

  async function loadFolders() {
    const folders = [];
    for (const id of await getTicked()) {
      try {
        const children = await api.bookmarks.getChildren(id);
        folders.push({ id, items: children.filter((b) => b.url).map((b) => ({ id: b.id, url: b.url })) });
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
    folders();
  }

  // Tabs the extension opened itself, so they are never mistaken for the start of a new burst. A tab can
  // start navigating before its id is known, so the URL being opened is also remembered for a moment.
  const ownTabs = new Set();
  const ownUrls = new Map(); // normalised URL -> time until which a navigation to it is ours
  const OWN_URL_MS = 3000;

  // When each recent tab was created. Tab events and navigation events reach the extension on different
  // channels, so their order cannot be relied on: a burst is judged afterwards from what was collected.
  const createdAt = new Map();

  // Tabs being followed while a sequence waits for them: tabId -> { replaced(newId), gone() }. Another
  // extension may replace a tab with a new one (Multi-Account Containers does), so what a step follows
  // is "the tab for this bookmark". Only one tab per sequence is followed, so pairing by order is safe.
  const watchers = new Map();
  const lineage = S.createLineage(S.SUCCESSOR_WINDOW_MS);

  function adopt(oldId, newId) {
    const watcher = watchers.get(oldId);
    if (!watcher) return;
    watchers.delete(oldId);
    watchers.set(newId, watcher);
    watcher.replaced(newId);
  }

  function onTabCreated(tab) {
    const now = Date.now();
    createdAt.set(tab.id, now);
    for (const [id, at] of createdAt) if (now - at > S.BURST_MAX_MS + S.BURST_LOOKBACK_MS) createdAt.delete(id);
    burstActivity();
    const pair = lineage.created(tab.id, now);
    if (pair) adopt(pair.from, pair.to);
  }

  function onTabRemoved(tabId) {
    burstActivity();
    const pair = lineage.removed(tabId, Date.now(), (id) => watchers.has(id));
    if (pair) {
      adopt(pair.from, pair.to);
    } else if (watchers.has(tabId)) {
      // No replacement may follow, so after a short wait the tab counts as closed.
      setTimeout(() => {
        const watcher = watchers.get(tabId);
        if (!watcher) return;
        watchers.delete(tabId);
        watcher.gone();
      }, S.SUCCESSOR_WINDOW_MS + 100);
    }
  }

  // A burst is the tabs that started navigating to bookmarks of a ticked folder at about the same moment.
  // A tab counts when it heads for a bookmark or for a redirect URL wrapped around one. Some tabs are never
  // reported (another extension can cancel and remove them first), so what they were replaced by counts too.
  let burst = null; // { members: Map(tabId -> URL), startedAt }
  let burstTimer = null;

  function burstActivity() {
    if (!burst) return;
    clearTimeout(burstTimer);
    const remaining = Math.max(0, S.BURST_MAX_MS - (Date.now() - burst.startedAt));
    burstTimer = setTimeout(endBurst, Math.min(S.BURST_QUIET_MS, remaining));
  }

  async function noteNavigation(tabId, url) {
    const key = S.normaliseUrl(url);
    const isOwn = () => ownTabs.has(tabId) || (ownUrls.get(key) || 0) > Date.now() || (burst && burst.members.has(tabId));
    if (isOwn()) return;
    if (!(await folders()).some((f) => f.items.some((i) => S.supportsBookmark(url, i.url)))) return;
    if (isOwn()) return;
    if (!burst) burst = { members: new Map(), startedAt: Date.now() };
    burst.members.set(tabId, url);
    burstActivity();
  }

  async function endBurst() {
    const finished = burst;
    burst = null;
    const plan = S.planSequence([...finished.members.values()].map((url) => ({ url })), await folders());
    if (!plan) return;

    // Everything the open produced goes: the tabs that navigated to a bookmark, and the tabs created around
    // then that are still blank or on a bookmark (a replacement made by another extension). The bookmarks
    // are then put back one at a time, where the first tab was.
    const keys = S.burstKeys(plan.items);
    const since = finished.startedAt - S.BURST_LOOKBACK_MS;
    const candidates = new Set(finished.members.keys());
    for (const [id, at] of createdAt) if (at >= since && !ownTabs.has(id)) candidates.add(id);
    const tabs = (await Promise.all([...candidates].map((id) => api.tabs.get(id).catch(() => null))))
      .filter(Boolean)
      .filter((tab) => finished.members.has(tab.id) || S.belongsToBurst(tab.url, keys));

    let windowId;
    let index;
    if (tabs.length) {
      windowId = tabs[0].windowId;
      index = Math.min(...tabs.filter((t) => t.windowId === windowId).map((t) => t.index));
      await api.tabs.remove(tabs.map((t) => t.id)).catch(() => {});
    } else {
      const [active] = await api.tabs.query({ active: true, lastFocusedWindow: true });
      windowId = active && active.windowId;
    }

    const settings = await getFolderSettings(plan.folderId);
    await startSequence({
      items: plan.items,
      waitSeconds: settings.waitSeconds,
      closeBookmarkIds: settings.closeBookmarkIds,
      windowId,
      index,
      next: 0, // the bookmark to open next
      current: null, // the tab being waited for
      tabIds: [], // the tab of each bookmark opened so far
      allLoaded: true,
      waitUntil: null, // when the pause before the next bookmark ends
    });
  }

  const running = new Set();
  let keepAlive = null;

  function saveRunning() {
    return api.storage.session.set({ [RUNNING_KEY]: [...running] });
  }

  async function startSequence(sequence) {
    running.add(sequence);
    // An API call now and then stops the browser unloading the background script during a long wait.
    if (!keepAlive) keepAlive = setInterval(() => api.storage.session.get(RUNNING_KEY), KEEP_ALIVE_MS);
    await saveRunning();
    try {
      await runSequence(sequence);
    } finally {
      running.delete(sequence);
      if (!running.size) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
      await saveRunning();
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Resolves "loaded", "timeout" or "closed" for the tab in sequence.current, following it if it is replaced.
  // Loaded means complete on a real page and staying complete for SETTLE_MS (no further redirect started).
  // The tab is being followed as soon as this is called, so call it right after the tab is created.
  function waitForLoaded(sequence) {
    return new Promise((resolve) => {
      let tabId = sequence.current;
      const position = sequence.next;
      let settleTimer = null;
      const isLoaded = (tab) => tab.status === "complete" && tab.url && tab.url !== "about:blank";
      const finish = (result) => {
        clearTimeout(loadTimer);
        clearTimeout(settleTimer);
        watchers.delete(tabId);
        api.tabs.onUpdated.removeListener(onUpdated);
        resolve(result);
      };
      const check = (tab) => {
        if (isLoaded(tab)) {
          if (!settleTimer) settleTimer = setTimeout(() => finish("loaded"), S.SETTLE_MS);
        } else {
          clearTimeout(settleTimer);
          settleTimer = null;
        }
      };
      const onUpdated = (id, change, tab) => {
        if (id === tabId) check(tab);
      };
      const loadTimer = setTimeout(() => finish("timeout"), S.LOAD_TIMEOUT_MS);
      watchers.set(tabId, {
        replaced: (newId) => {
          tabId = newId;
          sequence.current = newId;
          sequence.tabIds[position] = newId;
          ownTabs.add(newId);
          clearTimeout(settleTimer);
          settleTimer = null;
          api.tabs.get(newId).then(check, () => {});
          saveRunning();
        },
        gone: () => finish("closed"),
      });
      api.tabs.onUpdated.addListener(onUpdated);
      api.tabs.get(tabId).then(check, () => finish("closed"));
    });
  }

  // Opens the next bookmark and sets sequence.current. Nothing is awaited after the tab exists, so the caller
  // can start following it straight away.
  async function openNext(sequence) {
    const item = sequence.items[sequence.next];
    const props = { url: item.url, active: sequence.next === 0 };
    if (sequence.windowId !== undefined) props.windowId = sequence.windowId;
    if (sequence.next === 0) {
      if (sequence.index !== undefined) props.index = sequence.index;
    } else {
      try {
        const previous = await api.tabs.get(sequence.tabIds[sequence.next - 1]);
        props.windowId = previous.windowId;
        props.index = previous.index + 1;
      } catch (e) {
        // The previous tab was closed, so the next one goes at the end of the window.
      }
    }
    ownUrls.set(S.normaliseUrl(item.url), Date.now() + OWN_URL_MS);
    const tab = await api.tabs.create(props);
    ownTabs.add(tab.id);
    sequence.tabIds[sequence.next] = tab.id;
    sequence.current = tab.id;
    sequence.windowId = tab.windowId;
  }

  async function runSequence(sequence) {
    while (sequence.next < sequence.items.length) {
      if (sequence.current === null) {
        if (sequence.waitUntil) {
          await sleep(Math.max(0, sequence.waitUntil - Date.now()));
          sequence.waitUntil = null;
        }
        try {
          await openNext(sequence);
        } catch (e) {
          sequence.allLoaded = false;
          break; // the window was closed
        }
      }
      const waiting = waitForLoaded(sequence);
      await saveRunning();
      if ((await waiting) !== "loaded") sequence.allLoaded = false;
      sequence.next += 1;
      sequence.current = null;
      if (sequence.next < sequence.items.length && sequence.waitSeconds > 0) {
        sequence.waitUntil = Date.now() + sequence.waitSeconds * 1000;
      }
      await saveRunning();
    }
    const toClose = S.closeTabIds(sequence.items, sequence.closeBookmarkIds, sequence.tabIds, sequence.allLoaded);
    if (toClose.length) await api.tabs.remove(toClose).catch(() => {});
  }

  // After the background script was unloaded mid-sequence, carry on where it stopped.
  async function resume() {
    const stored = await api.storage.session.get(RUNNING_KEY);
    for (const sequence of stored[RUNNING_KEY] || []) {
      if (sequence.next < sequence.items.length) startSequence(sequence);
    }
  }

  function init() {
    api.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0) noteNavigation(details.tabId, details.url);
    });
    api.tabs.onUpdated.addListener((tabId, change) => {
      if (change.url) noteNavigation(tabId, change.url);
    });
    api.tabs.onCreated.addListener(onTabCreated);
    api.tabs.onRemoved.addListener(onTabRemoved);
    for (const event of ["onCreated", "onRemoved", "onChanged", "onMoved"]) {
      api.bookmarks[event].addListener(invalidateFolders);
    }
    api.storage.onChanged.addListener((changes, area) => area === "local" && changes[S.TICKED_KEY] && invalidateFolders());
    folders();
    resume();
  }

  root.SequentialCore = { init, getTicked, setTicked };
})(globalThis);
