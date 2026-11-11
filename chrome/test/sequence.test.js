const { normaliseUrl, supportsBookmark, planSequence, burstKeys, belongsToBurst, normaliseFolderSettings, looksLikeLogin, loadState, closeTabIds, createLineage } = SequentialBookmarks;

const item = (id, url) => ({ id, url });
const news = { id: "f1", items: [item("b1", "https://a.example/"), item("b2", "https://b.example/x"), item("b3", "https://c.example/")] };
const entry = (url) => ({ url });

test("normaliseUrl ignores a trailing slash, surrounding space and the case of the host", () => {
  assertEqual(normaliseUrl(" HTTPS://A.Example/ "), "https://a.example");
  assertEqual(normaliseUrl("https://a.example"), normaliseUrl("https://a.example/"));
  assertEqual(normaliseUrl("https://a.example/Path"), "https://a.example/Path");
});

test("a burst covering the whole folder matches and returns the folder's bookmarks in order", () => {
  const plan = planSequence([entry("https://c.example/"), entry("https://a.example/"), entry("https://b.example/x")], [news]);
  assertEqual(plan, { folderId: "f1", items: news.items });
});

test("a burst matches even when the browser adds a trailing slash", () => {
  const folder = { id: "f", items: [item("1", "https://a.example"), item("2", "https://b.example")] };
  assertTrue(planSequence([entry("https://a.example/"), entry("https://b.example/")], [folder]));
});

test("container bookmark URLs match with their #container suffix", () => {
  const folder = { id: "f", items: [item("1", "https://a.example/#container-dv"), item("2", "https://b.example/#container-dv")] };
  assertTrue(planSequence([entry("https://a.example/#container-dv"), entry("https://b.example/#container-dv")], [folder]));
});

test("a burst covering only part of the folder is ignored", () => {
  assertEqual(planSequence([entry("https://a.example/"), entry("https://b.example/x")], [news]), null);
});

test("a burst with a URL from outside the folder is ignored", () => {
  assertEqual(planSequence([entry("https://a.example/"), entry("https://b.example/x"), entry("https://other.example/")], [news]), null);
});

test("a folder with one bookmark never triggers", () => {
  assertEqual(planSequence([entry("https://a.example/")], [{ id: "f", items: [item("1", "https://a.example/")] }]), null);
});

test("duplicate bookmarks still match and stay in the sequence", () => {
  const folder = { id: "f", items: [item("1", "https://a.example/"), item("2", "https://b.example/"), item("3", "https://a.example/")] };
  const plan = planSequence([entry("https://a.example/"), entry("https://b.example/"), entry("https://a.example/")], [folder]);
  assertEqual(plan.items.map((i) => i.id), ["1", "2", "3"]);
});

test("with several ticked folders the matching one is chosen", () => {
  const other = { id: "f2", items: [item("x", "https://x.example/"), item("y", "https://y.example/")] };
  assertEqual(planSequence([entry("https://x.example/"), entry("https://y.example/")], [news, other]).folderId, "f2");
});

test("no ticked folders means no plan", () => {
  assertEqual(planSequence([entry("https://a.example/"), entry("https://b.example/x")], []), null);
});

test("folder settings default to no wait, nothing closed and no login wait (2 minutes once switched on)", () => {
  const defaults = { waitSeconds: 0, closeBookmarkIds: [], waitForLogin: false, loginBookmarkIds: [], loginWaitMinutes: 2 };
  assertEqual(normaliseFolderSettings(undefined), defaults);
  assertEqual(normaliseFolderSettings({}), defaults);
  assertEqual(normaliseFolderSettings("junk"), defaults);
});

test("folder settings keep a valid wait and round it down to whole seconds", () => {
  assertEqual(normaliseFolderSettings({ waitSeconds: 5 }).waitSeconds, 5);
  assertEqual(normaliseFolderSettings({ waitSeconds: "7" }).waitSeconds, 7);
  assertEqual(normaliseFolderSettings({ waitSeconds: 2.9 }).waitSeconds, 2);
});

test("folder settings reject a negative or unreadable wait and cap a huge one", () => {
  assertEqual(normaliseFolderSettings({ waitSeconds: -3 }).waitSeconds, 0);
  assertEqual(normaliseFolderSettings({ waitSeconds: "soon" }).waitSeconds, 0);
  assertEqual(normaliseFolderSettings({ waitSeconds: 999999 }).waitSeconds, 3600);
});

test("folder settings keep only distinct string ids to close", () => {
  assertEqual(normaliseFolderSettings({ closeBookmarkIds: ["a", "b", "a", 5, null] }).closeBookmarkIds, ["a", "b"]);
  assertEqual(normaliseFolderSettings({ closeBookmarkIds: "a" }).closeBookmarkIds, []);
});

