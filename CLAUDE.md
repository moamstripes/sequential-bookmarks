# Sequential Bookmarks: working notes

A browser extension that loads the bookmarks of a ticked folder one after another, each only once the previous one has fully loaded, with a per-folder wait and an optional "close these tabs at the end". It exists twice, once per browser, in one repository. Private GitHub repo `moamstripes/sequential-bookmarks` (MIT licence). Overview and release steps are in `README.md`; each browser folder has its own README with install steps and a manual test checklist. It is a simpler sibling of tab-labels: no website, few tests.

## Rules for every change

- **Always change both `firefox/` and `chrome/`** when asked for an update. Say plainly if something cannot exist in Chrome.
- Nothing is committed or pushed unless asked.
- Commits use the repo-local git identity: name `moamstripes` and the GitHub noreply email. Never use the global git identity or the work email, and keep the user's full name out of files and commit messages.
- British English in all user-facing text and docs. No em dashes. Do not invent facts; if something is untested, say so.
- Everything stays local to the browser. No network use.

## Layout

```
firefox/   Manifest V3, event page, bookmark right-click menu (menus API, "bookmark" context)
chrome/    Manifest V3, service worker, toolbar popup (Chrome cannot add to the bookmark menu)
scripts/   build.sh, bump-version.sh, make-icons.py (Chrome PNGs, standard library only)
.github/workflows/release.yml   tag -> GitHub release with a zip per browser
```

Also in `firefox/`: `listing.md` (the answers for a listed submission on addons.mozilla.org, not part of the package) and `listing-screenshots/`.

Inside each browser folder: `manifest.json`, `background.js`, `lib/sequence.js` (pure logic, unit tested), `lib/core.js` (browser logic), `options/` (settings page), `icons/`, `test/`.

## How it works

`lib/core.js` listens to `webNavigation.onBeforeNavigate` and `tabs.onUpdated`. A tab heading for a bookmark of a ticked folder (the bookmark URL, or a redirect URL wrapped around it, see `supportsBookmark`) joins a "burst". When the burst has been quiet for 500 ms (3 s at most), `planSequence` checks whether it covers exactly one ticked folder's bookmarks. If so, everything the open produced is closed: the member tabs, plus tabs created in the 1.5 s before and still blank or on a bookmark (`belongsToBurst`). Then the bookmarks are opened one at a time where the first tab was (first one active), each after the previous tab is complete on a real page and has stayed complete for 1 s (`SETTLE_MS`), then `waitSeconds` more. A step gives up after 30 s, except, when the folder's `waitForLogin` is on, a bookmark in `loginBookmarkIds` that settles on a login-looking address (`looksLikeLogin`, from the host and path only, and never when the bookmark itself looks like a login): it is waited for until it settles on another page, up to `loginWaitMinutes` (1 to 60, default 2), and if that runs out the whole sequence stops (the rest is not opened, nothing is closed). When all are done and every one loaded, the tabs of the bookmarks listed in `closeBookmarkIds` are closed.

Storage (`storage.local`): `tickedFolders` (folder ids) and `folderSettings` (`{ [folderId]: { waitSeconds, closeBookmarkIds, waitForLogin, loginBookmarkIds, loginWaitMinutes } }`, defaults in `normaliseFolderSettings`: wait 0, nothing closed, login wait off). Running sequences are in `storage.session` (`runningSequences`) and resumed if the background script unloads; a 20 s keep-alive stops it unloading during a wait.

Following a replaced tab (steps only): Multi-Account Containers answers a navigation by creating a new tab and removing the old one. `createLineage` pairs the removed tab with the tab created just before (or just after) it, and `waitForLoaded` then waits for the new one.

## Shared files

`lib/sequence.js`, `lib/core.js`, `options/*`, `test/run.js` and `test/sequence.test.js` are identical in both folders (a unit test checks it). Edit one, then copy it to the other. `background.js`, `manifest.json` and `test/manifest.test.js` are per browser (the last is the same text in both).

## Commands

