/* Admin gallery manager. Requires the shared DAWUNG_SUPABASE client and admin.js helpers. */
(function () {
  'use strict';

  const BUCKET = 'warga-gallery';
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

  function renderCards(items) {
    const grid = document.querySelector('#adminGalleryGrid');
    const status = document.querySelector('#adminGalleryStatus');
    if (!grid) return;
    if (status) status.hidden = true;
    if (!items.length) {
      grid.innerHTML = '<div class="admin-gallery-empty"><span>▧</span><b>Belum ada foto galeri</b><p>Tambahkan foto kegiatan warga menggunakan tombol “Tambah Foto”.</p></div>';
      return;
    }
    grid.innerHTML = items.map((item) => {
      const id = escGallery(item.id);
      const title = escGallery(item.title);
      const description = escGallery(item.description || 'Belum ada deskripsi.');
      const imageUrl = escGallery(item.image_url);
      const state = item.is_published ? '<span class="admin-gallery-state is-published">Tampil di website</span>' : '<span class="admin-gallery-state">Disembunyikan</span>';
      const sample = item.is_sample ? '<span class="admin-gallery-state is-sample">Ilustrasi bawaan</span>' : '';
      return `<article class="admin-gallery-card">
        <div class="admin-gallery-thumb"><img src="${imageUrl}" alt="${escGallery(item.alt_text || item.title)}" loading="lazy"><span class="admin-gallery-order">Urutan ${Number(item.sort_order) || 0}</span></div>
        <div class="admin-gallery-card-body"><div class="admin-gallery-title-row"><h3>${title}</h3>${state}</div>
          <p>${description}</p><div class="admin-gallery-meta">${sample}<span>${escGallery(formatDate(item.created_at))}</span></div>
          <div class="admin-gallery-actions"><button type="button" data-gallery-edit="${id}">Edit</button><button type="button" class="admin-gallery-delete" data-gallery-delete="${id}">Hapus</button></div>
        </div></article>`;
    }).join('');
  }

  async function fetchItems() {
    const sb = window.DAWUNG_SUPABASE;
    const { data, error } = await sb.from('gallery_items')
      .select('id,title,description,image_url,storage_path,alt_text,is_published,is_sample,sort_order,created_at')
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
      <div class="card-head"><div><b>Galeri Warga</b><small>Kelola foto kegiatan yang ditampilkan di halaman utama.</small></div><button type="button" class="green-mini" id="addGalleryImage">＋ Tambah Foto</button></div>
      <div class="admin-gallery-intro"><span class="admin-gallery-intro-icon">▧</span><div><b>Dokumentasi kegiatan Dusun Dawung</b><p>Format JPG, PNG, atau WebP, maksimal 8 MB per foto. Foto dapat dibuka lebih besar oleh pengunjung.</p></div></div>
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
      if (items.length === 0) galleryStatus('Galeri masih kosong. Tambahkan foto pertama Anda.', false);
    } catch (error) {
      console.error('[Admin gallery] Gagal memuat galeri:', error);
      galleryStatus('Galeri belum siap. Jalankan supabase/05-gallery-management.sql di Supabase SQL Editor, lalu muat ulang halaman. Detail: ' + (error.message || error), true);
      const grid = document.querySelector('#adminGalleryGrid');
      if (grid) grid.innerHTML = '';
    }
  }

  async function uploadImage(file) {
    const sb = window.DAWUNG_SUPABASE;
    if (!ALLOWED_TYPES.has(file.type)) throw new Error('Gunakan foto JPG, PNG, atau WebP.');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Ukuran foto maksimal 8 MB.');
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData?.user) throw new Error('Sesi admin tidak ditemukan. Silakan login kembali.');
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'foto-warga';
    const path = `${authData.user.id}/${Date.now()}-${safeName}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type
    });
    if (error) throw error;
    const result = sb.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = result?.data?.publicUrl;
    if (!publicUrl) {
      await sb.storage.from(BUCKET).remove([path]);
      throw new Error('URL foto tidak berhasil dibuat.');
    }
    return { path, publicUrl, userId: authData.user.id };
  }

  function openEditor(existing = null) {
    const currentImage = existing ? `<div class="admin-gallery-current"><img src="${escGallery(existing.image_url)}" alt="Foto saat ini"><span>Foto saat ini. Pilih file baru jika ingin menggantinya.</span></div>` : '';
    const body = `<div class="admin-gallery-editor">
      <label>Judul foto<input id="galleryEditTitle" maxlength="120" required value="${escGallery(existing?.title || '')}" placeholder="Contoh: Kerja Bakti Oktober"></label>
      <label>Deskripsi<textarea id="galleryEditDescription" rows="3" maxlength="500" placeholder="Ceritakan kegiatan pada foto">${escGallery(existing?.description || '')}</textarea></label>
      ${currentImage}
      <label>${existing ? 'Ganti foto (opsional)' : 'Pilih foto'}<input id="galleryEditFile" type="file" accept="image/jpeg,image/png,image/webp" ${existing ? '' : 'required'}></label>
      <small class="admin-gallery-file-hint">JPG, PNG, atau WebP · maksimal 8 MB.</small>
      <label>Urutan tampil<input id="galleryEditOrder" type="number" min="0" max="9999" value="${Number(existing?.sort_order) || 0}"></label>
      <label class="admin-gallery-publish"><input id="galleryEditPublished" type="checkbox" ${existing?.is_published === false ? '' : 'checked'}><span>Tampilkan foto di halaman utama</span></label>
    </div>`;

    modal(existing ? 'Edit Foto Galeri' : 'Tambah Foto Galeri', body, async () => {
      const titleInput = document.querySelector('#galleryEditTitle');
      const descInput = document.querySelector('#galleryEditDescription');
      const fileInput = document.querySelector('#galleryEditFile');
      const orderInput = document.querySelector('#galleryEditOrder');
      const publishedInput = document.querySelector('#galleryEditPublished');
      const saveButton = document.querySelector('#modalSave');
      const title = titleInput?.value.trim() || '';
      const description = descInput?.value.trim() || '';
      const file = fileInput?.files?.[0] || null;
      if (!title) { toast('Judul foto wajib diisi.'); titleInput?.focus(); return; }
      if (!existing && !file) { toast('Pilih foto yang akan diunggah.'); return; }
      if (file && (!ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES)) {
        toast(ALLOWED_TYPES.has(file.type) ? 'Ukuran foto maksimal 8 MB.' : 'Gunakan foto JPG, PNG, atau WebP.');
        return;
      }
      if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Menyimpan…'; }
      let uploaded = null;
      try {
        const sb = window.DAWUNG_SUPABASE;
        const { data: authData } = await sb.auth.getUser();
        if (file) uploaded = await uploadImage(file);
        const payload = {
          title,
          description,
          alt_text: title,
          is_published: !!publishedInput?.checked,
          sort_order: Math.max(0, Number(orderInput?.value) || 0),
          updated_at: new Date().toISOString()
        };
        if (uploaded) {
          payload.image_url = uploaded.publicUrl;
          payload.storage_path = uploaded.path;
          payload.is_sample = false;
          if (!existing) payload.uploaded_by = uploaded.userId;
        } else if (!existing) {
          payload.image_url = '';
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
          if (removal.error) console.warn('[Admin gallery] Foto lama gagal dibersihkan:', removal.error.message);
        }
        if (typeof closeModal === 'function') closeModal();
        toast(existing ? 'Foto galeri berhasil diperbarui.' : 'Foto berhasil ditambahkan ke galeri.');
        await renderAdminGallery();
      } catch (error) {
        console.error('[Admin gallery] Gagal menyimpan foto:', error);
        toast('Foto gagal disimpan: ' + (error.message || error));
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
        title: 'Hapus foto galeri?', entity: item.title,
        message: 'Foto ini akan dihapus dari galeri halaman utama. Tindakan ini tidak dapat dibatalkan.',
        confirmText: 'Ya, hapus foto'
      });
    } else {
      confirmed = window.confirm(`Hapus foto “${item.title}” dari galeri?`);
    }
    if (!confirmed) return;
    const sb = window.DAWUNG_SUPABASE;
    const { error } = await sb.from('gallery_items').delete().eq('id', item.id);
    if (error) { toast('Foto gagal dihapus: ' + error.message); return; }
    if (item.storage_path) {
      const removed = await sb.storage.from(BUCKET).remove([item.storage_path]);
      if (removed.error) console.warn('[Admin gallery] Foto berhasil dikeluarkan dari galeri, tetapi file storage gagal dibersihkan:', removed.error.message);
    }
    toast('Foto galeri berhasil dihapus.');
    await renderAdminGallery();
  }

  window.renderAdminGallery = renderAdminGallery;
})();
