// Display dimensions from Electron are already in device-independent pixels.
// Apply native limits once; setBounds inside will-resize can re-enter resizing.
function fitWindowToWorkArea(display = {}, preferred = {}) {
  const area = display.workAreaSize || display.workArea || { width: 1280, height: 800 };
  const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
  const availableWidth = positive(area.width, 1280), availableHeight = positive(area.height, 800);
  const minWidth = Math.min(positive(preferred.minWidth, 360), availableWidth);
  const minHeight = Math.min(positive(preferred.minHeight, 320), availableHeight);
  return { width: Math.min(availableWidth, Math.max(minWidth, positive(preferred.width, 1100))), height: Math.min(availableHeight, Math.max(minHeight, positive(preferred.height, 800))), minWidth, minHeight };
}
function customerDisplayLayout(area) {
  const { width, height } = fitWindowToWorkArea({ workArea: area }, { width: area.width, height: area.height });
  const origin = { x: Number(area.x) || 0, y: Number(area.y) || 0 };
  if (width >= 1120) {
    const half = Math.floor(width / 2);
    return { cashier: { ...origin, width: half, height }, customer: { x: origin.x + half, y: origin.y, width: width - half, height } };
  }
  const customerWidth = Math.min(640, width), customerHeight = Math.min(700, height);
  return { cashier: null, customer: { x: origin.x + Math.floor((width - customerWidth) / 2), y: origin.y + Math.floor((height - customerHeight) / 2), width: customerWidth, height: customerHeight } };
}
module.exports = { fitWindowToWorkArea, customerDisplayLayout };
