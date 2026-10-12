/**
 * Dawung Neon Edit Button
 * Visual-only enhancement for existing Edit/Ubah buttons.
 * Does not replace onclick handlers or change the edit workflow.
 */
(function () {
  'use strict';

  const EDIT_TEXT = /^(?:✎\s*)?(edit|ubah|sunting)(?:\s+(?:warga|kk|kartu keluarga|data|pengumuman|agenda|transaksi|pengguna|pengajuan))?$/i;
  const EDIT_HANDLER = /\b(?:edit[A-Z][\w]*|openEdit[A-Z\w]*|ubah[A-Z][\w]*)\s*\(/;
  const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;

  function pencilIcon() {
    return `<span class="dawung-edit-icon-wrap" aria-hidden="true">
      <svg class="dawung-edit-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path class="dawung-edit-pencil-body" d="m14.2 5.2 4.6 4.6M4 20l4.3-.9L19.2 8.2a2.12 2.12 0 0 0-3-3L5.3 16.1 4 20Z" />
        <path class="dawung-edit-pencil-line" d="m5.3 16.1 3 3" />
        <path class="dawung-edit-pencil-shine" d="M3 4.5h3M4.5 3v3M18.5 15.5h2M19.5 14.5v2" />
      </svg>
    </span>`;
  }

  function lettersMarkup(label) {
    return [...label].map((letter, index) => {
      const safe = letter === ' ' ? '&nbsp;' : letter.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      return `<span class="dawung-edit-letter" style="--edit-letter-index:${index}">${safe}</span>`;
    }).join('');
  }

  function isEditButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.classList.contains('dawung-edit-btn') || button.classList.contains('dawung-delete-btn')) return false;
    if (button.closest('.modal, .dw-confirm-overlay')) return false;
    if (button.disabled || button.type === 'submit') return false;

    const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
    const title = (button.getAttribute('aria-label') || button.title || '').trim();
    const handler = button.getAttribute('onclick') || '';
    return EDIT_TEXT.test(label) || EDIT_TEXT.test(title) || EDIT_HANDLER.test(handler);
  }

  function decorate(button) {
    if (!isEditButton(button)) return;

    const originalLabel = (button.getAttribute('aria-label') || button.textContent || button.title || 'Edit').replace(/\s+/g, ' ').trim();
    button.classList.add('dawung-edit-btn');
    button.dataset.editDecorated = 'true';
    button.setAttribute('aria-label', originalLabel || 'Edit');
    button.setAttribute('title', originalLabel || 'Edit');
    button.innerHTML = `${pencilIcon()}<span class="dawung-edit-text">${lettersMarkup('Edit')}</span><span class="dawung-edit-sr-only">${originalLabel.replace(/[&<>]/g, '')}</span>`;
  }

  function scan(root) {
    if (!root) return;
    if (root instanceof HTMLButtonElement) decorate(root);
    root.querySelectorAll?.('button').forEach(decorate);
  }

  function animate(button) {
    if (!button?.classList.contains('dawung-edit-btn') || REDUCED_MOTION) return;
    button.classList.remove('dawung-edit-active');
    void button.offsetWidth;
    button.classList.add('dawung-edit-active');
    clearTimeout(button.__dawungEditTimer);
    button.__dawungEditTimer = setTimeout(() => button.classList.remove('dawung-edit-active'), 650);
  }

  scan(document);
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Decoration only: never preventDefault or stopPropagation, so existing edit handlers remain intact.
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('button.dawung-edit-btn');
    if (button) animate(button);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const button = event.target.closest?.('button.dawung-edit-btn');
    if (button) animate(button);
  }, true);
})();
