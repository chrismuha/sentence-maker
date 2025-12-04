const editor = document.getElementById("editor");
const breakBtn = document.getElementById("breakBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const backdrop = document.getElementById("backdrop");
const shortcutInput = document.getElementById("shortcutInput");
const saveShortcut = document.getElementById("saveShortcut");
const clearShortcut = document.getElementById("clearShortcut");
const closeSettings = document.getElementById("closeSettings");
const shortcutHint = document.getElementById("shortcutHint");

let shortcutKey = null; // normalized (lowercase) key name
let pendingShortcut = null;
const pressedKeys = new Set();

breakBtn.addEventListener("click", breakSentences);
settingsBtn.addEventListener("click", openSettings);
closeSettings.addEventListener("click", hideSettings);
backdrop.addEventListener("click", hideSettings);
saveShortcut.addEventListener("click", () => {
  applyShortcut(pendingShortcut);
  hideSettings();
});
clearShortcut.addEventListener("click", () => {
  pendingShortcut = null;
  shortcutInput.value = "";
});
shortcutInput.addEventListener("keydown", event => {
  pressedKeys.add((event.key || "").toLowerCase());
  captureShortcut(event);
});
shortcutInput.addEventListener("keyup", event => {
  pressedKeys.delete((event.key || "").toLowerCase());
});
shortcutInput.addEventListener("blur", () => pressedKeys.clear());

document.addEventListener("keydown", event => {
  pressedKeys.add((event.key || "").toLowerCase());

  if (!shortcutKey) return;
  if (!settingsPanel.classList.contains("hidden")) return;
  if (event.target === shortcutInput) return;

  const normalized = normalizeKeyEvent(event, { pressedKeys });
  if (normalized && normalized === shortcutKey) {
    event.preventDefault();
    breakSentences();
  }
});

document.addEventListener("keyup", event => {
  pressedKeys.delete((event.key || "").toLowerCase());
});
window.addEventListener("blur", () => pressedKeys.clear());

function breakSentences() {
  const text = editor.value.trim();

  // Split on sentence-ending punctuation and trim each chunk
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
  const separated = sentences.map(sentence => sentence.trim()).filter(Boolean);

  editor.value = separated.join("\n");
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  editor.focus();
}

function openSettings() {
  pendingShortcut = shortcutKey;
  shortcutInput.value = pendingShortcut ? formatKey(pendingShortcut) : "";
  settingsPanel.classList.remove("hidden");
  backdrop.classList.remove("hidden");
  shortcutInput.focus();
}

function hideSettings() {
  settingsPanel.classList.add("hidden");
  backdrop.classList.add("hidden");
}

function applyShortcut(normalizedKey) {
  shortcutKey = normalizedKey || null;
  updateHint();
}

function captureShortcut(event) {
  event.preventDefault();
  const normalized = normalizeKeyEvent(event, { pressedKeys });

  if (normalized === "__pending_combo__") {
    return;
  }

  if (!normalized) {
    const previous = pendingShortcut;
    shortcutInput.value = "Not allowed";
    setTimeout(() => {
      shortcutInput.value = previous ? formatKey(previous) : "";
    }, 800);
    return;
  }

  pendingShortcut = normalized;
  shortcutInput.value = formatKey(pendingShortcut);
}

function normalizeKeyEvent(event, { disallowPlainAlphaNum = true, pressedKeys: heldKeys } = {}) {
  const key = (event.key || "").toLowerCase();
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
  const isAlphaNum = key.length === 1 && /[a-z0-9]/.test(key);

  if (key === "shift") return ""; // block Shift+Shift or Shift alone
  if (key === "control" || key === "meta" || key === "alt") return "";

  const isSymbol = key.length === 1 && !/[a-z0-9]/.test(key);
  if (isSymbol) return "";

  if (heldKeys && heldKeys.size >= 2) {
    const filtered = Array.from(heldKeys)
      .map(k => (k || "").toLowerCase())
      .filter(k => k.length === 1 && /[a-z0-9]/.test(k));

    if (filtered.length >= 2) {
      const combo = Array.from(new Set(filtered)).sort();
      return combo.join("+");
    }
  }

  if (disallowPlainAlphaNum && isAlphaNum && heldKeys && heldKeys.size === 1) {
    return "__pending_combo__";
  }
  if (disallowPlainAlphaNum && isAlphaNum && !hasModifier) return "";

  const parts = [];
  if (event.metaKey) parts.push("meta");
  if (event.ctrlKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");

  const mainKey = key === "return" ? "enter" : key;
  if (!mainKey) return "";

  parts.push(mainKey);
  return parts.join("+");
}

function formatKey(key) {
  if (!key) return "";
  return key
    .split("+")
    .map(part => {
      if (part.length === 1) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" + ");
}

function updateHint() {
  if (!shortcutKey) {
    shortcutHint.textContent = "No keyboard shortcut assigned.";
    return;
  }

  const keyLabel = formatKey(shortcutKey);
  if (shortcutKey === "enter") {
    shortcutHint.textContent = `${keyLabel} will break sentences; it will not insert blank lines in the editor.`;
  } else {
    shortcutHint.textContent = `Shortcut: ${keyLabel} will break sentences.`;
  }
}

updateHint();
