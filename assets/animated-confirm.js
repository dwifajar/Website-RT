/* Shared animated confirmation dialog for the Dusun Dawung admin portal.
 * Async by design: all destructive operations must await the user's decision.
 */
(function () {
  'use strict';

  let current = null;

  function svgTrash() {
    return '<svg class="dw-confirm-trash" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path class="dw-confirm-lid" d="M13 14h22M19 14V10h10v4M20 19v15M28 19v15" />' +
      '<path d="M16 15l2 24h12l2-24" />' +
      '<path class="dw-confirm-spark" d="M7 10l2 2m30 1l2-2M9 30l-3 1m33 4l3 2" />' +
      '</svg>';
  }

  function confirmDialog(options) {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    const title = String(opts.title || 'Konfirmasi penghapusan');
    const message = String(opts.message || 'Apakah Anda yakin ingin menghapus data ini?');
    const confirmText = String(opts.confirmText || 'Ya, hapus');
    const cancelText = String(opts.cancelText || 'Batal');
    const entity = String(opts.entity || 'Data yang dipilih');

    return new Promise((resolve) => {
      if (current && typeof current.close === 'function') current.close(false, true);

      const overlay = document.createElement('div');
      overlay.className = 'dw-confirm-overlay';
      overlay.innerHTML = `
        <section class="dw-confirm-card" role="alertdialog" aria-modal="true"
          aria-labelledby="dwConfirmTitle" aria-describedby="dwConfirmMessage" tabindex="-1">
          <button type="button" class="dw-confirm-x" data-action="cancel" aria-label="Tutup dialog">×</button>
          <div class="dw-confirm-topline"><span class="dw-confirm-live-dot"></span> KONFIRMASI TINDAKAN</div>
          <div class="dw-confirm-icon-wrap">
            <span class="dw-confirm-ring dw-confirm-ring-one"></span>
            <span class="dw-confirm-ring dw-confirm-ring-two"></span>
            <div class="dw-confirm-icon">${svgTrash()}</div>
            <i class="dw-confirm-particle dw-confirm-particle-a"></i>
            <i class="dw-confirm-particle dw-confirm-particle-b"></i>
            <i class="dw-confirm-particle dw-confirm-particle-c"></i>
          </div>
          <h2 id="dwConfirmTitle"></h2>
          <p id="dwConfirmEntity" class="dw-confirm-entity"></p>
          <p id="dwConfirmMessage" class="dw-confirm-message"></p>
          <div class="dw-confirm-warning"><span aria-hidden="true">!</span><span>Tindakan ini tidak dapat dibatalkan setelah data dihapus.</span></div>
          <div class="dw-confirm-actions">
            <button type="button" class="dw-confirm-cancel" data-action="cancel"></button>
            <button type="button" class="dw-confirm-submit" data-action="confirm">
              <span class="dw-confirm-submit-icon" aria-hidden="true">${svgTrash()}</span><span class="dw-confirm-submit-label"></span>
            </button>
          </div>
          <div class="dw-confirm-footnote"><span></span> DUSUN DAWUNG · PORTAL DIGITAL WARGA</div>
        </section>`;

      const card = overlay.querySelector('.dw-confirm-card');
      const cancelButton = overlay.querySelector('.dw-confirm-cancel');
      const confirmButton = overlay.querySelector('.dw-confirm-submit');
      overlay.querySelector('#dwConfirmTitle').textContent = title;
      overlay.querySelector('#dwConfirmEntity').textContent = entity;
      overlay.querySelector('#dwConfirmMessage').textContent = message;
      cancelButton.textContent = cancelText;
      overlay.querySelector('.dw-confirm-submit-label').textContent = confirmText;

      let settled = false;
      const oldOverflow = document.body.style.overflow;

      const close = (value, immediate) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown, true);
        overlay.removeEventListener('click', onOverlayClick);
        document.body.style.overflow = oldOverflow;
        if (current && current.overlay === overlay) current = null;
        if (immediate) overlay.remove();
        else {
          overlay.classList.add('is-closing');
          card.classList.add('is-closing');
          window.setTimeout(() => overlay.remove(), 180);
        }
        resolve(Boolean(value));
      };

      const onOverlayClick = (event) => {
        if (event.target === overlay) close(false);
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'cancel') close(false);
        if (action === 'confirm') close(true);
      };
      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const items = [...card.querySelectorAll('button:not([disabled])')];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      };

      overlay.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKeydown, true);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      current = { overlay, close };
      window.requestAnimationFrame(() => cancelButton.focus({ preventScroll: true }));
    });
  }

  window.DawungConfirm = confirmDialog;
})();
