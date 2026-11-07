# Sequential Bookmarks for Firefox

Manifest V3 with an event page. The tick is a checkbox item in the bookmark right-click menu (`menus` API, `bookmark` context). It is hidden for single bookmarks and only shown for folders. The loading logic is in `lib/core.js`, shared with Chrome. See the main `README.md` for what it does.

## Install for testing

`about:debugging`, This Firefox, Load Temporary Add-on, choose `manifest.json`.

## Manual test checklist

1. Make a folder with three bookmarks. Right-click the folder: **Load sequentially** is shown, unticked. Right-click a single bookmark: the item is not shown.
2. Tick it, right-click again: it is ticked. Untick, right-click again: it is unticked.
3. Tick it, then right-click the folder and choose **Open All in Tabs**: the first page loads, the second only starts when the first has finished, then the third. The tabs end up in bookmark order.
4. Untick it and open the folder again: all three load at once.
5. Open a single bookmark of a ticked folder: it opens normally.

## What has been tested

Checked in a throwaway Firefox 159 profile (headless, Marionette) against a local slow server: with a ticked folder, Firefox's own "open all bookmarks in tabs" function (`PlacesUIUtils.openMultipleLinksInTabs`) produced a sequential load in the right order. The right-click menu items themselves cannot be clicked headlessly, so steps 1 and 2 above are untested.
