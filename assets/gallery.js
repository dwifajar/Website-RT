(function () {
  'use strict';
  const grid = document.querySelector('.gallery-grid');
  const dialog = document.getElementById('galleryLightbox');
  const largeImage = document.getElementById('galleryLightboxImage');
  const largeVideo = document.getElementById('galleryLightboxVideo');
  const caption = document.getElementById('galleryLightboxCaption');
  const disclaimer = document.querySelector('.gallery-disclaimer');
  if (!grid || !dialog || !largeImage || !caption) return;
  const closeButton = dialog.querySelector('.gallery-lightbox-close');
  let lastTrigger = null;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function renderItems(items) {
    grid.innerHTML = items.length ? items.map(item => {
      const title = String(item.title || 'Kegiatan warga');
      const description = String(item.description || 'Momen kegiatan warga Dusun Dawung');
      const source = String(item.image_url || '');
      const alt = String(item.alt_text || title);
      const type = item.media_type === 'video' ? 'video' : 'image';
      const preview = type === 'video'
        ? `<video class="gallery-card-video" src="${esc(source)}" muted playsinline preload="metadata" aria-label="Pratinjau video ${esc(alt)}"></video><span class="gallery-video-indicator" aria-hidden="true">▶ Video</span>`
        : `<img src="${esc(source)}" alt="${esc(alt)}" loading="lazy">`;
      return `<button class="gallery-item${type === 'video' ? ' is-video' : ''}" type="button" data-gallery-src="${esc(source)}" data-gallery-type="${type}" data-gallery-alt="${esc(alt)}" data-gallery-title="${esc(title)}" aria-label="${type === 'video' ? 'Putar video' : 'Perbesar foto'} ${esc(title)}">${preview}<span class="gallery-overlay"><strong>${esc(title)}</strong><small>${esc(description)}</small><i aria-hidden="true">${type === 'video' ? '▶' : '↗'}</i></span></button>`;
    }).join('') : '<div class="gallery-empty-public">Belum ada foto atau video kegiatan yang ditampilkan. Silakan kunjungi kembali nanti.</div>';
    if (disclaimer) {
      const hasSamples = items.some(item => item.is_sample === true);
      disclaimer.hidden = !hasSamples;
      if (hasSamples) disclaimer.innerHTML = '<span aria-hidden="true">ⓘ</span> Media berlabel ilustrasi merupakan contoh tampilan. Ganti dengan dokumentasi asli melalui Admin → Galeri Warga.';
    }
  }

  async function loadManagedGallery() {
    const sb = window.DAWUNG_SUPABASE;
    if (!sb) return;
    try {
      const { data, error } = await sb.from('gallery_items')
        .select('id,title,description,image_url,alt_text,media_type,is_sample,sort_order,created_at')
        .eq('is_published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
      if (error) { console.warn('[Public gallery] Galeri dinamis belum tersedia:', error.message); return; }
      renderItems(data || []);
    } catch (error) { console.warn('[Public gallery]', error); }
  }

  function open(trigger) {
    lastTrigger = trigger;
    const source = trigger.dataset.gallerySrc;
    const title = trigger.dataset.galleryTitle || trigger.dataset.galleryAlt || 'Media kegiatan warga';
    const type = trigger.dataset.galleryType === 'video' ? 'video' : 'image';
    if (type === 'video' && largeVideo) {
      largeImage.hidden = true;
      largeImage.removeAttribute('src');
      largeVideo.hidden = false;
      largeVideo.src = source;
      largeVideo.setAttribute('aria-label', title);
      largeVideo.load();
    } else {
      if (largeVideo) {
        largeVideo.pause();
        largeVideo.removeAttribute('src');
        largeVideo.load();
        largeVideo.hidden = true;
      }
      largeImage.hidden = false;
      largeImage.src = source;
      largeImage.alt = trigger.dataset.galleryAlt || title;
    }
    caption.textContent = title;
    dialog.hidden = false;
    document.body.classList.add('gallery-open');
    closeButton?.focus();
  }

  function close() {
    dialog.hidden = true;
    largeImage.removeAttribute('src');
    if (largeVideo) {
      largeVideo.pause();
      largeVideo.removeAttribute('src');
      largeVideo.load();
      largeVideo.hidden = true;
    }
    largeImage.hidden = false;
    document.body.classList.remove('gallery-open');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  grid.addEventListener('click', event => {
    const trigger = event.target.closest('[data-gallery-src]');
    if (trigger && grid.contains(trigger)) open(trigger);
  });
  closeButton?.addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  document.addEventListener('keydown', event => { if (!dialog.hidden && event.key === 'Escape') { event.preventDefault(); close(); } });
  loadManagedGallery();
})();
