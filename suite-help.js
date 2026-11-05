import details from './help-details.js';
import packageInfo from './package.json';
import styles from './suite-help.css?inline';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const articles = entries => entries.map(entry => `<article><h3>${escape(entry.title)}</h3><p>${escape(entry.description)}</p></article>`).join('');
const sections = [['contact','Contact us'],['report','Report an issue'],['known','Known issues'],['coming','Coming soon'],['tips','Tips & troubleshooting']];
class SuiteHelp extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:'open'});
    const version = packageInfo.version;
    const reportUrl = 'mailto:muhachris297@gmail.com?subject='+encodeURIComponent(`${details.appName} ${version} issue report`)+'&body='+encodeURIComponent(`${details.appName} version: ${version}\nDevice and operating system:\nWorkspace or screen:\nSteps to reproduce:\n1. \nExpected result:\nActual result or exact error:\nHow often it happens:\n\nPlease remove customer, financial, and other private information from screenshots or attachments.`);
    root.innerHTML = `<style>${styles}</style>
      <button type="button" class="suite-help-trigger" data-placement="${this.style.position==='fixed'?'edge':'inline'}" data-theme="${details.theme}" aria-haspopup="dialog"><span aria-hidden="true">?</span> Help</button>
      <dialog class="suite-help-panel" data-theme="${details.theme}" aria-labelledby="suite-help-title">
        <header><div><h1 id="suite-help-title">${escape(details.appName)} Help</h1><p>Version ${escape(version)}</p></div><button type="button" class="suite-help-close" autofocus aria-label="Close Help">Close</button></header>
        <nav aria-label="Help sections">${sections.map(([id,label])=>`<button type="button" data-page="${id}" ${id==='contact'?'aria-current="page"':''}>${label}</button>`).join('')}</nav>
        <main>
          <section data-section="contact"><h2>Contact us</h2><p>Muha Computer Repair</p>
          <div class="suite-help-links">
            <a class="suite-contact-card" href="mailto:muhachris297@gmail.com">
              <span class="suite-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></span>
              <span class="suite-contact-details"><span class="suite-contact-label">Email us</span><strong>muhachris297@gmail.com</strong><span class="suite-contact-hint">Open your email app</span></span>
              <span class="suite-contact-arrow" aria-hidden="true">↗</span>
            </a>
            <a class="suite-contact-card suite-contact-phone" href="tel:+13153381919">
              <span class="suite-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 3 3 5-2 2a14 14 0 0 0 6 6l2-2 5 3-1 3c-1 3-7 0-11-4S2 6 5 4Z"/></svg></span>
              <span class="suite-contact-details"><span class="suite-contact-label">Call us</span><strong>+1 (315) 338-1919</strong><span class="suite-contact-hint">Open your phone app</span></span>
              <span class="suite-contact-arrow" aria-hidden="true">↗</span>
            </a>
            <a class="suite-contact-card suite-contact-website" href="https://muhacomputer.com/" target="_blank" rel="noopener noreferrer">
              <span class="suite-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg></span>
              <span class="suite-contact-details"><span class="suite-contact-label">Visit our website</span><strong>muhacomputer.com</strong><span class="suite-contact-hint">Opens in your browser</span></span>
              <span class="suite-contact-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
          <p>Email and phone links open your device’s email or phone app.</p></section>
          <section data-section="report" hidden><h2>Report an issue</h2><p>Tell us the screen, steps to reproduce, expected result, actual result, exact error, device, and operating system. Include whether the problem happens every time.</p><a class="suite-help-report" href="${escape(reportUrl)}">Prepare issue report email</a><p>This opens an email draft with the current version and a report template. Review it and send it from your email app. If the link does not open, email muhachris297@gmail.com with those details.</p><p>Remove customer, financial, and other private information from screenshots or attachments.</p></section>
          <section data-section="known" hidden><h2>Known issues</h2><p>Confirmed problems documented for this version appear here.</p>${articles(details.knownIssues)}${details.knownIssues.length?'':'<p>No confirmed issues are currently listed in this version’s Help. If you encounter a problem, use Report an issue.</p>'}<p>Use Report an issue to share a problem you encounter.</p></section>
          <section data-section="coming" hidden><h2>Coming soon</h2><p>Planned features are not available yet.</p>${articles(details.comingSoon || [])}${details.comingSoon?.length?'':'<p>No upcoming features are currently listed. See the user guide and release notes for available features.</p>'}</section>
          <section data-section="tips" hidden><h2>Tips &amp; troubleshooting</h2>${articles(details.usageTips)}${details.troubleshooting.length?'<h3>Troubleshooting checklist</h3><ul>'+details.troubleshooting.map(tip=>`<li>${escape(tip)}</li>`).join('')+'</ul>':''}<p>If the problem continues, use Report an issue and include the exact error and steps.</p></section>
        </main>
      </dialog>`;
    const dialog = root.querySelector('dialog');
    const trigger = root.querySelector('.suite-help-trigger');
    trigger.addEventListener('click',()=>dialog.showModal());
    root.querySelector('.suite-help-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>trigger.focus());
    // Keep app-wide text shortcuts out of the modal; native Escape and Tab still work.
    dialog.addEventListener('keydown',event=>event.stopPropagation());
    for (const button of root.querySelectorAll('[data-page]')) button.addEventListener('click',()=>{
      for (const section of root.querySelectorAll('[data-section]')) section.hidden=section.dataset.section!==button.dataset.page;
      for (const tab of root.querySelectorAll('[data-page]')) {tab.removeAttribute('aria-current');}
      button.setAttribute('aria-current','page');
      root.querySelector('main').scrollTop=0;
    });
  }
}
customElements.define('suite-help',SuiteHelp);
