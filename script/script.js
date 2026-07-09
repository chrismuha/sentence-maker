const editor = document.getElementById("editor");
const breakBtn = document.getElementById("breakBtn");
const clearTextBtn = document.getElementById("clearTextBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const backdrop = document.getElementById("backdrop");
const shortcutInput = document.getElementById("shortcutInput");
const resetSettings = document.getElementById("resetSettings");
const closeSettings = document.getElementById("closeSettings");
const shortcutHint = document.getElementById("shortcutHint");
const breakConfirmation = document.getElementById("breakConfirmation");
const blankLineSetting = document.getElementById("blankLineSetting");
const alphabeticalSortSetting = document.getElementById("alphabeticalSortSetting");
const preservePasteFormattingSetting = document.getElementById("preservePasteFormattingSetting");
const endingSettings = Array.from(document.querySelectorAll("[data-ending-character]"));
const customEndingInput = document.getElementById("customEndingInput");
const settingsFileDir = document.getElementById("settingsFileDir");
const settingsFilePath = document.getElementById("settingsFilePath");
const browseSettingsFileDir = document.getElementById("browseSettingsFileDir");
const resetSettingsFileDir = document.getElementById("resetSettingsFileDir");

let shortcutKey = null; // normalized (lowercase) key name
let insertBlankLines = true;
let sortAlphabetically = false;
let preservePasteFormatting = true;
const DEFAULT_SENTENCE_ENDING_CHARACTERS = [".", ";", "?", "!", ":", "\""];
let sentenceEndingCharacters = [...DEFAULT_SENTENCE_ENDING_CHARACTERS];
const pressedKeys = new Set();
let notAllowedTimeout = null;
let breakConfirmationTimeout = null;
let failedSentenceBeingEdited = null;
const BREAK_CONFIRMATION_MS = 5000;
const CLOSING_SENTENCE_WRAPPERS = new Set([")", "]", "}", "\"", "'", "”", "’", "»"]);
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function getFocusableElements() {
  return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(element => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function handleTabAndEscapeFocus(event) {
  if (event.defaultPrevented) return;

  if (event.key === "Escape") {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && typeof active.blur === "function") {
      active.blur();
    }
    return;
  }

  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;

  const focusable = getFocusableElements();
  const currentIndex = focusable.indexOf(document.activeElement);
  if (currentIndex === -1 || focusable.length < 2) return;

  const target = event.shiftKey && currentIndex === 0
    ? focusable[focusable.length - 1]
    : !event.shiftKey && currentIndex === focusable.length - 1
      ? focusable[0]
      : null;

  if (!target) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
}

breakBtn.addEventListener("click", breakSentences);
clearTextBtn.addEventListener("click", clearEditorText);
settingsBtn.addEventListener("click", openSettings);
closeSettings.addEventListener("click", hideSettings);
backdrop.addEventListener("click", hideSettings);
resetSettings.addEventListener("click", resetPendingSettingsToDefaults);
browseSettingsFileDir.addEventListener("click", browseSettingsLocation);
resetSettingsFileDir.addEventListener("click", resetSettingsLocation);
blankLineSetting.addEventListener("change", event => {
  applySettings({ insertBlankLines: Boolean(event.target.checked) });
});
alphabeticalSortSetting.addEventListener("change", event => {
  applySettings({ sortAlphabetically: Boolean(event.target.checked) });
});
preservePasteFormattingSetting.addEventListener("change", event => {
  applySettings({ preservePasteFormatting: Boolean(event.target.checked) });
});
endingSettings.forEach(input => {
  input.addEventListener("change", updatePendingSentenceEndings);
});
customEndingInput.addEventListener("input", updatePendingSentenceEndings);
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
  handleTabAndEscapeFocus(event);
  pressedKeys.add((event.key || "").toLowerCase());

  if (!shortcutKey) return;
  if (!settingsPanel.classList.contains("hidden")) return;
  if (event.target === shortcutInput) return;
  if (event.target === editor && !hasSystemModifier(event)) return;

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
editor.addEventListener("beforeinput", event => {
  failedSentenceBeingEdited = getSelectedFailedSentence();
});
editor.addEventListener("paste", event => {
  failedSentenceBeingEdited = getSelectedFailedSentence();

  if (preservePasteFormatting) return;

  const text = event.clipboardData?.getData("text/plain") || "";
  event.preventDefault();
  insertPlainTextAtSelection(text);
  if (failedSentenceBeingEdited?.isConnected) {
    resetFailedSentenceColor(failedSentenceBeingEdited);
    failedSentenceBeingEdited = null;
  }
});
editor.addEventListener("input", () => {
  const editedFailedSentence = failedSentenceBeingEdited?.isConnected
    ? failedSentenceBeingEdited
    : getSelectedFailedSentence();

  if (editedFailedSentence?.isConnected) {
    resetFailedSentenceColor(editedFailedSentence);
    failedSentenceBeingEdited = null;
  }
});

function hasSystemModifier(event) {
  return event.metaKey || event.ctrlKey || event.altKey;
}

function clearEditorText() {
  editor.replaceChildren();
  failedSentenceBeingEdited = null;
  clearBreakMessage();
  editor.focus();
}

function breakSentences() {
  clearBreakMessage();
  const text = getEditorText().trim();
  const activeSentenceEndings = getSentenceEndingSet();

  if (activeSentenceEndings.size === 0) {
    showBreakError("Choose at least one sentence ending in Settings.");
    editor.focus();
    return;
  }

  if (text.length > 0 && !hasAnySentenceEnding(text, activeSentenceEndings)) {
    showBreakError(`Add at least one sentence ending (${formatSentenceEndings(sentenceEndingCharacters)}) before breaking sentences.`);
    editor.focus();
    return;
  }

  const { breakableSentences, unbrokenSentences } = getSentenceBreakGroups(text, activeSentenceEndings);

  if (breakableSentences.length === 0) {
    showBreakError(`Add a sentence ending (${formatSentenceEndings(sentenceEndingCharacters)}) to at least one sentence before breaking.`);
    editor.focus();
    return;
  }

  if (sortAlphabetically) {
    breakableSentences.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  setBrokenEditorContent(breakableSentences, unbrokenSentences);
  placeCaretAtEnd(editor);
  editor.focus();
  if (unbrokenSentences.length > 0) {
    showBreakWarning(`Some sentences were not broken because they did not have a selected sentence ending (${formatSentenceEndings(sentenceEndingCharacters)}). Check sentences and try again.`);
  } else {
    showBreakConfirmation(breakableSentences.length);
  }
}

function getEditorText() {
  return editor.innerText || editor.textContent || "";
}

function setBrokenEditorContent(breakableSentences, unbrokenSentences) {
  editor.replaceChildren();
  const outputSentences = [
    ...breakableSentences.map(sentence => ({ sentence, failed: false })),
    ...unbrokenSentences.map(sentence => ({ sentence, failed: true }))
  ];

  outputSentences.forEach(({ sentence, failed }, index) => {
    if (index > 0) {
      editor.appendChild(document.createElement("br"));
      if (insertBlankLines) {
        editor.appendChild(document.createElement("br"));
      }
    }

    if (failed) {
      const span = document.createElement("span");
      span.className = "failed-sentence";
      span.textContent = sentence;
      editor.appendChild(span);
    } else {
      editor.appendChild(document.createTextNode(sentence));
    }
  });
}

function insertPlainTextAtSelection(text) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  selection.deleteFromDocument();
  const range = selection.getRangeAt(0);
  const lines = text.split(/\r?\n/);
  const fragment = document.createDocumentFragment();
  let lastNode = null;

  lines.forEach((line, index) => {
    if (index > 0) {
      lastNode = document.createElement("br");
      fragment.appendChild(lastNode);
    }
    lastNode = document.createTextNode(line);
    fragment.appendChild(lastNode);
  });

  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function getSelectedFailedSentence() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const node = selection.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.(".failed-sentence") || getAdjacentFailedSentence(selection);
}

function getAdjacentFailedSentence(selection) {
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  if (container !== editor) return null;

  const previous = editor.childNodes[range.startOffset - 1];
  const next = editor.childNodes[range.startOffset];
  if (previous?.classList?.contains("failed-sentence")) return previous;
  if (next?.classList?.contains("failed-sentence")) return next;
  return null;
}

function resetFailedSentenceColor(span) {
  span.classList.remove("failed-sentence");
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getSentenceBreakGroups(text, sentenceEndings = getSentenceEndingSet()) {
  const breakableSentences = [];
  const unbrokenSentences = [];
  const lines = text.split(/\r?\n/g).map(line => line.trim()).filter(Boolean);

  lines.forEach(line => {
    const sentences = splitLineIntoSentences(line, sentenceEndings);
    sentences.forEach(sentence => {
      if (endsWithSentenceEnding(sentence, sentenceEndings)) {
        breakableSentences.push(sentence);
      } else {
        unbrokenSentences.push(sentence);
      }
    });
  });

  return { breakableSentences, unbrokenSentences };
}

function splitLineIntoSentences(line, sentenceEndings) {
  const sentences = [];
  let sentenceStart = 0;

  for (let index = 0; index < line.length; index += 1) {
    if (!sentenceEndings.has(line[index])) continue;

    let sentenceEnd = index + 1;
    while (sentenceEnd < line.length && CLOSING_SENTENCE_WRAPPERS.has(line[sentenceEnd])) {
      sentenceEnd += 1;
    }

    if (sentenceEnd === line.length || /\s/.test(line[sentenceEnd])) {
      const sentence = line.slice(sentenceStart, sentenceEnd).trim();
      if (sentence) sentences.push(sentence);
      sentenceStart = sentenceEnd;
      while (sentenceStart < line.length && /\s/.test(line[sentenceStart])) {
        sentenceStart += 1;
      }
      index = sentenceStart - 1;
    }
  }

  const remainder = line.slice(sentenceStart).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

function endsWithSentenceEnding(sentence, sentenceEndings) {
  for (let index = sentence.length - 1; index >= 0; index -= 1) {
    const character = sentence[index];
    if (CLOSING_SENTENCE_WRAPPERS.has(character)) continue;
    return sentenceEndings.has(character);
  }
  return false;
}

function hasAnySentenceEnding(text, sentenceEndings) {
  for (const character of text) {
    if (sentenceEndings.has(character)) return true;
  }
  return false;
}

function getSentenceEndingSet() {
  return new Set(sentenceEndingCharacters);
}

function normalizeSentenceEndings(value) {
  if (!Array.isArray(value)) return [...DEFAULT_SENTENCE_ENDING_CHARACTERS];
  return Array.from(new Set(value.filter(character => typeof character === "string").flatMap(character => Array.from(character.trim()))));
}

function getCustomSentenceEndingsFromInput() {
  const builtInCharacters = new Set(endingSettings.map(input => input.dataset.endingCharacter));
  return Array.from(customEndingInput.value).filter(character => character.trim() && !builtInCharacters.has(character));
}

function updatePendingSentenceEndings() {
  applySettings({
    sentenceEndingCharacters: [
      ...endingSettings.filter(input => input.checked).map(input => input.dataset.endingCharacter),
      ...getCustomSentenceEndingsFromInput()
    ]
  });
}

function syncSentenceEndingControls(characters) {
  const selected = new Set(characters);
  const builtInCharacters = new Set(endingSettings.map(input => input.dataset.endingCharacter));

  endingSettings.forEach(input => {
    input.checked = selected.has(input.dataset.endingCharacter);
  });
  customEndingInput.value = characters.filter(character => !builtInCharacters.has(character)).join("");
}

function formatSentenceEndings(characters) {
  return characters.length > 0 ? characters.join(" ") : "none selected";
}

function resetPendingSettingsToDefaults() {
  applySettings({
    shortcutKey: null,
    insertBlankLines: true,
    sortAlphabetically: false,
    preservePasteFormatting: true,
    sentenceEndingCharacters: [...DEFAULT_SENTENCE_ENDING_CHARACTERS]
  });
  shortcutInput.value = "";
  blankLineSetting.checked = insertBlankLines;
  alphabeticalSortSetting.checked = sortAlphabetically;
  preservePasteFormattingSetting.checked = preservePasteFormatting;
  syncSentenceEndingControls(sentenceEndingCharacters);
}

function openSettings() {
  shortcutInput.value = shortcutKey ? formatKey(shortcutKey) : "";
  blankLineSetting.checked = insertBlankLines;
  alphabeticalSortSetting.checked = sortAlphabetically;
  preservePasteFormattingSetting.checked = preservePasteFormatting;
  syncSentenceEndingControls(sentenceEndingCharacters);
  refreshSettingsLocation().catch(() => {
    updateSettingsLocationReadout();
  });
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

function applySettings(nextSettings = {}) {
  if (Object.prototype.hasOwnProperty.call(nextSettings, "shortcutKey")) {
    shortcutKey = nextSettings.shortcutKey || null;
  }
  if (Object.prototype.hasOwnProperty.call(nextSettings, "insertBlankLines")) {
    insertBlankLines = Boolean(nextSettings.insertBlankLines);
  }
  if (Object.prototype.hasOwnProperty.call(nextSettings, "sortAlphabetically")) {
    sortAlphabetically = Boolean(nextSettings.sortAlphabetically);
  }
  if (Object.prototype.hasOwnProperty.call(nextSettings, "preservePasteFormatting")) {
    preservePasteFormatting = Boolean(nextSettings.preservePasteFormatting);
  }
  if (Object.prototype.hasOwnProperty.call(nextSettings, "sentenceEndingCharacters")) {
    sentenceEndingCharacters = normalizeSentenceEndings(nextSettings.sentenceEndingCharacters);
  }
  saveSettings().catch(() => {
    // Ignore persistence errors; the app can still run in-memory.
  });
  updateHint();
}

function updateSettingsLocationReadout(status = {}) {
  if (settingsFileDir) {
    settingsFileDir.value = status.settingsDir || "Unavailable";
  }
  if (settingsFilePath) {
    settingsFilePath.textContent = status.settingsPath || "Unavailable";
  }
}

async function refreshSettingsLocation() {
  if (!window.sentenceMakerSettings?.getFileStatus) {
    updateSettingsLocationReadout();
    return;
  }

  updateSettingsLocationReadout(await window.sentenceMakerSettings.getFileStatus());
}

async function browseSettingsLocation() {
  if (!window.sentenceMakerSettings?.setFileDir) return;

  const status = await window.sentenceMakerSettings.setFileDir();
  if (status) {
    updateSettingsLocationReadout(status);
    await loadSettings();
    openSettings();
  }
}

async function resetSettingsLocation() {
  if (!window.sentenceMakerSettings?.resetFileDir) return;

  const status = await window.sentenceMakerSettings.resetFileDir();
  updateSettingsLocationReadout(status);
  await loadSettings();
  openSettings();
}

function captureShortcut(event) {
  event.preventDefault();
  const normalized = normalizeKeyEvent(event, { pressedKeys });

  if (!normalized || normalized === "__pending_combo__" || normalized === "__modifier_only__") {
    const previous = shortcutKey;
    clearTimeout(notAllowedTimeout);
    shortcutInput.value = "Not allowed";
    notAllowedTimeout = setTimeout(() => {
      if (shortcutKey === previous) {
        shortcutInput.value = previous ? formatKey(previous) : "";
      }
    }, 800);
    return;
  }

  clearTimeout(notAllowedTimeout);
  applySettings({ shortcutKey: normalized });
  shortcutInput.value = formatKey(shortcutKey);
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
    shortcutHint.textContent = "No keyboard shortcut assigned.";
    appendOutputHint();
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

  appendOutputHint();
}

function appendOutputHint() {
  if (insertBlankLines) {
    shortcutHint.textContent += " Break adds blank lines between sentences.";
  }
  if (sortAlphabetically) {
    shortcutHint.textContent += " Break sorts sentences alphabetically.";
  }
}

function showBreakConfirmation(sentenceCount) {
  clearTimeout(breakConfirmationTimeout);
  breakConfirmation.classList.remove("error");
  breakConfirmation.classList.remove("warning");
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
  }, BREAK_CONFIRMATION_MS);
}

function showBreakWarning(message) {
  clearBreakMessage();
  breakConfirmation.textContent = message;
  breakConfirmation.classList.remove("error");
  breakConfirmation.classList.add("warning");
  breakConfirmation.classList.remove("hidden");
}

function showBreakError(message) {
  clearBreakMessage();
  breakConfirmation.textContent = message;
  breakConfirmation.classList.remove("warning");
  breakConfirmation.classList.add("error");
  breakConfirmation.classList.remove("hidden");
}

function clearBreakMessage() {
  clearTimeout(breakConfirmationTimeout);
  breakConfirmation.textContent = "";
  breakConfirmation.classList.add("hidden");
  breakConfirmation.classList.remove("error");
  breakConfirmation.classList.remove("warning");
}

async function saveSettings() {
  if (!window.sentenceMakerSettings?.save) return;

  await window.sentenceMakerSettings.save({
    shortcutKey,
    insertBlankLines,
    sortAlphabetically,
    preservePasteFormatting,
    sentenceEndingCharacters
  });
}

async function loadSettings() {
  try {
    if (!window.sentenceMakerSettings?.load) return;

    const parsed = await window.sentenceMakerSettings.load();
    if (typeof parsed.shortcutKey === "string") {
      shortcutKey = parsed.shortcutKey;
    }
    if (typeof parsed.insertBlankLines === "boolean") {
      insertBlankLines = parsed.insertBlankLines;
    }
    if (typeof parsed.sortAlphabetically === "boolean") {
      sortAlphabetically = parsed.sortAlphabetically;
    }
    if (typeof parsed.preservePasteFormatting === "boolean") {
      preservePasteFormatting = parsed.preservePasteFormatting;
    }
    if (Array.isArray(parsed.sentenceEndingCharacters)) {
      sentenceEndingCharacters = normalizeSentenceEndings(parsed.sentenceEndingCharacters);
    }
  } catch {
    // Ignore malformed or unavailable saved settings.
  }
}

loadSettings().finally(() => {
  updateHint();
});
