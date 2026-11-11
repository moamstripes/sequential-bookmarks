# Sequential Bookmarks

A browser extension that loads the bookmarks of a folder one after another instead of all at once. The first bookmark loads, and once it has finished loading the second one opens, then the third, and so on. It can wait a number of seconds between them, and close some of the tabs again once everything has loaded.

It exists twice, once per browser, in one repository: `firefox/` and `chrome/`, both Manifest V3. Everything stays local to the browser and there is no network use.

## Using it

1. **Tick a folder.**
   - **Firefox:** right-click a bookmark folder (bookmarks toolbar, menu, sidebar or library) and tick **Load sequentially**.
   - **Chrome:** click the toolbar icon and tick the folder in the list. Chrome does not let extensions add items to the bookmark right-click menu, so this is the only way there.
2. **Open the folder as you normally would**: "Open all in tabs", or middle-click the folder.
3. **Optional: the settings page.** Firefox: right-click the folder and choose **Sequential Bookmarks settings**, or open the extension's preferences in `about:addons`. Chrome: the **Settings** button in the toolbar popup. Each ticked folder has:
   - **Wait between tabs:** seconds to wait after a page has finished loading before the next one opens. The default is 0, which opens the next one straight away.
   - **Wait for a login:** a switch, off by default. Switched on, it shows how many minutes to give up after (1 to 60, default 2) and a checkbox per bookmark under "Might ask you to log in". If a ticked bookmark ends up on a login page, the rest waits while you log in, and carries on once that tab has moved to another page. A page counts as a login page when its address looks like one (words such as login, sign-in or sso in the host or path). If you have not finished in time, loading stops there, the remaining bookmarks are not opened and nothing is closed. Bookmarks that are not ticked are never waited on.
   - **Close when everything has loaded:** a checkbox per bookmark. Ticked bookmarks are closed once every bookmark in the folder has loaded, so a folder of A, B and C with A and B ticked ends with only C open. Nothing is closed if any bookmark failed to load or you closed one of the tabs yourself.

## How it works

When tabs start navigating to bookmarks of a ticked folder at about the same moment, and together they cover exactly that folder's bookmarks, the extension treats it as an "Open all". It closes the tabs that open produced and opens the bookmarks again one at a time, in bookmark order, where the first tab was. The first one is active, the rest open in the background.

A bookmark counts as fully loaded when its page is complete and stays complete for one second, so redirects done by the page itself are waited for. A page that takes longer than 30 seconds does not hold up the rest, but then nothing is closed at the end (with "Wait for a login" on, a ticked bookmark is waited for, up to the minutes you set, while it sits on a login page instead).

It works with the Container Bookmarks add-on. That add-on, together with Multi-Account Containers, answers a bookmark by opening a new tab in the container and removing the original, so the extension follows a tab to its replacement and only waits for the final one.

Things to know:

- The other tabs start loading before the extension can stop them, so you may see them flash briefly, and their first requests are wasted.
- Only the bookmarks directly in the folder are used, not those in subfolders.
- If you close a tab mid-sequence, the sequence carries on with the next bookmark.
- A folder with fewer than two bookmarks never triggers anything, and neither does opening a single bookmark.
- The extension needs the `webNavigation` permission to see which bookmarks the tabs are heading for.

## Installing

Download the zip for your browser from the Releases page, or build it yourself (see below).

- **Firefox:** `about:debugging`, This Firefox, Load Temporary Add-on, pick `manifest.json` from the unzipped folder. A permanent install needs a signed add-on. The release workflow signs one when the repository secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` exist.
- **Chrome:** `chrome://extensions`, switch on Developer mode, Load unpacked, pick the unzipped folder.

## Development

```
cd firefox && osascript -l JavaScript test/run.js    # unit tests (also in chrome/)
bash scripts/build.sh firefox                        # or chrome; writes dist/*.zip
bash scripts/bump-version.sh firefox 1.2.0           # edits manifest.json only
python3 scripts/make-icons.py                        # redraws chrome/icons/*.png
```

Node is not needed. The unit tests run on the JavaScript engine built into macOS and cover only the pure logic in `lib/sequence.js`.

## Releasing

Push a tag `firefox-v<version>` or `chrome-v<version>` whose number equals that folder's `manifest.json` version. `.github/workflows/release.yml` checks it, runs the tests, builds the zip and creates a GitHub release.

## Licence

MIT, see `LICENSE`.
