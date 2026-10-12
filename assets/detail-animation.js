/* Dawung Neon Detail Button
 * Visual-only enhancement for the Detail action on the Pengajuan Surat page.
 * The existing data-detail attribute, click listeners and openDetail handler remain intact.
 */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function eyeIcon() {
    return `<span class="dawung-detail-icon-wrap" aria-hidden="true">
      <svg class="dawung-detail-svg" viewBox="0 0 24 24" focusable="false">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        <path class="dawung-detail-glint" d="M5.2 9.1c1.2-1.2 2.5-1.9 4.1-2.3" />
      </svg>
      <span class="dawung-detail-spark" aria-hidden="true"></span>
    </span>`;
  }

  function decorate(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    if (!button.hasAttribute('data-detail') || button.dataset.detailDecorated === 'true') return;

    const originalLabel = (button.getAttribute('aria-label') || button.textContent || button.getAttribute('title') || 'Detail').replace(/\s+/g, ' ').trim() || 'Detail';
    button.classList.add('dawung-detail-btn');
    button.dataset.detailDecorated = 'true';
    button.setAttribute('aria-label', originalLabel);
    if (!button.hasAttribute('title')) button.setAttribute('title', originalLabel);
    if (!button.hasAttribute('type')) button.setAttribute('type', 'button');

    const safeLabel = originalLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    button.innerHTML = `${eyeIcon()}<span class="dawung-detail-label">${safeLabel}</span><span class="dawung-detail-sr-only">${safeLabel}</span>`;
  }

  function scan(root = document) {
    if (root instanceof Element && root.matches('button[data-detail]')) decorate(root);
    root.querySelectorAll?.('button[data-detail]').forEach(decorate);
  }

  function animate(button) {
    if (!button.classList.contains('dawung-detail-btn') || reducedMotion) return;
    button.classList.remove('dawung-detail-active');
    void button.offsetWidth;
    button.classList.add('dawung-detail-active');
    clearTimeout(button.__dawungDetailTimer);
    button.__dawungDetailTimer = window.setTimeout(() => button.classList.remove('dawung-detail-active'), 650);
  }

  scan();
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('button.dawung-detail-btn');
    if (button) animate(button);
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button.dawung-detail-btn');
    if (button && !button.classList.contains('dawung-detail-active')) animate(button);
  }, true);
})();
