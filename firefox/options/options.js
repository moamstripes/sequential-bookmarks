// The settings page: one card per ticked folder with the wait between tabs and which bookmarks to close
// at the end. Identical in both browsers. lib/core.js reads what is saved here when a sequence starts.
"use strict";

const api = typeof browser !== "undefined" ? browser : chrome;
const { TICKED_KEY, SETTINGS_KEY, MAX_WAIT_SECONDS, normaliseFolderSettings } = SequentialBookmarks;

// Saves are queued so two quick changes cannot overwrite each other.
let saving = Promise.resolve();

function saveSettings(folderId, change) {
  saving = saving.then(async () => {
    const all = (await api.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] || {};
    all[folderId] = normaliseFolderSettings({ ...normaliseFolderSettings(all[folderId]), ...change });
    await api.storage.local.set({ [SETTINGS_KEY]: all });
    return all[folderId];
  });
  return saving;
}

async function untick(folderId) {
  const ticked = (await api.storage.local.get(TICKED_KEY))[TICKED_KEY] || [];
  await api.storage.local.set({ [TICKED_KEY]: ticked.filter((id) => id !== folderId) });
}

// Every folder by id, with its path and the bookmarks directly inside it.
function collectFolders(node, path, out) {
  for (const child of node.children || []) {
    if (child.url) continue;
    const childPath = [...path, child.title || "(untitled)"];
    out.set(child.id, { path: childPath.join(" / "), bookmarks: (child.children || []).filter((c) => c.url) });
    collectFolders(child, childPath, out);
  }
  return out;
}

function element(tag, props, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

function folderCard(folderId, folder, settings) {
  const head = element("div", { className: "folder-head" }, element("h2", { textContent: folder ? folder.path : "This folder no longer exists" }));
  const stop = element("button", { type: "button", textContent: folder ? "Stop loading this folder one by one" : "Remove" });
  stop.addEventListener("click", () => untick(folderId));
  head.append(stop);
  const card = element("section", { className: "folder" }, head);
  if (!folder) return card;

  const wait = element("input", { type: "number", min: 0, max: MAX_WAIT_SECONDS, step: 1, value: settings.waitSeconds });
  wait.addEventListener("change", async () => {
    wait.value = (await saveSettings(folderId, { waitSeconds: wait.value })).waitSeconds;
  });
  card.append(
    element("label", { className: "wait" }, "Wait between tabs", wait, "seconds"),
    element("p", { className: "hint", textContent: "Counted from the moment a page has finished loading, redirects included. 0 opens the next one straight away." })
  );

  const boxes = folder.bookmarks.map((bookmark) => {
    const box = element("input", { type: "checkbox", checked: settings.closeBookmarkIds.includes(bookmark.id) });
    box.addEventListener("change", () => {
      saveSettings(folderId, { closeBookmarkIds: boxes.filter((b) => b.input.checked).map((b) => b.id) });
    });
    return { id: bookmark.id, input: box, label: element("label", {}, box, bookmark.title || bookmark.url) };
  });
  card.append(
    element(
      "fieldset",
      {},
      element("legend", { textContent: "Close when everything has loaded" }),
      ...boxes.map((b) => b.label),
      element("p", { className: "hint", textContent: "Ticked bookmarks are closed once every bookmark in the folder has loaded. Nothing is closed if one of them failed to load." })
    )
  );
  return card;
}

async function render() {
  const [tree] = await api.bookmarks.getTree();
  const folders = collectFolders(tree, [], new Map());
  const stored = await api.storage.local.get([TICKED_KEY, SETTINGS_KEY]);
  const ticked = stored[TICKED_KEY] || [];
  const all = stored[SETTINGS_KEY] || {};
  document.getElementById("empty").hidden = ticked.length > 0;
  document.getElementById("folders").replaceChildren(...ticked.map((id) => folderCard(id, folders.get(id), normaliseFolderSettings(all[id]))));
}

api.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[TICKED_KEY]) render();
});

render();