```
cd firefox && osascript -l JavaScript test/run.js    # unit tests (also in chrome/)
bash scripts/build.sh firefox                        # or chrome; writes dist/*.zip
bash scripts/bump-version.sh firefox 1.2.0           # edits manifest.json only
```

Node is not installed. The unit tests run on the JavaScript engine built into macOS.

## Testing in a real browser

Use throwaway profiles and delete them afterwards. The tab-labels repo's `CLAUDE.md` has the recipe: Firefox headless with `--marionette` and `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`, install with `Addon:Install`; Chrome headless with `--remote-debugging-port` and `--enable-unsafe-extension-debugging`, load with `Extensions.loadUnpacked`. Useful points found while building this:

- A local server that answers each page after a delay, and logs when each request starts and ends, shows the order and timing directly.
- Firefox: a privileged page added to a copy of the extension (not to the repo) can create bookmarks and set storage. Firefox's native open is `PlacesUIUtils.openMultipleLinksInTabs(node, event, { ownerWindow })`, run in the chrome context.
- Container bookmarks can be tested with the real add-ons: install copies of Multi-Account Containers and Container Bookmarks (temporary installs of the `.xpi` files), create a container with `contextualIdentities.create` from MAC's own `options.html`, and seed the rule with `storage.local.set({"siteContainerMap@@_www.<name>.container": { userContextId: "<id>", neverAsk: true }})` there. Create the bookmarks before installing Container Bookmarks, which opens a popup window for every new bookmark.
- A "spy" extension that logs `tabs.onCreated`, `onUpdated`, `onRemoved` and the `webNavigation` events with timestamps shows the real event order.
- A bug that shows in one run in seven needs a loop of a dozen runs, with a trace written to `storage.session`, to be seen and then to be believed fixed.
- Chrome has no scriptable "Open all", so a test creates the tabs with `chrome.tabs.create` at once.
- The right-click menu items and the popup cannot be clicked headlessly. Say so rather than claiming they were tested.

## Gotchas

- **Event order cannot be trusted.** Tab events and `webNavigation` events arrive on different channels, and Firefox may never report the original tab's navigation at all (Multi-Account Containers cancels and removes it first). So a burst is judged afterwards from what was collected, a bookmark counts as covered by any navigation to it or to a URL wrapped around it, and the burst closes tabs by "created in the window and still blank or on a bookmark", never by pairing tabs in order. The first design paired them in order and failed one run in seven.
- Pairing in order is only safe for a step, where one tab is in flight. The watcher must be registered right after `tabs.create` resolves, with nothing awaited in between.
- With Container Bookmarks the opened tab is `about:blank` and its `url` only changes when the response arrives, and the final URL has lost the `#container-name` part. The redirect URL it passes through is `http://www.<name>.container/<original URL>`.
- A freshly created Firefox tab can report `status: complete` for `about:blank` before its page starts, so "loaded" means complete, not `about:blank`, and still complete 1 s later.
- A tab can start navigating before its id is known to the extension, so `ownUrls` remembers the URL being opened for 3 s as well as `ownTabs`.
- Chrome's `chrome.storage.local.get` was seen stalling for several seconds in headless Chrome. The folder list is loaded ahead of time (`folders()` after every invalidation) so a burst does not wait on it.
- `tabs.remove([ids])` in Firefox rejects the whole call, closing nothing, if one id no longer exists (checked). Close tabs one at a time.
- The `bookmark` menu context needs the `bookmarks` permission, and the same items are shown for bookmarks and folders, so `menus.onShown` hides them for bookmarks.
- `webNavigation` is a permission that Firefox asks the user to approve again on update.
- Mozilla rejects a version number it has already signed, so each signed Firefox release needs a new version.
- A version number is used up as soon as Mozilla has signed it in either channel. Pushing a `firefox-vX.Y.Z` tag signs that version as unlisted, so never push the tag of a version that is meant for the listed channel (the first signing attempt, firefox-v1.1.1 on 11-11-2026, was refused because Mozilla already had a 1.1.1; the private build went out as 1.1.2 so that 1.2.0 stays free for the first listed submission, and 1.2.0 must not be tagged before it is approved).
