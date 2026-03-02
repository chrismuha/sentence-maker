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
const breakConfirmation = document.getElementById("breakConfirmation");
const blankLineSetting = document.getElementById("blankLineSetting");

let shortcutKey = null; // normalized (lowercase) key name
let pendingShortcut = null;
let insertBlankLines = false;
let pendingInsertBlankLines = false;
const pressedKeys = new Set();
let notAllowedTimeout = null;
let breakConfirmationTimeout = null;
const STORAGE_KEY = "sentenceMakerSettings";

breakBtn.addEventListener("click", breakSentences);
settingsBtn.addEventListener("click", openSettings);
closeSettings.addEventListener("click", hideSettings);
backdrop.addEventListener("click", hideSettings);
saveShortcut.addEventListener("click", () => {
  applySettings(pendingShortcut, pendingInsertBlankLines);
  hideSettings();
});
clearShortcut.addEventListener("click", () => {
  pendingShortcut = null;
  shortcutInput.value = "";
});
blankLineSetting.addEventListener("change", event => {
  pendingInsertBlankLines = Boolean(event.target.checked);
});
shortcutInput.addEventListener("keydown", event => {
  // Reset if we hit a fresh modifier chord to avoid stale keys
  if (event.metaKey || event.altKey || event.ctrlKey) {
    pressedKeys.clear();
  }
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

  editor.value = separated.join(insertBlankLines ? "\n\n" : "\n");
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  editor.focus();
  showBreakConfirmation(separated.length);
}

function openSettings() {
  pendingShortcut = shortcutKey;
  pendingInsertBlankLines = insertBlankLines;
  shortcutInput.value = pendingShortcut ? formatKey(pendingShortcut) : "";
  blankLineSetting.checked = pendingInsertBlankLines;
  pressedKeys.clear();
  settingsPanel.classList.remove("hidden");
  backdrop.classList.remove("hidden");
  shortcutInput.focus();
}

function hideSettings() {
  pressedKeys.clear();
  settingsPanel.classList.add("hidden");
  backdrop.classList.add("hidden");
}

function applySettings(normalizedKey, useBlankLines) {
  shortcutKey = normalizedKey || null;
  insertBlankLines = Boolean(useBlankLines);
  saveSettings();
  updateHint();
}

function captureShortcut(event) {
  event.preventDefault();
  const normalized = normalizeKeyEvent(event, { pressedKeys });

  if (!normalized || normalized === "__pending_combo__" || normalized === "__modifier_only__") {
    const previous = pendingShortcut;
    clearTimeout(notAllowedTimeout);
    shortcutInput.value = "Not allowed";
    notAllowedTimeout = setTimeout(() => {
      if (pendingShortcut === previous) {
        shortcutInput.value = previous ? formatKey(previous) : "";
      }
    }, 800);
    return;
  }

  clearTimeout(notAllowedTimeout);
  pendingShortcut = normalized;
  shortcutInput.value = formatKey(pendingShortcut);
  pressedKeys.clear();
}

function normalizeKeyEvent(event, { disallowPlainAlphaNum = true, pressedKeys: heldKeys } = {}) {
  const code = (event.code || "").toLowerCase();
  const rawKey = (event.key || "").toLowerCase();
  let key = rawKey;
  const useMeta = event.metaKey || (heldKeys && heldKeys.has("meta"));
  const useAlt = event.altKey || (heldKeys && heldKeys.has("alt") || heldKeys && heldKeys.has("option"));
  const useCtrl = event.ctrlKey || (heldKeys && (heldKeys.has("ctrl") || heldKeys.has("control")));
  const hasSystemModifier = useMeta || useAlt || useCtrl;
  const hasModifier = hasSystemModifier || event.shiftKey;

  if (key === "shift") {
    if (useMeta) return "meta+shift";
    if (useAlt) return "alt+shift";
    if (useCtrl) return "ctrl+shift";
    return "__modifier_only__"; // block Shift alone
  }

  if (key === "control" || key === "meta" || key === "alt") {
    if (event.shiftKey) {
      const parts = [];
      if (key === "meta") parts.push("meta");
      if (key === "control") parts.push("ctrl");
      if (key === "alt") parts.push("alt");
      parts.push("shift");
      return parts.join("+");
    }
    return "__modifier_only__";
  }
  if (key.startsWith("arrow") || key === "tab") return "";

  if (rawKey === " " || rawKey === "spacebar" || rawKey === "space") {
    key = "space";
  }

  // Option/Cmd sometimes produce symbols; fallback to code to keep base key
  if ((event.altKey || event.metaKey) && key.length === 1 && !/[a-z0-9]/.test(key)) {
    if (code.startsWith("key") && code.length === 4) {
      key = code.slice(3);
    } else if (code.startsWith("digit") && code.length === 6) {
      key = code.slice(5);
    }
  }

  const isAlphaNum = key.length === 1 && /[a-z0-9]/.test(key);
  const isSymbol = key.length === 1 && !/[a-z0-9]/.test(key) && key !== "space";

  // Allow dual-character/symbol combos when no system modifier is held
  if (!hasSystemModifier && heldKeys && heldKeys.size >= 2) {
    const filtered = Array.from(heldKeys)
      .map(k => {
        const val = (k || "").toLowerCase();
        if (val === " " || val === "spacebar" || val === "space") return "space";
        if (val === "backspace") return "backspace";
        if (val.length === 1 && val.trim().length === 1) return val;
        return "";
      })
      .filter(Boolean)
      .filter(k => k !== "shift" && k !== "control" && k !== "meta" && k !== "alt");

    if (filtered.length >= 2) {
      const combo = Array.from(new Set(filtered)).sort();
      return combo.join("+");
    }
  }

  if (!hasSystemModifier && (isSymbol || (disallowPlainAlphaNum && isAlphaNum)) && heldKeys && heldKeys.size === 1) {
    return "__pending_combo__";
  }
  if (!hasSystemModifier && disallowPlainAlphaNum && isAlphaNum && !hasModifier) return "";

  const parts = [];
  if (useMeta) parts.push("meta");
  if (useCtrl) parts.push("ctrl");
  if (useAlt) parts.push("alt");
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
      if (part === "meta") return "Alt/Cmd";
      if (part.length === 1) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" + ");
}

