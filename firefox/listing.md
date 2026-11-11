# Mozilla listing: Sequential Bookmarks for Firefox

Everything to paste into the Developer Hub on addons.mozilla.org to list the add-on publicly. This file is not part of the extension package. The field names below are from memory of the Developer Hub, so a label may differ slightly; the answers are what matter. The form shows its own character limits as you paste. Prepared on 11-11-2026 for version 1.2.0.

## Before you start

1. **File to upload:** `dist/sequential-bookmarks-firefox-1.2.0.zip` (12 KB, eight files, nothing but the runtime files). Rebuild it with `bash scripts/build.sh firefox` if you change anything.
2. **Version number:** 1.2.0. Versions 1.0.0, 1.1.0, 1.1.1 and 1.1.2 already exist on Mozilla (1.1.2 is the same code as 1.2.0, signed as unlisted for private use so that 1.2.0 stays free), and Mozilla does not accept a number it has used before, in either channel.
3. **Do not push a `firefox-v1.2.0` tag.** The release workflow would sign 1.2.0 as an unlisted version and use up the number, and the listed upload would then be refused. After the listed version is approved, push the tag only if you also want a GitHub release (see "After approval").
4. **Where to go:** the add-on already exists on Mozilla as an unlisted add-on, so open its page on the Developer Hub (my best guess is https://addons.mozilla.org/en-US/developers/addon/a736fe1615c542bbadf2/, taken from the name of the signed file; check it against your own list) and choose to upload a new version. Otherwise use Submit a New Add-on.
5. **Your public name:** the developer name shown on the listing comes from your Mozilla account's display name. Check it first, so it is not your full name unless you want that.
6. **The GitHub repository is private.** A homepage or support link to it would not work for anyone else. Either make the repository public first or leave those fields empty (see Support).

## 1. How to distribute this version
Choose **On this site** (listed).

## 2. Upload the file
Upload the zip. The validator should report no errors. Under compatibility, keep **Firefox** ticked and **untick Firefox for Android**: the bookmark right-click menu this add-on is built around does not exist there.

## 3. Source code
**Do you need to submit source code?** No.
The package contains plain JavaScript that is written by hand. There is no minification, bundler, transpiler, template engine or third-party code, and the package is the source.

## 4. Describe the add-on

### Name
Sequential Bookmarks

### Add-on URL
sequential-bookmarks (if it is taken, the form suggests another)

### Summary (229 characters, the limit is 250)
Load the bookmarks of a folder one after another, each once the previous page has fully loaded. Add a pause between pages and close the tabs you do not need afterwards. Works with Container Bookmarks. Nothing leaves your browser.

### Description
Open a bookmark folder with "Open All in Tabs" and every page normally loads at the same moment. Sequential Bookmarks loads them one after another instead: the first page loads completely, then the second one opens, then the third, and so on.

How it works
- Right-click a bookmark folder and tick Load sequentially.
- Open the folder as you always do, with Open All in Tabs or a middle-click. The pages now load one at a time, in the order of the bookmarks.
- A page counts as loaded when it has finished loading and has stayed that way for one second, so redirects are waited for too.

Settings (right-click a folder and choose Sequential Bookmarks settings, or open the add-on's preferences in about:addons)
- Wait between tabs: a number of seconds to wait after a page has finished loading before the next one opens. The default is 0, which opens the next one straight away.
- Wait for a login: a switch, off by default. Switched on, tick the bookmarks that may show a sign-in page and choose how many minutes to give up after (1 to 60, default 2). If a ticked bookmark shows a sign-in page, the rest waits while you log in and carries on once the tab has moved to another page. A page counts as a sign-in page when its address looks like one (words such as login, sign-in or sso). If you have not finished in time, loading stops there and nothing is closed.
- Close when everything has loaded: tick the bookmarks whose tabs should close once every page of the folder has loaded. Open a folder with A, B and C, tick A and B, and only C stays open. Nothing is closed if a page failed to load or you closed one of the tabs yourself.

Works with Container Bookmarks
Because each page is only counted as loaded once it has really finished, the add-on follows a bookmark through the redirects and tab changes that Container Bookmarks and Multi-Account Containers make, and waits for the page in its container. It is tested with those two add-ons. Sequential Bookmarks is not affiliated with them.

Good to know
- When you open a ticked folder, Firefox first opens all its tabs at once. The add-on closes them and opens the bookmarks again one by one, so you may see the tabs flash briefly, and each page is requested once more.
- Only the bookmarks directly inside the folder are used, not those in subfolders.
- A page that has not finished loading after 30 seconds is given up on, and the next one opens (nothing is closed at the end then). With Wait for a login on, a ticked bookmark is waited for, up to the minutes you set, while it shows a sign-in page.
- Opening a single bookmark, or a folder with fewer than two bookmarks, works as usual.

Privacy
Sequential Bookmarks collects no data. It has no accounts, no analytics and no server, and it makes no network requests of its own. Your ticked folders and settings are saved in your own browser. It reads the bookmarks in the folders you tick and the web addresses that tabs open, only to tell when a folder is opened and which page is loading.

Needs Firefox 142 or newer on a computer.

### This add-on is experimental
No.

### This add-on requires payment, non-free services or software, or additional hardware
No.

### Categories (choose up to two)
Bookmarks and Tabs.

### Tags (if the form offers them)
bookmarks, tabs, containers, open all, load order, sequential

### Default language
English. If the form offers British English, choose it; the text is written in British English. Otherwise choose English (US).

## 5. Support and links
- **Support email:** optional and shown publicly. Leave it empty, or use an address you are happy to show. Do not use your work email.
- **Support website and Homepage:** leave empty while the repository is private. If you make it public, use https://github.com/moamstripes/sequential-bookmarks/issues for support and https://github.com/moamstripes/sequential-bookmarks as the homepage.

## 6. License
MIT License (the text is in the repository's `LICENSE`).

## 7. Privacy policy
Not needed: the add-on collects no data, and the manifest declares `data_collection_permissions` as none, so the listing shows that the developer says no data is collected. Leave "This add-on has a privacy policy" unticked. The Privacy paragraph in the description says the same in words.

## 8. Release notes for this version (shown to users)
First public version. Tick a bookmark folder from its right-click menu and its bookmarks load one after another when you open it. A settings page sets the wait between pages, whether to wait for you to log in (and for how long) and which tabs to close once everything has loaded. Works with Container Bookmarks.

## 9. Notes for reviewers
No build step, no minification, no bundler and no third-party code: the uploaded package is the source, so no separate source upload is needed. All code is in `lib/sequence.js` (pure logic), `lib/core.js` (browser logic), `background.js` (the menu items) and `options/` (the settings page). There is no eval, no dynamic code and no HTML injection (the settings page builds its elements with textContent). The extension makes no network requests of its own and loads no remote code. `data_collection_permissions` is declared as none.

This add-on already has two versions on the unlisted channel (1.0.0 and 1.1.0), signed by Mozilla for self-distribution under the same ID. This is the first listed version.

How to try it:
1. Create a bookmark folder with at least three bookmarks to any websites.
2. Right-click the folder in the bookmarks toolbar or the Bookmarks menu and tick Load sequentially.
3. Right-click the folder and choose Open All in Tabs. The tabs flash, then the first page loads, and the next one only opens when the previous one has finished loading.
4. Right-click the folder and choose Sequential Bookmarks settings (or open the add-on's preferences). Set Wait between tabs to 5 and tick the first two bookmarks under Close when everything has loaded. Open the folder again: pages now follow each other 5 seconds apart, and the first two tabs close at the end.

Why each permission is needed:
- bookmarks: to read the bookmarks inside a ticked folder, and to notice when they change.
- menus: to add Load sequentially and Sequential Bookmarks settings to the bookmark folder context menu.
- tabs: to open the bookmarks one at a time, to know when a page has finished loading, and to close the tabs of an "Open all" that it reopens and the tabs the user chose to close.
- webNavigation: to see which bookmark address each new tab is heading for, which is how an "Open all" on a ticked folder is recognised. Nothing is read from page contents.
- storage: to save the ticked folders and their settings (local), and the state of a running sequence so it survives the background page being unloaded (session).

No host permissions are requested and there are no content scripts, so the add-on cannot read or change any web page.

## Screenshots
Add these from `firefox/listing-screenshots/`, with the captions:
1. `settings-light.png`: "The settings page: the wait between pages, and which tabs to close once everything has loaded."
2. `settings-dark.png`: "The same page in dark mode."

The pictures show the Wait for a login switch on in one folder and off in the other. They use made-up folder and bookmark names. A picture of the right-click menu would be the most useful third screenshot, but it cannot be taken without a real window: on a Mac press Shift, Command and 4 then Space, and click the Firefox window while the menu is open on a bookmark folder. Make sure no personal bookmarks are visible.

## After approval
- Mozilla's first review of a listed version can take from a few hours to several days. The add-on stays on the unlisted channel in the meantime, and the signed 1.1.0 keeps working.
- If you want a GitHub release for 1.2.0, push the tag `firefox-v1.2.0` only after approval, and expect the workflow's signing step to be refused for the number that is already taken: attach the approved file by hand instead.
- Add the listing link to the README's install section.
