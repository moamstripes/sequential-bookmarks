const manifest = JSON.parse(readFile("manifest.json"));

test("the manifest is Manifest V3 with a semantic version", () => {
  assertEqual(manifest.manifest_version, 3);
  assertTrue(/^\d+\.\d+\.\d+$/.test(manifest.version), "version is " + manifest.version);
});

test("the extension asks for no host permissions and needs no content scripts", () => {
  assertEqual(manifest.host_permissions, undefined);
  assertEqual(manifest.content_scripts, undefined);
});

test("every file the manifest points at exists", () => {
  const files = [].concat(manifest.background.scripts || [manifest.background.service_worker], Object.values(manifest.icons));
  if (manifest.action) files.push(manifest.action.default_popup);
  for (const f of files) assertTrue(fileExists(f), "missing " + f);
});

test("the shared files are identical in firefox/ and chrome/", () => {
  for (const f of ["lib/sequence.js", "lib/core.js", "test/run.js", "test/sequence.test.js"]) {
    assertEqual(readFile("../firefox/" + f) === readFile("../chrome/" + f), true, f);
  }
});
