import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appScript = fs.readFileSync(new URL("../script/script.js", import.meta.url), "utf8");

function createApp() {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://127.0.0.1:5184/",
  });

  dom.window.sentenceMakerSettings = {
    load: async () => ({}),
    save: async () => {},
    getFileStatus: async () => ({}),
    getAppVersion: async () => "1.0.0",
  };
  dom.window.eval(appScript);
  return dom;
}

test("primary editor and settings dialog expose accessible names", () => {
  const dom = createApp();
  const { document } = dom.window;

  assert.equal(document.querySelector("#editor").getAttribute("aria-label"), "Sentence text");
  assert.equal(document.querySelector("#settingsPanel").getAttribute("aria-labelledby"), "settingsDialogTitle");
  assert.equal(document.querySelector("#settingsDialogTitle").textContent.trim(), "Sentence Maker");
  dom.window.close();
});

test("Break separates sentences and reports completion", () => {
  const dom = createApp();
  const { document } = dom.window;
  const editor = document.querySelector("#editor");

  editor.textContent = "First sentence. Second sentence?";
  document.querySelector("#breakBtn").click();

  assert.equal(document.querySelector("#breakConfirmation").textContent, "Break complete: 2 sentences.");
  assert.equal(editor.querySelectorAll("br").length, 2);
  assert.match(editor.textContent, /First sentence\./);
  assert.match(editor.textContent, /Second sentence\?/);
  dom.window.close();
});

test("Clear removes editor content and prior status", () => {
  const dom = createApp();
  const { document } = dom.window;
  const editor = document.querySelector("#editor");

  editor.textContent = "A sentence.";
  document.querySelector("#breakBtn").click();
  document.querySelector("#clearTextBtn").click();

  assert.equal(editor.textContent, "");
  assert.equal(document.querySelector("#breakConfirmation").textContent, "");
  dom.window.close();
});

test("Settings opens and closes through visible controls", () => {
  const dom = createApp();
  const { document } = dom.window;
  const settings = document.querySelector("#settingsPanel");

  document.querySelector("#settingsBtn").click();
  assert.equal(settings.classList.contains("hidden"), false);

  document.querySelector("#closeSettings").click();
  assert.equal(settings.classList.contains("hidden"), true);
  dom.window.close();
});

