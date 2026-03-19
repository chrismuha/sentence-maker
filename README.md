# Sentence Maker (Electron)

Simple desktop app that breaks text into individual sentences.

## Run locally
1. Install dependencies: `npm install`
2. Start the app: `npm start`

## Keyboard shortcut
- Use **Settings** and press a key to assign a shortcut for **Break** (single letters/numbers or symbols alone are blocked; pressing two together—including symbol + letter or space/backspace combos—is allowed; Shift+Shift is blocked; Alt/Cmd is allowed with another key, including with Shift).
- Leaving the field blank (or hitting **Clear**) clears the shortcut.
- If you assign Enter/Return, Space, or Backspace, pressing them will break the text instead of inserting a blank line/space or deleting text.
- The **Insert blank lines between broken sentences** setting is enabled by default.

## Settings file
- The app includes a default [`settings.json`](./settings.json).
- On launch, Sentence Maker creates and uses a writable `settings.json` in Electron's user-data folder and saves your shortcut and blank-line preference there.
