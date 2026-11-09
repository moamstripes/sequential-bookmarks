// Firefox: adds a "Load sequentially" tick and a link to the settings page to the right-click menu of a
// bookmark folder. The loading itself is in lib/core.js.
"use strict";

const MENU_ID = "load-sequentially";
const SETTINGS_ID = "sequential-settings";

SequentialCore.init();

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create({
    id: MENU_ID,
    title: "Load sequentially",
    type: "checkbox",
    contexts: ["bookmark"],
  });
  browser.menus.create({
    id: SETTINGS_ID,
    title: "Sequential Bookmarks settings",
    contexts: ["bookmark"],
  });
});

// The same menu items are shown for bookmarks too, so hide them unless a folder was clicked.
// The menu may have closed and reopened while waiting, so only the latest instance is refreshed.
let latestMenu = 0;

browser.menus.onShown.addListener(async (info) => {
  if (!info.bookmarkId) return;
  const instance = ++latestMenu;
  const [node] = await browser.bookmarks.get(info.bookmarkId);
  const isFolder = node.type === "folder";
  const ticked = isFolder && (await SequentialCore.getTicked()).includes(node.id);
  await browser.menus.update(MENU_ID, { visible: isFolder, checked: ticked });
  await browser.menus.update(SETTINGS_ID, { visible: isFolder });
  if (instance === latestMenu) browser.menus.refresh();
});

browser.menus.onHidden.addListener(() => {
  latestMenu = 0;
});

browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID && info.bookmarkId) {
    SequentialCore.setTicked(info.bookmarkId, info.checked);
  } else if (info.menuItemId === SETTINGS_ID) {
    browser.runtime.openOptionsPage();
  }
});
