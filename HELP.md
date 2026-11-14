# Help screen

The Help button opens Contact us, Report an issue, Known issues, and Tips & troubleshooting.

Edit `help-details.js` for this program’s name, theme, known issues, usage tips, and troubleshooting checklist. The version comes from this project’s package.json. An empty known-issues array displays a message that no confirmed issues are currently listed; do not copy another program’s issue list into this project.

`suite-help.js and suite-help.css` provides the shared presentation copied from Profit Pulse. Keep its layout, contact cards, modal navigation, and styles consistent across the suite. Updates to copied files are not automatic. The plain JavaScript adapters use the same stylesheet and contact-card markup, isolated in Shadow DOM.

Report an issue prepares an email draft with this program’s name and version. It does not send the report.

## Fixed issues and bug reports

Open Help → Known issues to see documented problems and the Fixed section. Each completed fix can show its version, what happened, a **How we fixed it** explanation, and **What this means for you** notes. Only verified fixes belong here; an empty section means none are currently listed. Existing unresolved issues remain under Known issues.

Use the small **🐛 Bug Report** button at the bottom of the Help window from any section. It opens Report an issue inside the same window, where you can prepare an email draft, review it, and send it from your email app. It never sends a report automatically. Close or Escape returns to the program.