function updateHint() {
  if (!shortcutKey) {
    shortcutHint.textContent = insertBlankLines
      ? "No keyboard shortcut assigned. Break adds blank lines between sentences."
      : "No keyboard shortcut assigned.";
    return;
  }

  const keyLabel = formatKey(shortcutKey);
  if (shortcutKey === "enter") {
    shortcutHint.textContent = `${keyLabel} will break sentences; it will not insert blank lines in the editor.`;
  } else if (shortcutKey === "space") {
    shortcutHint.textContent = `${keyLabel} will break sentences; it will not insert spaces in the editor.`;
  } else if (shortcutKey === "backspace") {
    shortcutHint.textContent = `${keyLabel} will break sentences; it will not delete text in the editor.`;
  } else {
    shortcutHint.textContent = `Shortcut: ${keyLabel} will break sentences.`;
  }

  if (insertBlankLines) {
    shortcutHint.textContent += " Output will include blank lines between sentences.";
  }
}

function showBreakConfirmation(sentenceCount) {
  clearTimeout(breakConfirmationTimeout);
  if (sentenceCount === 0) {
    breakConfirmation.textContent = "No sentences found to break.";
  } else if (sentenceCount === 1) {
    breakConfirmation.textContent = "Break complete: 1 sentence.";
  } else {
    breakConfirmation.textContent = `Break complete: ${sentenceCount} sentences.`;
  }
  breakConfirmation.classList.remove("hidden");
  breakConfirmationTimeout = setTimeout(() => {
    breakConfirmation.classList.add("hidden");
  }, 1800);
}

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        shortcutKey,
        insertBlankLines
      })
    );
  } catch {
    // Ignore persistence errors; the app can still run in-memory.
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.shortcutKey === "string") {
      shortcutKey = parsed.shortcutKey;
    }
    if (typeof parsed.insertBlankLines === "boolean") {
      insertBlankLines = parsed.insertBlankLines;
      pendingInsertBlankLines = parsed.insertBlankLines;
    }
  } catch {
    // Ignore malformed or unavailable saved settings.
  }
}

loadSettings();
updateHint();
