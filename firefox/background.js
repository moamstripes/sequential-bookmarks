// Firefox: adds a "Load sequentially" tick to the right-click menu of a bookmark folder.
// The loading itself is in lib/core.js.
"use strict";

const MENU_ID = "load-sequentially";

SequentialCore.init();

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create({
    id: MENU_ID,
    title: "Load sequentially",
    type: "checkbox",
    contexts: ["bookmark"],
  });
});

// The same menu item is shown for bookmarks too, so hide it unless a folder was clicked.
// The menu may have closed and reopened while waiting, so only the latest instance is refreshed.
let latestMenu = 0;

browser.menus.onShown.addListener(async (info) => {
  if (!info.bookmarkId) return;
  const instance = ++latestMenu;
  const [node] = await browser.bookmarks.get(info.bookmarkId);
  const isFolder = node.type === "folder";
  const ticked = isFolder && (await SequentialCore.getTicked()).includes(node.id);
  await browser.menus.update(MENU_ID, { visible: isFolder, checked: ticked });
  if (instance === latestMenu) browser.menus.refresh();
});

browser.menus.onHidden.addListener(() => {
  latestMenu = 0;
});

browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID && info.bookmarkId) {
    SequentialCore.setTicked(info.bookmarkId, info.checked);
  }
});
