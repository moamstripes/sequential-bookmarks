const { normaliseUrl, planSequence } = SequentialBookmarks;

const news = { id: "f1", urls: ["https://a.example/", "https://b.example/x", "https://c.example/"] };
const entry = (tabId, url) => ({ tabId, url });

test("normaliseUrl ignores a trailing slash, surrounding space and the case of the host", () => {
  assertEqual(normaliseUrl(" HTTPS://A.Example/ "), "https://a.example");
  assertEqual(normaliseUrl("https://a.example"), normaliseUrl("https://a.example/"));
  assertEqual(normaliseUrl("https://a.example/Path"), "https://a.example/Path");
});

test("a burst covering the whole folder keeps the first bookmark's tab and queues the rest in order", () => {
  const plan = planSequence([entry(3, "https://c.example/"), entry(1, "https://a.example/"), entry(2, "https://b.example/x")], [news]);
  assertEqual(plan, {
    folderId: "f1",
    keepTabId: 1,
    closeTabIds: [3, 2],
    remainingUrls: ["https://b.example/x", "https://c.example/"],
  });
});

test("a burst matches even when the browser adds a trailing slash", () => {
  const folder = { id: "f", urls: ["https://a.example", "https://b.example"] };
  assertTrue(planSequence([entry(1, "https://a.example/"), entry(2, "https://b.example/")], [folder]));
});

test("a burst covering only part of the folder is ignored", () => {
  assertEqual(planSequence([entry(1, "https://a.example/"), entry(2, "https://b.example/x")], [news]), null);
});

test("a burst with a URL from outside the folder is ignored", () => {
  const burst = [entry(1, "https://a.example/"), entry(2, "https://b.example/x"), entry(3, "https://other.example/")];
  assertEqual(planSequence(burst, [news]), null);
});

test("a folder with one bookmark never triggers", () => {
  assertEqual(planSequence([entry(1, "https://a.example/")], [{ id: "f", urls: ["https://a.example/"] }]), null);
});

test("duplicate bookmarks are queued again but still match", () => {
  const folder = { id: "f", urls: ["https://a.example/", "https://b.example/", "https://a.example/"] };
  const plan = planSequence([entry(1, "https://a.example/"), entry(2, "https://b.example/"), entry(3, "https://a.example/")], [folder]);
  assertEqual(plan.keepTabId, 1);
  assertEqual(plan.closeTabIds, [2, 3]);
  assertEqual(plan.remainingUrls, ["https://b.example/", "https://a.example/"]);
});

test("with several ticked folders the matching one is chosen", () => {
  const other = { id: "f2", urls: ["https://x.example/", "https://y.example/"] };
  assertEqual(planSequence([entry(7, "https://x.example/"), entry(8, "https://y.example/")], [news, other]).folderId, "f2");
});

test("no ticked folders means no plan", () => {
  assertEqual(planSequence([entry(1, "https://a.example/"), entry(2, "https://b.example/x")], []), null);
});
