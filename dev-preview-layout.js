/* Portable dev-preview shell. Keep copies identical across projects. */
(() => {
  const device = document.querySelector('#device');
  const canvas = document.querySelector('main');
  const preset = document.querySelector('#preset');
  if (!device || !canvas || !preset) return;

  const style = document.createElement('style');
  style.textContent = `
    .device-stage { position: relative; overflow: clip; }
    .device { position: absolute; inset: 0 auto auto 0; transform: scale(var(--preview-scale, 1)); transform-origin: top left; transition: none; }
    main.current-device .device-stage { width: 100%; height: 100%; }
    .device.current-device { transform: none; }
    .toolbar > label, header > label { min-width: 0; max-width: 100%; }
    select { max-width: 100%; }
  `;
  document.head.append(style);
  const stage = document.createElement('div');
  stage.className = 'device-stage';
  device.before(stage);
  stage.append(device);

  const setStyle = (element, property, value) => {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  };
  function fitPreview() {
    if (preset.value === 'current') {
      device.style.removeProperty('--preview-scale');
      stage.style.removeProperty('width');
      stage.style.removeProperty('height');
      return;
    }
    const naturalWidth = device.offsetWidth;
    const naturalHeight = device.offsetHeight;
    if (!naturalWidth || !naturalHeight) return;
    const css = getComputedStyle(canvas);
    const availableWidth = Math.max(1, canvas.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight));
    const availableHeight = Math.max(1, canvas.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom));
    // Only the shell is scaled. The app keeps the selected CSS viewport.
    const scale = Math.floor(Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight) * 10000) / 10000;
    setStyle(device, '--preview-scale', String(scale));
    setStyle(stage, 'width', `${Math.ceil(naturalWidth * scale)}px`);
    setStyle(stage, 'height', `${Math.ceil(naturalHeight * scale)}px`);
  }
  const observer = new ResizeObserver(fitPreview);
  observer.observe(canvas);
  observer.observe(device);
  new MutationObserver(fitPreview).observe(device, { attributes: true, attributeFilter: ['class', 'style'] });
  preset.addEventListener('change', fitPreview);
  window.addEventListener('resize', fitPreview);
  fitPreview();
})();
