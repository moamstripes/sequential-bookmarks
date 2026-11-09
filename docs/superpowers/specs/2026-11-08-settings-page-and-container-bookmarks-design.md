# Sequential Bookmarks: settings page and Container Bookmarks support

Date: 08-11-2026. Extends [the first design](2026-11-07-sequential-bookmarks-design.md). Version 1.1.0.

## Goal

A settings page with per-folder settings: a wait between tabs (default 0 seconds, where 0 means "as soon as the previous page has fully loaded, redirects included") and which bookmarks to close once every bookmark of the folder has loaded. It must work with the Container Bookmarks extension, so "fully loaded" has to follow a tab through the redirects and through the tab replacement that Multi-Account Containers does.

## What was found out

Traced in a throwaway Firefox 159 profile with the real Multi-Account Containers 8.4.0 and Container Bookmarks 1.2.0:

- A container bookmark carries `#container-<name>`. Container Bookmarks redirects the request through `http://www.<name>.container/<original URL>`; Multi-Account Containers cancels that request, creates a new tab in the container and removes the original.
- "Open all" produces blank tabs. Their `url` stays `about:blank`, the replacement's `url` only changes when the response arrives, and it has lost the `#container-<name>` part.
- `webNavigation.onBeforeNavigate` reports the bookmark URL, but not always: for one original tab in about seven runs it never arrived, and it can arrive after the tab events that concern the same tab.

## Decisions

- **Detection.** Tabs count as part of a burst when they navigate to a bookmark URL or to a URL that ends with one (the wrapped redirect URL). Sources: `webNavigation.onBeforeNavigate` and `tabs.onUpdated`. A bookmark is covered by any such navigation, so a missing original is made up for by its replacement. New permission: `webNavigation`.
- **Closing the open.** All tabs of the open are closed (the first one too), then the bookmarks are reopened one at a time where the first tab was. Closed are: tabs that navigated for a bookmark, and tabs created in the 1.5 s before and during the burst that are still blank or on a bookmark. The burst is judged after it ends; no ordering between event types is assumed.
- **Following a replacement.** Only for a step (one tab in flight): the removed tab is paired with the tab created just before or after it, and that one is waited for.
- **Fully loaded.** Complete on a real page and still complete one second later. The 30 second give-up stays a constant.
- **Wait.** Per folder, whole seconds from 0 to 3600, default 0, counted from the moment the page is fully loaded.
- **Closing at the end.** Per bookmark checkbox, default keep. Only when every bookmark loaded properly: nothing is closed after a timeout or a tab closed by the user.
- **Settings page.** One page for both browsers, auto-saved, a card per ticked folder (wait, close checkboxes, a button to untick). Firefox: a menu item on the folder and `about:addons`. Chrome: a button in the popup.
- **Storage.** `folderSettings` in `storage.local`, keyed by folder id; the bookmarks to close are kept by bookmark id.
- **Chrome.** Same code. Chrome has no containers, so the replacement-following never applies.

## Not done

A per-folder timeout, subfolders, a global default wait, and clicking the right-click menu items in a test (not possible headlessly).
