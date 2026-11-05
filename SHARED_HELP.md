# Shared Help

This app uses the suite Help standard: Contact us, Report an issue, Known issues, Coming soon, and Tips & troubleshooting. Open Help to browse these sections. Close or Escape returns to the app. Existing user guides and release notes remain available.

Coming soon contains planned features that are not available yet. Empty Known issues and Coming soon lists mean no entries are currently listed; they do not promise that the app has no bugs or that no further features will be added. Issue reporting opens an email draft for the user to review and send; it does not send a report automatically.

Vue apps use the identical portable `SuiteHelp.vue` owned by `MCR SOFTWARE SUITE/ProfitPulse/src/components/SuiteHelp.vue`. Supply project content through the existing adapter/content file; do not edit the shared layout for one app. New standalone integrations store app content under `shared-help/content.json`; version labels come from package.json. Native apps use the equivalent `suite-help.js` interface, with app content in their existing Help details file or native adapter.

Keep documented issues, planned features, user guides, and release notes in sync. Preserve the app’s support contact overrides. No app version or installer release is changed by adopting this Help interface.

## Help access update · November 4, 2026

Standalone floating Help launchers now use a compact 44px-wide tab on the right edge above the bottom controls. Tap it or focus it with the keyboard to open the same five Help sections. Existing inline Help buttons keep their location. Close or Escape returns focus to Help. This access change does not change the app version.
