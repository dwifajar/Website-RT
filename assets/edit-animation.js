/* Dawung Neon Edit Button
 * Visual-only enhancement for existing Edit buttons. The original button nodes,
 * onclick attributes, and event listeners are preserved so form/edit logic is unchanged.
 */
(() => {
  'use strict';

  const EDIT_TEXT = /^(?:edit|ubah|sunting)(?:\s+(?:warga|data|kk|kartu keluarga|pengumuman|agenda|transaksi|pengajuan))?$/i;
  const EDIT_HANDLER = /\b(?:edit|ubah|sunting)[A-Z_a-z0-9]*\s*\(/i;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function pencilIcon() {
    return `<span class="dawung-edit-icon-wrap" aria-hidden="true">
      <svg class="dawung-edit-svg" viewBox="0 0 24 24" focusable="false">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
        <path class="dawung-edit-glint" d="m14.8 5.2 4 4" />
      </svg>
      <span class="dawung-edit-spark" aria-hidden="true"></span>
    </span>`;
  }

  function isEditButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.classList.contains('dawung-edit-btn') || button.dataset.editDecorated === 'true') return false;
    const label = (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim();
    const title = (button.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const handler = button.getAttribute('onclick') || '';
    return EDIT_TEXT.test(label) || EDIT_TEXT.test(title) || EDIT_HANDLER.test(handler);
  }

  function decorate(button) {
    if (!isEditButton(button)) return;
    const oldLabel = (button.getAttribute('aria-label') || button.textContent || button.getAttribute('title') || 'Edit').replace(/\s+/g, ' ').trim();
    const visibleLabel = oldLabel || 'Edit';
    button.classList.add('dawung-edit-btn');
    button.dataset.editDecorated = 'true';
    button.setAttribute('aria-label', oldLabel || 'Edit');
    if (!button.hasAttribute('title')) button.setAttribute('title', oldLabel || 'Edit');
    if (!button.hasAttribute('type')) button.setAttribute('type', 'button');
    button.innerHTML = `${pencilIcon()}<span class="dawung-edit-label">${visibleLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span><span class="dawung-edit-sr-only">${(oldLabel || 'Edit').replace(/[&<>]/g, '')}</span>`;
  }

  function scan(root = document) {
    if (root instanceof Element && root.matches('button')) decorate(root);
    root.querySelectorAll?.('button').forEach(decorate);
  }

  function animate(button) {
    if (!button.classList.contains('dawung-edit-btn') || reducedMotion) return;
    button.classList.remove('dawung-edit-active');
    void button.offsetWidth;
    button.classList.add('dawung-edit-active');
    clearTimeout(button.__dawungEditTimer);
    button.__dawungEditTimer = window.setTimeout(() => button.classList.remove('dawung-edit-active'), 650);
  }

  scan();
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('button.dawung-edit-btn');
    if (button) animate(button);
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button.dawung-edit-btn');
    if (button && !button.classList.contains('dawung-edit-active')) animate(button);
  }, true);
})();
