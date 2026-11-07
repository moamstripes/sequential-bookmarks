# Sequential Bookmarks: working notes

A browser extension that loads the bookmarks of a ticked folder one after another, each only once the previous one has finished loading. It exists twice, once per browser, in one repository. Private GitHub repo `moamstripes/sequential-bookmarks` (MIT licence). Overview and release steps are in `README.md`; each browser folder has its own README with install steps and a manual test checklist. It is a simpler sibling of tab-labels: no website, no settings page, few tests.

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

Inside each browser folder: `manifest.json`, `background.js`, `lib/sequence.js` (pure logic, unit tested), `lib/core.js` (browser logic), `icons/`, `test/`.

## How it works

`lib/core.js` listens to `tabs.onCreated` and `tabs.onUpdated`. A tab whose URL is a bookmark in a ticked folder joins a "burst". When the burst has been quiet for 500 ms, `planSequence` checks whether it is exactly one ticked folder's URLs. If so, the first bookmark's tab is kept, the others are closed, and the rest are opened in order, each after the previous tab reports `status: complete` (30 s timeout). The running sequences are kept in `storage.session` so they resume if the background script is unloaded. Ticked folder ids are in `storage.local` under `tickedFolders`.

## Shared files

`lib/sequence.js`, `lib/core.js`, `test/run.js` and `test/sequence.test.js` are identical in both folders (a unit test checks it). Edit one, then copy it to the other. `background.js`, `manifest.json` and `test/manifest.test.js` are per browser; the Firefox and Chrome copies of the last are the same.

## Commands

```
cd firefox && osascript -l JavaScript test/run.js    # unit tests (also in chrome/)
bash scripts/build.sh firefox                        # or chrome; writes dist/*.zip
bash scripts/bump-version.sh firefox 1.1.0           # edits manifest.json only
```

Node is not installed. The unit tests run on the JavaScript engine built into macOS.

## Testing in a real browser

Use throwaway profiles and delete them afterwards. The tab-labels repo's `CLAUDE.md` has the recipe: Firefox headless with `--marionette` and `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`, install with `Addon:Install`; Chrome headless with `--remote-debugging-port` and `--enable-unsafe-extension-debugging`, load with `Extensions.loadUnpacked`. Useful points found while building this:

- A local server that answers each page after a delay, and logs when each request starts and ends, shows the order and timing directly.
- Firefox: a privileged page added to a copy of the extension (not to the repo) can create bookmarks and set storage. Firefox's native open is `PlacesUIUtils.openMultipleLinksInTabs(node, event, { ownerWindow })`, run in the chrome context.
- Chrome has no scriptable "Open all", so a test creates the tabs with `chrome.tabs.create` at once.
- The right-click menu items and the popup cannot be clicked headlessly. Say so rather than claiming they were tested.

## Gotchas

- A freshly created Firefox tab can report `status: complete` for `about:blank` before its page starts, so "loaded" means complete and not `about:blank`.
- Chrome reports a new tab's URL as `pendingUrl`, and Firefox may only fill it in through `onUpdated`; `noteTab` accepts both.
- The `bookmark` menu context needs the `bookmarks` permission, and the same item is shown for bookmarks and folders, so `menus.onShown` hides it for bookmarks.
- Mozilla rejects a version number it has already signed, so each signed Firefox release needs a new version.
