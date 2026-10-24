const launch = document.querySelector('#release-notes-launch');
const dialog = document.querySelector('#release-notes-dialog');
launch.addEventListener('click', () => {
  dialog.showModal();
  dialog.querySelector('.mcr-guide-content').scrollTop = 0;
  dialog.querySelector('.mcr-guide-close').focus();
});
dialog.querySelector('.mcr-guide-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
