// Lists every bookmark folder with a checkbox. Ticking one stores its id in storage.local,
// which lib/core.js in the background reads.
"use strict";

const TICKED_KEY = "tickedFolders";

// Folders only, depth first, labelled with their path. The invisible root (id "0") is skipped.
function collectFolders(node, path, out) {
  for (const child of node.children || []) {
    if (child.url) continue;
    const childPath = node.id === "0" ? [child.title] : [...path, child.title || "(untitled)"];
    out.push({ id: child.id, label: childPath.join(" / ") });
    collectFolders(child, childPath, out);
  }
  return out;
}

async function main() {
  const [tree] = await chrome.bookmarks.getTree();
  const stored = await chrome.storage.local.get(TICKED_KEY);
  const ticked = new Set(stored[TICKED_KEY] || []);
  const list = document.getElementById("folders");
  const folders = collectFolders(tree, [], []);

  document.getElementById("empty").hidden = folders.length > 0;
  for (const folder of folders) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = ticked.has(folder.id);
    input.addEventListener("change", async () => {
      const current = new Set((await chrome.storage.local.get(TICKED_KEY))[TICKED_KEY] || []);
      if (input.checked) current.add(folder.id);
      else current.delete(folder.id);
      await chrome.storage.local.set({ [TICKED_KEY]: [...current] });
    });
    const label = document.createElement("label");
    label.append(input, folder.label);
    const item = document.createElement("li");
    item.append(label);
    list.append(item);
  }
}

document.getElementById("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

main();