test("folder settings keep only distinct string ids that may ask for a login", () => {
  assertEqual(normaliseFolderSettings({ loginBookmarkIds: ["a", "a", 7, "b"] }).loginBookmarkIds, ["a", "b"]);
  assertEqual(normaliseFolderSettings({ loginBookmarkIds: null }).loginBookmarkIds, []);
  assertEqual(normaliseFolderSettings({ closeBookmarkIds: ["x"] }).loginBookmarkIds, []);
});

test("the login wait is on only when explicitly switched on", () => {
  assertEqual(normaliseFolderSettings({ waitForLogin: true }).waitForLogin, true);
  assertEqual(normaliseFolderSettings({ waitForLogin: "true" }).waitForLogin, false);
  assertEqual(normaliseFolderSettings({ waitForLogin: false }).waitForLogin, false);
});

test("the login wait keeps whole minutes between 1 and 60 and otherwise falls back", () => {
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: 5 }).loginWaitMinutes, 5);
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: "10" }).loginWaitMinutes, 10);
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: 2.9 }).loginWaitMinutes, 2);
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: 999 }).loginWaitMinutes, 60);
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: 0 }).loginWaitMinutes, 2);
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: -4 }).loginWaitMinutes, 2);
  assertEqual(normaliseFolderSettings({ loginWaitMinutes: "soon" }).loginWaitMinutes, 2);
});

test("looksLikeLogin recognises login hosts and login paths", () => {
  assertTrue(looksLikeLogin("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=x"));
  assertTrue(looksLikeLogin("https://eu-central-1.signin.aws/platform/login?workflowStateHandle=abc"));
  assertTrue(looksLikeLogin("https://accounts.google.com/v3/signin/identifier"));
  assertTrue(looksLikeLogin("https://tenant.auth0.com/u/login?state=x"));
  assertTrue(looksLikeLogin("https://example.com/users/sign_in"));
  assertTrue(looksLikeLogin("https://example.com/Account/Login.aspx?ReturnUrl=%2f"));
  assertTrue(looksLikeLogin("http://127.0.0.1:8765/login"));
  assertTrue(looksLikeLogin("https://sso.example.com/"));
});

test("looksLikeLogin leaves ordinary pages alone, even with login words in the query or fragment", () => {
  assertEqual(looksLikeLogin("https://novamedia.awsapps.com/start/#/console?account_id=1&role_name=DataEngineer"), false);
  assertEqual(looksLikeLogin("https://eu-central-1.console.aws.amazon.com/sagemaker/home?region=eu-central-1#/studio-landing"), false);
  assertEqual(looksLikeLogin("https://example.com/news?next=/login#sign-in"), false);
  assertEqual(looksLikeLogin("https://example.com/blog/login-tips"), false);
  assertEqual(looksLikeLogin("https://example.com/authors"), false);
});

test("looksLikeLogin is false for blank, non-web and unreadable addresses", () => {
  assertEqual(looksLikeLogin("about:blank"), false);
  assertEqual(looksLikeLogin("moz-extension://abc/login/index.html"), false);
  assertEqual(looksLikeLogin(""), false);
  assertEqual(looksLikeLogin(undefined), false);
});

test("loadState: a bookmark that lands on a login page is waiting for a login, unless it is itself the login page", () => {
  assertEqual(loadState("https://login.example.com/start", "https://app.example.com/home"), "login");
  assertEqual(loadState("https://app.example.com/home", "https://app.example.com/home"), "loaded");
  assertEqual(loadState("https://login.example.com/start", "https://login.example.com/start"), "loaded");
});

test("closeTabIds returns the tabs of the chosen bookmarks, in order", () => {
  const items = [item("b1", "u1"), item("b2", "u2"), item("b3", "u3")];
  assertEqual(closeTabIds(items, ["b1", "b2"], [11, 12, 13], true), [11, 12]);
});

test("closeTabIds closes nothing when something did not load", () => {
  const items = [item("b1", "u1"), item("b2", "u2"), item("b3", "u3")];
  assertEqual(closeTabIds(items, ["b1", "b2"], [11, 12, 13], false), []);
});

test("closeTabIds skips bookmarks that never got a tab and ids no longer in the folder", () => {
  const items = [item("b1", "u1"), item("b2", "u2")];
  assertEqual(closeTabIds(items, ["b1", "gone"], [undefined, 12], true), []);
  assertEqual(closeTabIds(items, ["b2", "gone"], [undefined, 12], true), [12]);
  assertEqual(closeTabIds(items, ["b1", "b2"], [null, 12], true), [12]);
});

