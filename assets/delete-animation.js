/*
 * Dawung Neon Delete Button
 * Decorative-only enhancement for existing delete buttons.
 * Existing onclick handlers, confirmation prompts, and data operations are preserved.
 */
(() => {
  'use strict';

  const DELETE_TEXT = /^(hapus(?:\b.*)?|delete(?:\b.*)?|remove(?:\b.*)?)$/i;
  const DELETE_HANDLER = /\b(?:del[A-Z][\w]*|delete[A-Z][\w]*|hapus[A-Z][\w]*)\s*\(/;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function makeTrashIcon() {
    return `
      <span class="dawung-trash-wrap" aria-hidden="true">
        <svg class="dawung-trash-svg" viewBox="0 0 32 34" focusable="false">
          <g class="dawung-trash-lid">
            <path d="M7 8h18M12 5h8" />
          </g>
          <g class="dawung-trash-can">
            <path d="M9 10l1.5 18.2c.1 1.1 1 1.8 2.1 1.8h6.8c1.1 0 2-.7 2.1-1.8L23 10Z" />
            <path d="M13 14v11M19 14v11" />
          </g>
          <path class="dawung-trash-liquid" d="M11 17c2-2 3 2 5 0s3 2 5 0v7H11Z" />
        </svg>
        <span class="dawung-impact" aria-hidden="true"></span>
      </span>`;
  }

  function lettersMarkup(label) {
    return [...label].map((letter, index) => {
      const safeLetter = letter === ' ' ? '&nbsp;' : letter
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const distance = 38 + (index * 12);
      return `<span class="dawung-delete-letter" style="--fly-dist:${distance}px;--letter-index:${index}" aria-hidden="true">${safeLetter}</span>`;
    }).join('');
  }

  function isDeleteButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (button.classList.contains('dawung-delete-btn')) return false;
    const label = (button.getAttribute('aria-label') || button.textContent || '').trim();
    const handler = button.getAttribute('onclick') || '';
    const title = button.getAttribute('title') || '';
    return DELETE_TEXT.test(label) || DELETE_TEXT.test(title) || DELETE_HANDLER.test(handler);
  }

  function decorate(button) {
    if (!isDeleteButton(button)) return;

    const oldLabel = (button.getAttribute('aria-label') || button.textContent || button.title || 'Hapus').trim();
    const visualLabel = 'Delete';
    button.classList.add('dawung-delete-btn');
    button.dataset.deleteDecorated = 'true';
    button.setAttribute('aria-label', oldLabel || 'Hapus');
    button.setAttribute('title', oldLabel || 'Hapus');
    button.setAttribute('type', button.getAttribute('type') || 'button');
    button.innerHTML = `${makeTrashIcon()}<span class="dawung-delete-text">${lettersMarkup(visualLabel)}</span><span class="dawung-delete-sr-only">${oldLabel.replace(/[&<>]/g, '')}</span>`;
  }

  function scan(root = document) {
    if (root instanceof Element && root.matches('button')) decorate(root);
    root.querySelectorAll?.('button').forEach(decorate);
  }

  function animate(button) {
    if (!button.classList.contains('dawung-delete-btn') || reducedMotion) return;
    button.classList.remove('dawung-delete-active');
    // Force a fresh animation when the user presses the button repeatedly.
    void button.offsetWidth;
    button.classList.add('dawung-delete-active');
    clearTimeout(button.__dawungDeleteTimer);
    button.__dawungDeleteTimer = setTimeout(() => {
      button.classList.remove('dawung-delete-active');
    }, 1250);
  }

  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Begin on pointer-down so the animation can start before an existing confirm() prompt.
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.('button.dawung-delete-btn');
    if (button) animate(button);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const button = event.target.closest?.('button.dawung-delete-btn');
    if (button) animate(button);
  }, true);

  // The click listener is visual only. It does not stop propagation or replace delete handlers.
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button.dawung-delete-btn');
    if (button && !button.classList.contains('dawung-delete-active')) animate(button);
  }, true);
})();
