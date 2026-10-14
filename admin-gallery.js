/* Admin gallery manager for photos and videos. Requires DAWUNG_SUPABASE and admin.js helpers. */
(function () {
  'use strict';

  const BUCKET = 'warga-gallery';
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

  const escGallery = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function galleryStatus(message, isError = false) {
    const target = document.querySelector('#adminGalleryStatus');
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('is-error', isError);
    target.hidden = false;
  }

  function formatDate(value) {
    if (!value) return 'Tanggal tidak tersedia';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function mediaTypeFor(item) {
    return item?.media_type === 'video' ? 'video' : 'image';
  }

  function mediaPreview(item) {
    const url = escGallery(item.image_url || '');
    const title = escGallery(item.title || 'Media galeri');
    if (mediaTypeFor(item) === 'video') {
      return `<video src="${url}" muted playsinline preload="metadata" aria-label="Pratinjau video ${title}"></video><span class="admin-gallery-video-mark" aria-hidden="true">▶ VIDEO</span>`;
    }
    return `<img src="${url}" alt="${escGallery(item.alt_text || item.title)}" loading="lazy">`;
  }

  function renderCards(items) {
    const grid = document.querySelector('#adminGalleryGrid');
    const status = document.querySelector('#adminGalleryStatus');
    if (!grid) return;
    if (status) status.hidden = true;
    if (!items.length) {
      grid.innerHTML = '<div class="admin-gallery-empty"><span>▧</span><b>Belum ada media galeri</b><p>Tambahkan foto atau video kegiatan warga menggunakan tombol “Tambah Media”.</p></div>';
      return;
    }
    grid.innerHTML = items.map((item) => {
      const id = escGallery(item.id);
      const title = escGallery(item.title);
      const description = escGallery(item.description || 'Belum ada deskripsi.');
      const type = mediaTypeFor(item);
      const state = item.is_published ? '<span class="admin-gallery-state is-published">Tampil di website</span>' : '<span class="admin-gallery-state">Disembunyikan</span>';
      const sample = item.is_sample ? '<span class="admin-gallery-state is-sample">Ilustrasi bawaan</span>' : '';
      const typeLabel = type === 'video' ? '<span class="admin-gallery-state is-video">Video</span>' : '<span class="admin-gallery-state is-photo">Foto</span>';
      return `<article class="admin-gallery-card">
        <div class="admin-gallery-thumb">${mediaPreview(item)}<span class="admin-gallery-order">Urutan ${Number(item.sort_order) || 0}</span></div>
        <div class="admin-gallery-card-body"><div class="admin-gallery-title-row"><h3>${title}</h3>${state}</div>
          <p>${description}</p><div class="admin-gallery-meta">${typeLabel}${sample}<span>${escGallery(formatDate(item.created_at))}</span></div>
          <div class="admin-gallery-actions"><button type="button" data-gallery-edit="${id}">Edit</button><button type="button" class="admin-gallery-delete" data-gallery-delete="${id}">Hapus</button></div>
        </div></article>`;
    }).join('');
  }

  async function fetchItems() {
    const sb = window.DAWUNG_SUPABASE;
    const { data, error } = await sb.from('gallery_items')
      .select('id,title,description,image_url,storage_path,alt_text,media_type,is_published,is_sample,sort_order,created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function renderAdminGallery() {
    if (typeof head === 'function') head('Galeri Warga');
    const app = document.querySelector('#app');
    const sb = window.DAWUNG_SUPABASE;
    if (!app) return;

    app.innerHTML = `<section class="admin-card admin-gallery-manager wide">
      <div class="card-head"><div><b>Galeri Warga</b><small>Kelola foto dan video kegiatan yang ditampilkan di halaman utama.</small></div><button type="button" class="green-mini" id="addGalleryImage">＋ Tambah Media</button></div>
      <div class="admin-gallery-intro"><span class="admin-gallery-intro-icon">▧</span><div><b>Dokumentasi kegiatan Dusun Dawung</b><p>Foto JPG, PNG, WebP maksimal 8 MB. Video MP4 atau WebM maksimal 50 MB. Media yang diterbitkan akan tampil di galeri publik.</p></div></div>
      <div class="admin-gallery-status" id="adminGalleryStatus">Memuat galeri…</div>
      <div class="admin-gallery-grid" id="adminGalleryGrid"></div>
    </section>`;

    if (!sb) {
      galleryStatus('Supabase belum tersedia. Periksa koneksi dan konfigurasi project.', true);
      return;
    }
    try {
      const items = await fetchItems();
      renderCards(items);
      document.querySelector('#addGalleryImage')?.addEventListener('click', () => openEditor());
      app.querySelectorAll('[data-gallery-edit]').forEach((button) => button.addEventListener('click', () => {
        const item = items.find((row) => String(row.id) === button.dataset.galleryEdit);
        if (item) openEditor(item);
      }));
      app.querySelectorAll('[data-gallery-delete]').forEach((button) => button.addEventListener('click', () => {
        const item = items.find((row) => String(row.id) === button.dataset.galleryDelete);
        if (item) deleteItem(item);
      }));
      if (items.length === 0) galleryStatus('Galeri masih kosong. Tambahkan foto atau video pertama Anda.', false);
    } catch (error) {
      console.error('[Admin gallery] Gagal memuat galeri:', error);
      const migrationHint = String(error.message || '').includes('media_type')
        ? ' Jalankan supabase/06-gallery-video-support.sql agar upload video aktif.'
        : ' Pastikan migrasi galeri dan video sudah dijalankan di Supabase.';
      galleryStatus('Galeri belum siap.' + migrationHint + ' Detail: ' + (error.message || error), true);
      const grid = document.querySelector('#adminGalleryGrid');
      if (grid) grid.innerHTML = '';
    }
  }

  function inferMedia(file) {
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '').toLowerCase();
    if (ALLOWED_IMAGE_TYPES.has(type) || (!type && /\.(jpe?g|png|webp)$/.test(name))) {
      const mime = type || (name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
      return { mediaType: 'image', mime, maxBytes: MAX_IMAGE_BYTES, allowed: ALLOWED_IMAGE_TYPES };
    }
    if (ALLOWED_VIDEO_TYPES.has(type) || (!type && /\.(mp4|webm)$/.test(name))) {
      const mime = type || (name.endsWith('.webm') ? 'video/webm' : 'video/mp4');
      return { mediaType: 'video', mime, maxBytes: MAX_VIDEO_BYTES, allowed: ALLOWED_VIDEO_TYPES };
    }
    return null;
  }

  async function uploadMedia(file) {
    const info = inferMedia(file);
    if (!info) throw new Error('Format tidak didukung. Gunakan foto JPG, PNG, WebP atau video MP4, WebM.');
    if (file.size > info.maxBytes) throw new Error(info.mediaType === 'video' ? 'Ukuran video maksimal 50 MB.' : 'Ukuran foto maksimal 8 MB.');
    const sb = window.DAWUNG_SUPABASE;
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData?.user) throw new Error('Sesi admin tidak ditemukan. Silakan login kembali.');
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || (info.mediaType === 'video' ? 'video-warga.mp4' : 'foto-warga.jpg');
    const path = `${authData.user.id}/${Date.now()}-${safeName}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: info.mime
    });
    if (error) throw error;
    const result = sb.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = result?.data?.publicUrl;
    if (!publicUrl) {
      await sb.storage.from(BUCKET).remove([path]);
      throw new Error('URL media tidak berhasil dibuat.');
    }
    return { path, publicUrl, userId: authData.user.id, mediaType: info.mediaType };
  }

  function currentPreview(existing) {
    if (!existing) return '';
    const url = escGallery(existing.image_url || '');
    const preview = mediaTypeFor(existing) === 'video'
      ? `<video src="${url}" controls playsinline preload="metadata" aria-label="Video saat ini"></video>`
      : `<img src="${url}" alt="Media saat ini">`;
    return `<div class="admin-gallery-current">${preview}<span>${mediaTypeFor(existing) === 'video' ? 'Video saat ini.' : 'Foto saat ini.'} Pilih file baru jika ingin menggantinya.</span></div>`;
  }

  function openEditor(existing = null) {
    const currentMedia = currentPreview(existing);
    const body = `<div class="admin-gallery-editor">
      <label>Judul media<input id="galleryEditTitle" maxlength="120" required value="${escGallery(existing?.title || '')}" placeholder="Contoh: Kerja Bakti Oktober"></label>
      <label>Deskripsi<textarea id="galleryEditDescription" rows="3" maxlength="500" placeholder="Ceritakan kegiatan pada foto atau video">${escGallery(existing?.description || '')}</textarea></label>
      ${currentMedia}
      <label>${existing ? 'Ganti foto/video (opsional)' : 'Pilih foto atau video'}<input id="galleryEditFile" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" ${existing ? '' : 'required'}></label>
      <small class="admin-gallery-file-hint">Foto: JPG, PNG, WebP maksimal 8 MB. Video: MP4, WebM maksimal 50 MB.</small>
      <label>Urutan tampil<input id="galleryEditOrder" type="number" min="0" max="9999" value="${Number(existing?.sort_order) || 0}"></label>
      <label class="admin-gallery-publish"><input id="galleryEditPublished" type="checkbox" ${existing?.is_published === false ? '' : 'checked'}><span>Tampilkan media di halaman utama</span></label>
    </div>`;

    modal(existing ? 'Edit Media Galeri' : 'Tambah Media Galeri', body, async () => {
      const titleInput = document.querySelector('#galleryEditTitle');
      const descInput = document.querySelector('#galleryEditDescription');
      const fileInput = document.querySelector('#galleryEditFile');
      const orderInput = document.querySelector('#galleryEditOrder');
      const publishedInput = document.querySelector('#galleryEditPublished');
      const saveButton = document.querySelector('#modalSave');
      const title = titleInput?.value.trim() || '';
      const description = descInput?.value.trim() || '';
      const file = fileInput?.files?.[0] || null;
      const info = file ? inferMedia(file) : null;
      if (!title) { toast('Judul media wajib diisi.'); titleInput?.focus(); return; }
      if (!existing && !file) { toast('Pilih foto atau video yang akan diunggah.'); return; }
      if (file && !info) { toast('Format tidak didukung. Gunakan foto JPG/PNG/WebP atau video MP4/WebM.'); return; }
      if (file && file.size > info.maxBytes) { toast(info.mediaType === 'video' ? 'Ukuran video maksimal 50 MB.' : 'Ukuran foto maksimal 8 MB.'); return; }
      if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Mengunggah…'; }
      let uploaded = null;
      try {
        const sb = window.DAWUNG_SUPABASE;
        const { data: authData, error: authError } = await sb.auth.getUser();
        if (authError || !authData?.user) throw new Error('Sesi admin tidak ditemukan. Silakan login kembali.');
        if (file) uploaded = await uploadMedia(file);
        const payload = {
          title,
          description,
          alt_text: title,
          media_type: uploaded?.mediaType || mediaTypeFor(existing),
          is_published: !!publishedInput?.checked,
          sort_order: Math.max(0, Number(orderInput?.value) || 0),
          updated_at: new Date().toISOString()
        };
        if (uploaded) {
          payload.image_url = uploaded.publicUrl;
          payload.storage_path = uploaded.path;
          payload.is_sample = false;
        }
        let result;
        if (existing) result = await sb.from('gallery_items').update(payload).eq('id', existing.id);
        else result = await sb.from('gallery_items').insert({ ...payload, uploaded_by: uploaded.userId });
        if (result.error) {
          if (uploaded) await sb.storage.from(BUCKET).remove([uploaded.path]);
          throw result.error;
        }
        if (existing && uploaded && existing.storage_path && existing.storage_path !== uploaded.path) {
          const removal = await sb.storage.from(BUCKET).remove([existing.storage_path]);
          if (removal.error) console.warn('[Admin gallery] Media lama gagal dibersihkan:', removal.error.message);
        }
        if (typeof closeModal === 'function') closeModal();
        toast(existing ? 'Media galeri berhasil diperbarui.' : 'Media berhasil ditambahkan ke galeri.');
        await renderAdminGallery();
      } catch (error) {
        console.error('[Admin gallery] Gagal menyimpan media:', error);
        toast('Media gagal disimpan: ' + (error.message || error));
      } finally {
        const button = document.querySelector('#modalSave');
        if (button) { button.disabled = false; button.textContent = 'Simpan'; }
      }
    });
  }

  async function deleteItem(item) {
    let confirmed = false;
    if (window.DawungConfirm) {
      confirmed = await window.DawungConfirm({
        title: 'Hapus media galeri?', entity: item.title,
        message: 'Media ini akan dihapus dari galeri halaman utama. Tindakan ini tidak dapat dibatalkan.',
        confirmText: 'Ya, hapus media'
      });
    } else {
      confirmed = window.confirm(`Hapus media “${item.title}” dari galeri?`);
    }
    if (!confirmed) return;
    const sb = window.DAWUNG_SUPABASE;
    const { error } = await sb.from('gallery_items').delete().eq('id', item.id);
    if (error) { toast('Media gagal dihapus: ' + error.message); return; }
    if (item.storage_path) {
      const removed = await sb.storage.from(BUCKET).remove([item.storage_path]);
      if (removed.error) console.warn('[Admin gallery] Media dihapus dari daftar, tetapi file storage gagal dibersihkan:', removed.error.message);
    }
    toast('Media galeri berhasil dihapus.');
    await renderAdminGallery();
  }

  window.renderAdminGallery = renderAdminGallery;
})();
