export default {
  "appName": "Sentence Maker",
  "theme": "light",
  "knownIssues": [],
  "usageTips": [
    {
      "title": "Splitting follows punctuation",
      "description": "Break splits text at enabled sentence endings. Fragments without a selected ending remain highlighted for correction; this is punctuation-based splitting rather than a grammar parser."
    },
    {
      "title": "Copy your text before closing",
      "description": "The settings file stores preferences, not editor text. Copy needed text to another app before closing. Running Break rebuilds the output as text with line breaks and fragment highlighting."
    }
  ],
  "troubleshooting": [
    "Check that an enabled sentence-ending character occurs in the text before choosing Break.",
    "Review the assigned keyboard shortcut in Settings if Enter, Space, or Backspace triggers Break.",
    "Correct highlighted fragments and run Break again."
  ]
};
