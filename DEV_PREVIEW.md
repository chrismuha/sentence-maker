# Web development preview

Open the project's existing web-preview command, then select a device.

- Device presets and Custom keep the selected width and height in CSS pixels when the browser window is narrowed, restored, or maximized. The surrounding device shell scales to fit the available width and height.
- Current device fills the browser area below the preview toolbar at full scale and follows window resizing. The app adapts to that actual viewport.
- Rotation swaps the selected dimensions. Existing device choices, simulated cutouts, safe-area settings, and project selectors remain available.
- Overflow status describes the embedded app content. App content and reading views may intentionally scroll.

The portable `dev-preview-layout.js` module beside the preview page handles shell sizing. Keep its copies identical across projects. Preview tools do not change application navigation colors or application layout rules.

To verify: select every preset in a large and a narrow browser window, check that the displayed CSS dimensions stay constant, rotate, try a Custom size, then switch to Current device and resize the window. The preview shell should fit without adding outer scrolling. Current device should fill the available area without a scaling transform.
