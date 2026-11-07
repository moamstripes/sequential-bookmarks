# Sequential Bookmarks

A browser extension that loads the bookmarks of a folder one after another instead of all at once. The first bookmark loads, and once it has finished loading the second one opens, then the third, and so on.

It exists twice, once per browser, in one repository: `firefox/` and `chrome/`, both Manifest V3. Everything stays local to the browser, there is no network use and no settings page.

## Using it

1. **Tick a folder.**
   - **Firefox:** right-click a bookmark folder (bookmarks toolbar, menu, sidebar or library) and tick **Load sequentially**.
   - **Chrome:** click the toolbar icon and tick the folder in the list. Chrome does not let extensions add items to the bookmark right-click menu, so this is the only way there.
2. **Open the folder as you normally would**: "Open all in tabs", or middle-click the folder. You do not use anything extra.

## How it works

When two or more new tabs land on bookmarks of a ticked folder within a fraction of a second, and together they are exactly that folder's bookmarks, the extension treats it as an "Open all". It keeps the tab of the first bookmark (already loading, and still the active tab), closes the others, then opens each remaining bookmark in the background, in bookmark order, once the previous tab reports it has finished loading. A page that takes longer than 30 seconds does not hold up the rest.

Things to know:

- The other tabs start loading before the extension can stop them, so you may see them flash briefly, and their first requests are wasted.
- Only the bookmarks directly in the folder are used, not those in subfolders.
- If you close a tab mid-sequence, the sequence carries on with the next bookmark.
- A folder with fewer than two bookmarks never triggers anything, and neither does opening a single bookmark.

## Installing

Download the zip for your browser from the Releases page, or build it yourself (see below).

- **Firefox:** `about:debugging`, This Firefox, Load Temporary Add-on, pick `manifest.json` from the unzipped folder. A permanent install needs a signed add-on. The release workflow signs one when the repository secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` exist.
- **Chrome:** `chrome://extensions`, switch on Developer mode, Load unpacked, pick the unzipped folder.

## Development

```
cd firefox && osascript -l JavaScript test/run.js    # unit tests (also in chrome/)
bash scripts/build.sh firefox                        # or chrome; writes dist/*.zip
bash scripts/bump-version.sh firefox 1.1.0           # edits manifest.json only
python3 scripts/make-icons.py                        # redraws chrome/icons/*.png
```

Node is not needed. The unit tests run on the JavaScript engine built into macOS and cover only the pure logic in `lib/sequence.js`.

## Releasing

Push a tag `firefox-v<version>` or `chrome-v<version>` whose number equals that folder's `manifest.json` version. `.github/workflows/release.yml` checks it, runs the tests, builds the zip and creates a GitHub release.

## Licence

MIT, see `LICENSE`.
