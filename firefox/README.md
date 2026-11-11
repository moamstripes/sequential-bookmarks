# Sequential Bookmarks for Firefox

Manifest V3 with an event page. The tick is a checkbox item in the bookmark right-click menu (`menus` API, `bookmark` context), next to an item that opens the settings page (`options/`). Both are hidden for single bookmarks and only shown for folders. The loading logic is in `lib/core.js`, shared with Chrome. See the main `README.md` for what it does.

## Install for testing

`about:debugging`, This Firefox, Load Temporary Add-on, choose `manifest.json`.

## Manual test checklist

1. Make a folder with three bookmarks. Right-click the folder: **Load sequentially** and **Sequential Bookmarks settings** are shown. Right-click a single bookmark: neither is shown.
2. Tick it, right-click again: it is ticked. Untick, right-click again: it is unticked.
3. Tick it, then right-click the folder and choose **Open All in Tabs**: the first page loads, the second only starts when the first has finished (plus a second), then the third. The tabs end up in bookmark order.
4. Open **Sequential Bookmarks settings**: the folder is listed. Set the wait to 5 and open the folder again: each page now starts about 6 seconds after the previous one finished.
5. In the settings, tick the first two bookmarks under "Close when everything has loaded" and open the folder: when the third has loaded, the first two close.
6. Make the first bookmark one that needs a login (for example a page that redirects to a sign-in page when you are logged out). In the settings switch on "Wait for a login", leave the minutes at 2 and tick that bookmark. Log out and open the folder: the first tab shows the sign-in page and the other pages do not open. Log in: once the tab has moved on, the rest load. Do not log in: after the minutes you set, loading stops and nothing is closed. Switch the toggle off: the rest loads without waiting.
7. Close the second tab while it is loading: the third still loads and nothing is closed.
8. With Container Bookmarks (and Multi-Account Containers) set up, give the bookmarks the container suffix and repeat step 3: the tabs open one after another in their containers, with no blank tabs left over.
9. Untick the folder and open it again: all pages load at once. Open a single bookmark of a ticked folder: it opens normally.

## What has been tested

Checked in throwaway Firefox 159 profiles (headless, Marionette) against a local server that answers each page after 2 seconds and logs every request, using Firefox's own "open all bookmarks in tabs" function (`PlacesUIUtils.openMultipleLinksInTabs`):

- plain bookmarks, container bookmarks with Multi-Account Containers 8.4.0 and Container Bookmarks 1.2.0 (copies of the add-ons installed here), and a mix of both, with a wait of 0 and of 5 seconds;
- closing the first two bookmarks at the end (only the last stayed), and closing nothing when a tab is closed mid-sequence;
- twelve container opens in a row, all correct (an earlier design failed one in seven, see `CLAUDE.md`);
- the login wait, against a local server that redirects the first page to `/login` until "logged in" (11-11-2026): with the bookmark ticked the rest did not open until the login was done, then followed and the first tab closed; already logged in, it carried straight on; with a shortened limit and no login it stopped, left the sign-in tab open and closed nothing; with the bookmark not ticked the rest loaded without waiting, as before. A real login page (Microsoft, AWS) has not been tried;
- the settings page: it renders the stored settings, saves a changed wait and tick, and unticking a folder removes its card.

The right-click menu items cannot be clicked headlessly, so steps 1 and 2 above, and opening the settings page from the menu, are untested.
