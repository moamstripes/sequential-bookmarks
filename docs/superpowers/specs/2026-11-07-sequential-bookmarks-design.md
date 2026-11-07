# Sequential Bookmarks: design

Date: 07-11-2026

## Goal

Let the user tick bookmark folders so that opening one loads its bookmarks sequentially: each bookmark is only opened once the previous one has fully loaded. For Firefox and Chrome, Manifest V3, in one repository. Deliberately simpler than tab-labels: no website, no settings page, few tests.

## Decisions

- **Ticking a folder.** Firefox: a checkbox item "Load sequentially" in the bookmark right-click menu, shown for folders only. Chrome cannot add items to that menu, so a toolbar popup lists every bookmark folder with a checkbox.
- **Trigger.** The native "Open all in tabs" (or middle-click) is intercepted. Neither browser has an event for it, so the extension detects a burst of new tabs whose URLs are exactly the bookmarks of a ticked folder (at least two), keeps the first tab, closes the rest and reopens them one after another. Accepted drawback: the tabs may flash, and their first requests are wasted.
- **Loaded.** The tab reports `status: complete` (and is not `about:blank`). A 30 second timeout per bookmark stops one dead page blocking the rest. It is not configurable.
- **Scope.** Only a folder's direct bookmarks, not subfolders. A closed tab is skipped.
- **Persistence.** Ticked folders in `storage.local`. Running sequences in `storage.session` so they resume after the background script unloads.
- **Testing.** Unit tests for the pure logic only (`lib/sequence.js`) plus manifest checks, run on macOS's built-in JavaScript engine. Real-browser behaviour checked in throwaway profiles against a local slow server.
- **Repo.** Private GitHub repository, repo-local `moamstripes` identity, MIT licence, release workflow that builds a zip per browser from a `firefox-v*` or `chrome-v*` tag.
