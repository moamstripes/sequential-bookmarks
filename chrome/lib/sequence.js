// Pure logic: recognising an "Open all in tabs" on a ticked folder, following tabs that other
// extensions replace, the per-folder settings and which tabs to close at the end.
// No browser APIs are used here so it can be unit tested.
(function (root) {
  "use strict";

  // storage.local keys.
  const TICKED_KEY = "tickedFolders"; // array of ticked folder ids
  const SETTINGS_KEY = "folderSettings"; // { [folderId]: { waitSeconds, closeBookmarkIds } }

  // How long no new tab activity may happen before a burst of tabs counts as finished, and the longest a burst may go on.
  const BURST_QUIET_MS = 500;
  const BURST_MAX_MS = 3000;
  // Tabs created this long before the first bookmark navigation still count as part of the burst.
  const BURST_LOOKBACK_MS = 1500;
  // The longest one bookmark may take to load before the sequence gives up on it.
  const LOAD_TIMEOUT_MS = 30000;
  // A page only counts as fully loaded once it has stayed "complete" this long, so redirects
  // done by the page itself (scripts, meta refresh) are waited for.
  const SETTLE_MS = 1000;
  // How close in time a tab's removal and its replacement's creation must be for them to belong together.
  const SUCCESSOR_WINDOW_MS = 500;

  const DEFAULT_WAIT_SECONDS = 0;
  const MAX_WAIT_SECONDS = 3600;

  // Tab URLs come back normalised by the browser, bookmark URLs may not be.
  function normaliseUrl(url) {
    return String(url)
      .trim()
      .replace(/^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)/i, (origin) => origin.toLowerCase())
      .replace(/\/+$/, "");
  }

  // Whether a navigation URL is for this bookmark: the bookmark URL itself, or the same URL without its
  // #fragment, or a redirect URL wrapped around that (Container Bookmarks sends the tab through
  // http://www.<container>.container/<original URL> and Multi-Account Containers reopens it from there).
  function supportsBookmark(url, bookmarkUrl) {
    const u = normaliseUrl(url);
    const b = normaliseUrl(bookmarkUrl);
    return u === b || u.endsWith(normaliseUrl(b.replace(/#.*$/, "")));
  }

  // entries: the URLs that tabs just started to navigate to for bookmarks of ticked folders, [{ url }].
  // folders: ticked folders, [{ id, items: [{ id, url }] }] with the bookmarks in order.
  // A burst is an "Open all" of a folder when every bookmark of the folder (at least two) is covered by an entry
  // and every entry is for one of its bookmarks. Not every tab of an open is always seen, so a bookmark counts
  // as covered by any entry for it, including those of the tabs that replaced the originals.
  // Returns { folderId, items } for the first matching folder, or null.
  function planSequence(entries, folders) {
    for (const folder of folders) {
      const wanted = [...new Set(folder.items.map((i) => normaliseUrl(i.url)))];
      if (wanted.length < 2) continue;
      if (!entries.every((e) => wanted.some((w) => supportsBookmark(e.url, w)))) continue;
      if (!wanted.every((w) => entries.some((e) => supportsBookmark(e.url, w)))) continue;
      return { folderId: folder.id, items: folder.items };
    }
    return null;
  }

  // The URLs a tab of an "Open all" can show: each bookmark URL without its #fragment (Container Bookmarks adds
  // "#container-name", and then redirects through a URL that contains the original one).
  function burstKeys(items) {
    return [...new Set(items.map((i) => normaliseUrl(String(i.url).replace(/#.*$/, ""))))];
  }

  // Whether a tab created during an "Open all" belongs to it: still blank, or showing (or wrapped around) one of the bookmarks.
  function belongsToBurst(tabUrl, keys) {
    if (!tabUrl || tabUrl === "about:blank") return true;
    const url = normaliseUrl(tabUrl);
    return keys.some((key) => url.includes(key));
  }

  // The settings of one folder, with anything missing or unreadable replaced by the defaults.
  function normaliseFolderSettings(raw) {
    const settings = raw && typeof raw === "object" ? raw : {};
    const wait = Math.floor(Number(settings.waitSeconds));
    const waitSeconds = Number.isFinite(wait) && wait >= 0 ? Math.min(wait, MAX_WAIT_SECONDS) : DEFAULT_WAIT_SECONDS;
    const ids = Array.isArray(settings.closeBookmarkIds) ? settings.closeBookmarkIds.filter((id) => typeof id === "string") : [];
    return { waitSeconds, closeBookmarkIds: [...new Set(ids)] };
  }

  // items: the folder's bookmarks, tabIds: the tab of each (same order, undefined when never opened).
  // Nothing is closed unless every bookmark loaded properly.
  function closeTabIds(items, closeBookmarkIds, tabIds, allLoaded) {
    if (!allLoaded) return [];
    // tabIds can come back from storage with null for a bookmark that never got a tab.
    return items.map((item, i) => (closeBookmarkIds.includes(item.id) ? tabIds[i] : null)).filter((id) => id !== null && id !== undefined);
  }

  // Some extensions (Multi-Account Containers) answer a navigation by opening a new tab and removing the
  // old one. This pairs a removed tab with the tab that replaced it. The new tab is normally created just
  // before the old one goes, but is also accepted just after.
  // isFollowed(id) says whether a tab is being tracked; tracked tabs are never taken as a successor.
  function createLineage(windowMs) {
    let recent = []; // tabs created lately and not yet claimed
    let orphans = []; // tracked tabs that were removed and are waiting for a successor
    const fresh = (list, now) => list.filter((e) => now - e.at <= windowMs);
    return {
      created(id, now) {
        orphans = fresh(orphans, now);
        if (orphans.length) return { from: orphans.shift().id, to: id };
        recent = fresh(recent, now);
        recent.push({ id, at: now });
        return null;
      },
      removed(id, now, isFollowed) {
        recent = fresh(recent, now).filter((e) => e.id !== id);
        if (!isFollowed(id)) return null;
        const i = recent.findIndex((e) => !isFollowed(e.id));
        if (i >= 0) return { from: id, to: recent.splice(i, 1)[0].id };
        orphans = fresh(orphans, now);
        orphans.push({ id, at: now });
        return null;
      },
    };
  }

  root.SequentialBookmarks = {
    TICKED_KEY,
    SETTINGS_KEY,
    BURST_QUIET_MS,
    BURST_MAX_MS,
    BURST_LOOKBACK_MS,
    LOAD_TIMEOUT_MS,
    SETTLE_MS,
    SUCCESSOR_WINDOW_MS,
    DEFAULT_WAIT_SECONDS,
    MAX_WAIT_SECONDS,
    normaliseUrl,
    supportsBookmark,
    planSequence,
    burstKeys,
    belongsToBurst,
    normaliseFolderSettings,
    closeTabIds,
    createLineage,
  };
})(globalThis);
