// Pure logic: recognising an "Open all in tabs" on a ticked folder and planning the sequential reload.
// No browser APIs are used here so it can be unit tested.
(function (root) {
  "use strict";

  // How long no new matching tab may appear before a burst of tabs counts as finished.
  const BURST_QUIET_MS = 500;
  // The longest one bookmark may take to load before the next one starts anyway.
  const LOAD_TIMEOUT_MS = 30000;

  // Tab URLs come back normalised by the browser, bookmark URLs may not be.
  function normaliseUrl(url) {
    return String(url)
      .trim()
      .replace(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)/i, (origin) => origin.toLowerCase())
      .replace(/\/+$/, "");
  }

  // entries: tabs that just appeared on a bookmark URL, [{ tabId, url }].
  // folders: ticked folders, [{ id, urls }] with the URLs in bookmark order.
  // A burst is an "Open all" of a folder when it covers exactly that folder's URLs and there are
  // at least two of them. Returns the first matching plan, or null.
  // The first bookmark's tab is kept (it is already loading), the others are closed and reopened one by one.
  function planSequence(entries, folders) {
    const got = new Set(entries.map((e) => normaliseUrl(e.url)));
    for (const folder of folders) {
      const wanted = new Set(folder.urls.map(normaliseUrl));
      if (wanted.size < 2 || got.size !== wanted.size) continue;
      if (![...got].every((u) => wanted.has(u))) continue;
      const first = normaliseUrl(folder.urls[0]);
      const keep = entries.find((e) => normaliseUrl(e.url) === first);
      return {
        folderId: folder.id,
        keepTabId: keep.tabId,
        closeTabIds: entries.filter((e) => e !== keep).map((e) => e.tabId),
        remainingUrls: folder.urls.slice(1),
      };
    }
    return null;
  }

  root.SequentialBookmarks = { BURST_QUIET_MS, LOAD_TIMEOUT_MS, normaliseUrl, planSequence };
})(globalThis);
