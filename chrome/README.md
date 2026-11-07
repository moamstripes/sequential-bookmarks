# Sequential Bookmarks for Chrome

Manifest V3 with a service worker. Chrome has no way for an extension to add an item to the bookmark right-click menu, so folders are ticked in the toolbar popup (`popup/`), which lists every bookmark folder with a checkbox. The loading logic is in `lib/core.js`, shared with Firefox. See the main `README.md` for what it does.

## Install for testing

`chrome://extensions`, Developer mode, Load unpacked, choose this `chrome/` folder.

## Manual test checklist

1. Click the toolbar icon: every bookmark folder is listed with its path. Tick one, close the popup and reopen it: it is still ticked.
2. With a three-bookmark folder ticked, right-click it on the bookmarks bar and choose **Open all**: the first page loads, the second only starts when the first has finished, then the third. The tabs end up in bookmark order.
3. Untick it and open the folder again: all three load at once.
4. Open a single bookmark of a ticked folder: it opens normally.

## What has been tested

Checked in a throwaway Chrome 157 profile (headless, DevTools protocol) against a local slow server. The native "Open all" cannot be triggered that way, so three tabs were created in the same instant with `chrome.tabs.create` instead. The order and the wait-for-load behaviour were correct. In that test the second bookmark's request sometimes only reached the server a few seconds after its tab was opened; the cause was not found, and it may come from the headless setup. The popup and the real "Open all" menu are untested.