test("lineage: a tab created before the removal becomes the successor", () => {
  const lineage = createLineage(500);
  const followed = new Set([5]);
  assertEqual(lineage.created(8, 1000), null);
  assertEqual(lineage.removed(5, 1010, (id) => followed.has(id)), { from: 5, to: 8 });
});

test("lineage: a tab created just after the removal is picked up too", () => {
  const lineage = createLineage(500);
  const followed = new Set([5]);
  assertEqual(lineage.removed(5, 1000, (id) => followed.has(id)), null);
  assertEqual(lineage.created(8, 1100), { from: 5, to: 8 });
});

test("lineage: a removal with no new tab in time finds no successor", () => {
  const lineage = createLineage(500);
  const followed = new Set([5]);
  assertEqual(lineage.removed(5, 1000, (id) => followed.has(id)), null);
  assertEqual(lineage.created(9, 1700), null);
});

test("lineage: a burst of replacements is paired in order and followed tabs are never successors", () => {
  const lineage = createLineage(500);
  const followed = new Set([5, 6, 7]);
  const isFollowed = (id) => followed.has(id);
  // 5, 6, 7 were opened first, then each is replaced by 8, 9, 10 (created just before the original is removed)
  [5, 6, 7].forEach((id, i) => lineage.created(id, 100 + i));
  assertEqual(lineage.created(8, 200), null);
  assertEqual(lineage.removed(5, 210, isFollowed), { from: 5, to: 8 });
  followed.delete(5); followed.add(8);
  assertEqual(lineage.created(9, 270), null);
  assertEqual(lineage.removed(6, 280, isFollowed), { from: 6, to: 9 });
  followed.delete(6); followed.add(9);
  assertEqual(lineage.created(10, 330), null);
  assertEqual(lineage.removed(7, 340, isFollowed), { from: 7, to: 10 });
});

test("lineage: removing a tab nobody follows does nothing", () => {
  const lineage = createLineage(500);
  lineage.created(3, 1000);
  assertEqual(lineage.removed(3, 1010, () => false), null);
  assertEqual(lineage.created(4, 1020), null);
});

test("burstKeys drops the #container fragment and duplicates", () => {
  const items = [item("1", "https://a.example/x#container-dv"), item("2", "https://a.example/x"), item("3", "https://B.example/")];
  assertEqual(burstKeys(items), ["https://a.example/x", "https://b.example"]);
});

test("a blank tab belongs to the burst", () => {
  const keys = burstKeys([item("1", "https://a.example/x#container-dv")]);
  assertTrue(belongsToBurst("about:blank", keys));
  assertTrue(belongsToBurst("", keys));
});

test("a tab on a bookmark, or on the redirect URL wrapped around it, belongs to the burst", () => {
  const keys = burstKeys([item("1", "https://a.example/x#container-dv")]);
  assertTrue(belongsToBurst("https://a.example/x", keys));
  assertTrue(belongsToBurst("http://www.dv.container/https://a.example/x", keys));
});

test("an unrelated page created at the same moment does not belong to the burst", () => {
  const keys = burstKeys([item("1", "https://a.example/x#container-dv")]);
  assertEqual(belongsToBurst("https://other.example/", keys), false);
  assertEqual(belongsToBurst("about:newtab", keys), false);
});

test("supportsBookmark accepts the bookmark URL itself and a redirect URL wrapped around it", () => {
  assertTrue(supportsBookmark("https://a.example/x#container-dv", "https://a.example/x#container-dv"));
  assertTrue(supportsBookmark("https://a.example/x", "https://a.example/x#container-dv"));
  assertTrue(supportsBookmark("http://www.dv.container/https://a.example/x", "https://a.example/x#container-dv"));
  assertEqual(supportsBookmark("https://a.example/other", "https://a.example/x#container-dv"), false);
});

test("a burst is matched from the replacement tabs even when an original tab was never seen", () => {
  const folder = { id: "f", items: [item("1", "https://a.example/#container-dv"), item("2", "https://b.example/#container-dv"), item("3", "https://c.example/#container-dv")] };
  const entries = [
    entry("https://a.example/#container-dv"),
    entry("https://b.example/#container-dv"),
    entry("http://www.dv.container/https://a.example/"),
    entry("http://www.dv.container/https://b.example/"),
    entry("http://www.dv.container/https://c.example/"),
  ];
  assertTrue(planSequence(entries, [folder]));
});

test("a wrapped URL for a bookmark outside the folder stops the match", () => {
  const folder = { id: "f", items: [item("1", "https://a.example/#container-dv"), item("2", "https://b.example/#container-dv")] };
  const entries = [entry("https://a.example/#container-dv"), entry("https://b.example/#container-dv"), entry("http://www.dv.container/https://z.example/")];
  assertEqual(planSequence(entries, [folder]), null);
});
