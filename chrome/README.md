# Sequential Bookmarks for Chrome

Manifest V3 with a service worker. Chrome has no way for an extension to add an item to the bookmark right-click menu, so folders are ticked in the toolbar popup (`popup/`), which lists every bookmark folder with a checkbox and has a **Settings** button for the settings page (`options/`). The loading logic is in `lib/core.js`, shared with Firefox. See the main `README.md` for what it does. Chrome has no containers, so the part of the logic that follows a tab to its replacement never comes into play here.

## Install for testing

`chrome://extensions`, Developer mode, Load unpacked, choose this `chrome/` folder.

## Manual test checklist

1. Click the toolbar icon: every bookmark folder is listed with its path. Tick one, close the popup and reopen it: it is still ticked.
2. With a three-bookmark folder ticked, right-click it on the bookmarks bar and choose **Open all**: the first page loads, the second only starts when the first has finished (plus a second), then the third. The tabs end up in bookmark order.
3. Click **Settings** in the popup: the folder is listed. Set the wait to 5 and open the folder again: each page now starts about 6 seconds after the previous one finished.
4. Switch on "Wait for a login" in the settings and tick a bookmark that needs a login, log out of that site and open the folder: the rest waits on the sign-in page until you have logged in, and loading stops after the minutes you set if you do not.
5. Tick the first two bookmarks under "Close when everything has loaded" and open the folder: when the third has loaded, the first two close.
5. Close the second tab while it is loading: the third still loads and nothing is closed.
6. Untick the folder and open it again: all pages load at once. Open a single bookmark of a ticked folder: it opens normally.

## What has been tested

Checked in a throwaway Chrome 157 profile (headless, DevTools protocol) against a local server that answers each page after 2 seconds and logs every request. The native "Open all" cannot be triggered that way, so three tabs were created in the same instant with `chrome.tabs.create` instead. With a wait of 2 seconds the order and timings were right (the next page started 3 seconds after the previous one finished: one second to settle plus the wait), and the first two bookmarks closed at the end, leaving the last. The settings page rendered the stored settings, saved a changed wait and tick, and unticking removed the card. The popup and the real "Open all" menu are untested.

In that setup `chrome.storage.local.get` sometimes stalled for several seconds (0 ms, 0 ms, then 7.9 s for the same call, with the extension idle), which delayed the start of the sequence by that long. It looks like a Chrome or headless quirk and not the extension, and the extension now loads the folder list ahead of time to avoid waiting on it during an open, but a normal Chrome has not been checked.
