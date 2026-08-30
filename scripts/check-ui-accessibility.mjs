import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const { document } = new JSDOM(html).window;

function hasAccessibleName(element) {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return true;

  const labelledBy = element.getAttribute("aria-labelledby")?.trim();
  if (labelledBy) {
    return labelledBy.split(/\s+/).every(id => document.getElementById(id)?.textContent.trim());
  }

  if (element.id) {
    const explicitLabel = document.querySelector(`label[for="${element.id}"]`);
    if (explicitLabel?.textContent.trim()) return true;
  }

  return Boolean(element.closest("label")?.textContent.trim());
}

for (const element of document.querySelectorAll('[role="textbox"], input, select, textarea')) {
  assert.ok(hasAccessibleName(element), `${element.tagName.toLowerCase()}#${element.id || "(no id)"} needs an accessible name`);
}

for (const dialog of document.querySelectorAll('[role="dialog"]')) {
  assert.ok(hasAccessibleName(dialog), `dialog#${dialog.id || "(no id)"} needs an accessible title`);
}

for (const button of document.querySelectorAll("button")) {
  assert.ok(hasAccessibleName(button) || button.textContent.trim(), `button#${button.id || "(no id)"} needs an accessible name`);
}

console.log("UI accessibility checks passed.");

