# Startup Modes

This app supports both cloud-connected startup and standalone offline startup.

- `npm run dev:cloud` starts the cloud-connected development path.
- `npm run dev:offline` starts a local/offline development path.
- `npm run start:cloud` starts the cloud-connected startup path and keeps the existing cloud/dev-server workflow.
- `npm run start:offline` starts from local bundled app resources without requiring the cloud server or remote scripts.
- Electron builds also accept `--cloud`, `--offline`, or `MCR_STARTUP_MODE=cloud|offline`.
- If cloud startup cannot load its URL, the shared startup handler falls back to the local bundled renderer file instead of crashing.

Both modes coexist in the same codebase and build output. Cloud-backed syncing and update features remain available when the cloud path is reachable; offline startup uses local bundled assets, configs, and databases.
