(function () {
  'use strict';

  const sb = window.DAWUNG_SUPABASE;
  const $ = (selector, root = document) => root.querySelector(selector);
  const app = $('#wargaApp');
  const state = {
    user: null,
    profile: null,
    warga: null,
    page: 'beranda',
    notifications: [],
    unread: 0,
    pageToken: 0
  };

  const pageMeta = {
    beranda: ['Beranda', 'Ringkasan layanan dan informasi terbaru untuk Anda.'],
    surat: ['Pengajuan Surat', 'Ajukan surat administrasi dan pantau status prosesnya.'],
    aspirasi: ['Aspirasi & Laporan', 'Sampaikan usulan atau laporan untuk lingkungan kita.'],
    agenda: ['Agenda & Informasi', 'Pantau agenda kegiatan dan pengumuman terbaru.'],
    notifikasi: ['Notifikasi', 'Informasi penting terkait akun dan layanan Anda.'],
    profil: ['Profil Saya', 'Periksa dan perbarui informasi dasar akun Anda.']
  };
  const jenisSurat = [
    ['surat_pengantar', 'Surat Pengantar'],
    ['domisili', 'Surat Keterangan Domisili'],
    ['sktm', 'Surat Keterangan Tidak Mampu (SKTM)'],
    ['usaha', 'Surat Keterangan Usaha'],
    ['lainnya', 'Surat Keterangan Lainnya']
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }
  function notify(message, type = 'info', title) {
    const duration = type === 'error' ? 4400 : type === 'warning' ? 3900 : 3200;
    if (window.premiumToast && typeof window.premiumToast[type] === 'function') {
      return window.premiumToast[type](message, duration, title);
    }
    if (window.showPremiumToast) return window.showPremiumToast(message, type, duration, title);
    console[type === 'error' ? 'error' : 'log'](message);
  }
  function errorMessage(error, fallback) {
    console.error('[Portal Warga]', error);
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('row-level security') || message.includes('permission denied') || message.includes('not allowed')) {
      return 'Akses data belum diizinkan oleh pengaturan keamanan Supabase. Hubungi pengurus atau periksa kebijakan RLS.';
    }
    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Koneksi internet atau layanan database terganggu. Periksa koneksi lalu coba lagi.';
    }
    if (message.includes('does not exist') || message.includes('schema cache')) {
      return 'Struktur database belum lengkap atau belum diperbarui. Hubungi pengurus untuk pemeriksaan Supabase.';
    }
    return fallback || 'Permintaan belum berhasil. Silakan coba kembali.';
  }
  function initials(name) {
    return String(name || 'Warga').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'DW';
  }
  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  function formatDate(value, includeTime = false) {
    if (!value) return '-';
    const date = new Date(value.length === 10 ? value + 'T00:00:00' : value);
    if (Number.isNaN(date.getTime())) return esc(value);
    return new Intl.DateTimeFormat('id-ID', includeTime
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  function money(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
  }
  function labelJenis(value) {
    return (jenisSurat.find(item => item[0] === value) || [null, value || 'Surat'])[1];
  }
  function badgeStatus(status) {
    const normalized = String(status || 'menunggu').toLowerCase();
    const labels = { menunggu: 'Menunggu', diproses: 'Diproses', selesai: 'Selesai', ditolak: 'Ditolak', baru: 'Baru', aktif: 'Aktif', nonaktif: 'Nonaktif' };
    const className = ['selesai', 'aktif'].includes(normalized) ? 'w-status-success' : ['ditolak', 'nonaktif'].includes(normalized) ? 'w-status-danger' : normalized === 'diproses' ? 'w-status-info' : 'w-status-wait';
    return `<span class="w-status ${className}">${esc(labels[normalized] || status || 'Menunggu')}</span>`;
  }
  function showLoading(text = 'Memuat data…') {
    app.innerHTML = `<section class="admin-card warga-loading"><span class="warga-spinner"></span><b>${esc(text)}</b><small>Tunggu sebentar, kami sedang menyiapkan informasi.</small></section>`;
  }
  function showLoadError(message) {
    app.innerHTML = `<section class="admin-card warga-empty-state"><span class="warga-empty-icon">!</span><h2>Data belum dapat dimuat</h2><p>${esc(message)}</p><button class="warga-btn-primary" type="button" id="wargaRetry">Coba Lagi</button></section>`;
    $('#wargaRetry')?.addEventListener('click', () => renderPage(state.page));
  }
  async function getRows(table, configure, columns = '*') {
    let query = sb.from(table).select(columns);
    if (typeof configure === 'function') query = configure(query);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  async function loadOwnRows(table, sortField = 'created_at') {
    if (!state.warga) return [];
    return getRows(table, query => query.eq('warga_id', state.warga.id).order(sortField, { ascending: false }));
  }
  function pageTitle(key) {
    const meta = pageMeta[key] || pageMeta.beranda;
    $('#wargaEyebrow').textContent = 'PORTAL WARGA · DUSUN DAWUNG';
    $('#wargaPageTitle').textContent = key === 'beranda' ? `Halo, ${(state.profile?.nama || state.warga?.nama || 'Warga').split(' ')[0]} 👋` : meta[0];
    $('#wargaPageSubtitle').textContent = key === 'beranda' ? `Selamat datang kembali. ${meta[1]}` : meta[1];
  }
  function refreshIdentity() {
    const name = state.profile?.nama || state.warga?.nama || state.user?.email || 'Warga';
    const avatar = initials(name);
    $('#wargaSidebarName').textContent = name;
    $('#wargaSidebarAvatar').textContent = avatar;
    $('#wargaHeaderAvatar').textContent = avatar;
  }
  async function initialise() {
    if (!sb || !app) {
      notify('Layanan portal belum siap. Muat ulang halaman beberapa saat lagi.', 'error', 'Koneksi belum tersedia');
      showLoadError('Konfigurasi Supabase tidak dapat dimuat.');
      return;
    }
    try {
      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) {
        localStorage.removeItem('dawung_auth');
        location.replace('../login.html');
        return;
      }
      state.user = authData.user;
      const { data: profile, error: profileError } = await sb.from('profiles')
        .select('id,nama,email,role,avatar_url').eq('id', state.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        notify('Profil akun belum tersedia. Hubungi pengurus RT.', 'warning', 'Profil belum ditemukan');
        showLoadError('Profil akun Anda belum dibuat oleh pengurus. Silakan hubungi admin RT.');
        return;
      }
      if (profile.role !== 'warga') {
        location.replace('../admin/index.html');
        return;
      }
      state.profile = profile;
      localStorage.setItem('dawung_auth', 'warga');
      localStorage.setItem('dawung_user', JSON.stringify({ id: state.user.id, nama: profile.nama, email: state.user.email, role: profile.role }));
      const { data: warga, error: wargaError } = await sb.from('warga')
        .select('id,profile_id,nik,nama,no_kk,alamat,rt,rw,status').eq('profile_id', state.user.id).maybeSingle();
      if (wargaError) throw wargaError;
      state.warga = warga || null;
      refreshIdentity();
      await loadNotificationCount();
      bindShell();
      const requestedPage = String(location.hash || '').replace(/^#/, '');
      await renderPage(pageMeta[requestedPage] ? requestedPage : 'beranda');
      if (!state.warga) notify('Akun Anda belum terhubung dengan data warga. Beberapa layanan memerlukan verifikasi pengurus.', 'warning', 'Data warga belum tertaut');
    } catch (error) {
      showLoadError(errorMessage(error, 'Gagal memuat profil akun.'));
      notify(errorMessage(error, 'Gagal memuat profil akun.'), 'error', 'Tidak dapat membuka portal');
    }
  }
  async function loadNotificationCount() {
    try {
      const rows = await getRows('notifikasi', query => query.eq('user_id', state.user.id).order('created_at', { ascending: false }));
      state.notifications = rows;
      state.unread = rows.filter(row => !row.dibaca).length;
      const count = $('#wargaUnreadCount');
      count.textContent = String(state.unread);
      count.hidden = state.unread < 1;
      $('#wargaBellDot').hidden = state.unread < 1;
    } catch (error) {
      // Notification table may not be installed in older database versions; other portal features remain usable.
      console.warn('[Portal Warga] Notifikasi tidak dapat dimuat:', error?.message || error);
      state.notifications = [];
      state.unread = 0;
      $('#wargaUnreadCount').hidden = true;
      $('#wargaBellDot').hidden = true;
    }
  }
  function bindShell() {
    $('#wargaNav').addEventListener('click', event => {
      const link = event.target.closest('a[data-page]');
      if (!link) return;
      event.preventDefault();
      const page = link.dataset.page;
      history.replaceState(null, '', '#' + page);
      closeSidebar();
      renderPage(page);
    });
    $('#wargaHamb').addEventListener('click', () => toggleSidebar());
    $('#wargaSidebarBackdrop').addEventListener('click', closeSidebar);
    $('#wargaHeaderNotifications').addEventListener('click', () => renderPage('notifikasi'));
    $('#logoutWarga').addEventListener('click', async () => {
      openModal('Keluar dari akun?', `<div class="warga-modal-notice"><span class="warga-modal-notice-icon">↗</span><p>Sesi portal warga akan diakhiri dan Anda kembali ke halaman login.</p></div>`, 'Ya, Keluar', async () => {
        try {
          const { error } = await sb.auth.signOut();
          if (error) throw error;
        } catch (error) {
          notify(errorMessage(error, 'Logout belum berhasil.'), 'error', 'Gagal keluar');
          return false;
        }
        localStorage.removeItem('dawung_auth');
        localStorage.removeItem('dawung_user');
        notify('Anda berhasil keluar dari portal warga.', 'success', 'Sampai jumpa');
        setTimeout(() => location.replace('../login.html'), 450);
        return true;
      }, 'danger');
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 950) closeSidebar(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeModal();
        closeSidebar();
      }
    });
  }
  function toggleSidebar() {
    const side = $('#wargaSidebar');
    const backdrop = $('#wargaSidebarBackdrop');
    side.classList.toggle('open');
    backdrop.hidden = !side.classList.contains('open');
    document.body.classList.toggle('warga-menu-open', side.classList.contains('open'));
  }
  function closeSidebar() {
    $('#wargaSidebar').classList.remove('open');
    $('#wargaSidebarBackdrop').hidden = true;
    document.body.classList.remove('warga-menu-open');
  }
  async function renderPage(page) {
    if (!pageMeta[page]) page = 'beranda';
    state.page = page;
    const token = ++state.pageToken;
    pageTitle(page);
    $('#wargaNav').querySelectorAll('a[data-page]').forEach(link => {
      const active = link.dataset.page === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    showLoading(pageMeta[page][0] + ' sedang dimuat…');
    try {
      let markup;
      if (page === 'beranda') markup = await dashboardMarkup();
      else if (page === 'surat') markup = await suratMarkup();
      else if (page === 'aspirasi') markup = await aspirasiMarkup();
      else if (page === 'agenda') markup = await agendaMarkup();
      else if (page === 'notifikasi') markup = await notifikasiMarkup();
      else markup = profilMarkup();
      if (token !== state.pageToken) return;
      app.innerHTML = markup;
      bindPageActions(page);
    } catch (error) {
      if (token !== state.pageToken) return;
      showLoadError(errorMessage(error, 'Halaman ini belum dapat dibuka.'));
      notify(errorMessage(error, 'Halaman ini belum dapat dibuka.'), 'error', 'Gagal memuat halaman');
    }
  }
  function needLinkedWarga(serviceName) {
    return `<section class="admin-card warga-empty-state"><span class="warga-empty-icon">i</span><h2>Data warga belum tertaut</h2><p>Menu ${esc(serviceName)} baru dapat digunakan setelah akun Anda dihubungkan dengan data warga oleh pengurus RT.</p><button class="warga-btn-secondary" type="button" data-page-jump="profil">Periksa Profil Saya</button></section>`;
  }
  async function dashboardMarkup() {
    state.dashboardWarnings = [];
    const today = todayKey();
    const [suratResult, aspirasiResult, agendaResult, announcementResult, cashResult] = await Promise.allSettled([
      state.warga ? loadOwnRows('surat_pengajuan') : Promise.resolve([]),
      state.warga ? loadOwnRows('aspirasi') : Promise.resolve([]),
      getRows('agenda', q => q.gte('tanggal', today).order('tanggal', { ascending: true }).limit(5)),
      getRows('pengumuman', q => q.order('published_at', { ascending: false }).limit(4)),
      getRows('transaksi_keuangan', q => q.order('tanggal', { ascending: false }), 'jenis,nominal')
    ]);
    const surat = resultValue(suratResult, 'surat_pengajuan');
    const aspirasi = resultValue(aspirasiResult, 'aspirasi');
    const agenda = resultValue(agendaResult, 'agenda');
    const announcements = resultValue(announcementResult, 'pengumuman');
    const cash = resultValue(cashResult, 'transaksi_keuangan');
    const pending = surat.filter(item => item.status !== 'selesai' && item.status !== 'ditolak').length;
    const income = cash.filter(item => String(item.jenis).toLowerCase() === 'pemasukan').reduce((sum, item) => sum + Number(item.nominal || 0), 0);
    const expense = cash.filter(item => String(item.jenis).toLowerCase() === 'pengeluaran').reduce((sum, item) => sum + Number(item.nominal || 0), 0);
    const warningMarkup = state.dashboardWarnings.length ? `<div class="warga-inline-warning warga-data-warning">Sebagian data tidak berhasil dimuat (${state.dashboardWarnings.map(esc).join(', ')}). Periksa koneksi dan kebijakan akses Supabase jika data seharusnya tersedia.</div>` : '';
    return `${warningMarkup}<div class="warga-welcome-banner"><div><span class="warga-eyebrow">RUANG WARGA DIGITAL</span><h2>Guyu rukun, mbangun Dawung bebarengan.</h2><p>Urus layanan, pantau kegiatan, dan sampaikan aspirasi dengan lebih mudah.</p><div class="warga-banner-actions"><button type="button" class="warga-btn-primary" data-page-jump="surat">＋ Ajukan Surat</button><button type="button" class="warga-btn-ghost" data-page-jump="agenda">Lihat Agenda</button></div></div><div class="warga-banner-art" aria-hidden="true"><span>🌿</span><small>RT 04 · RW 01</small></div></div>
      <div class="admin-kpis warga-kpis"><div><span>▤</span><small>Total Surat Saya</small><b>${surat.length}</b><em>${pending} masih diproses</em></div><div><span>♡</span><small>Aspirasi Saya</small><b>${aspirasi.length}</b><em>Usulan dan laporan terkirim</em></div><div><span>◷</span><small>Agenda Mendatang</small><b>${agenda.length}</b><em>Kegiatan lingkungan</em></div><div><span>◉</span><small>Saldo Kas RT</small><b class="warga-money">${money(income - expense)}</b><em>Ringkasan kas lingkungan</em></div></div>
      ${!state.warga ? needLinkedWarga('layanan warga') : ''}
      <div class="warga-dashboard-grid"><section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">PELAYANAN</span><h2>Pengajuan Terbaru</h2><p>Perkembangan layanan surat Anda.</p></div><button class="warga-link-btn" type="button" data-page-jump="surat">Lihat semua <span>→</span></button></div>${surat.length ? `<div class="warga-list">${surat.slice(0,4).map(item => `<article class="warga-list-row"><span class="warga-list-icon">▤</span><div class="warga-list-copy"><b>${esc(labelJenis(item.jenis))}</b><small>${formatDate(item.created_at, false)} · ${esc(item.nomor_surat || 'Nomor belum tersedia')}</small></div>${badgeStatus(item.status)}</article>`).join('')}</div>` : `<div class="warga-inline-empty"><span>▤</span><b>Belum ada pengajuan surat</b><small>Ajukan surat bila membutuhkan layanan administrasi.</small><button class="warga-btn-secondary" type="button" data-page-jump="surat">Mulai Pengajuan</button></div>`}</section>
      <section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">KEGIATAN</span><h2>Agenda Terdekat</h2><p>Jadwal kegiatan warga berikutnya.</p></div><button class="warga-link-btn" type="button" data-page-jump="agenda">Semua agenda <span>→</span></button></div>${agenda.length ? `<div class="warga-agenda-list">${agenda.slice(0,4).map(item => `<article class="warga-agenda-row"><div class="warga-date-tile"><b>${new Date(item.tanggal + 'T00:00:00').getDate()}</b><small>${new Intl.DateTimeFormat('id-ID',{month:'short'}).format(new Date(item.tanggal+'T00:00:00'))}</small></div><div><b>${esc(item.judul)}</b><small>${esc(item.jam || 'Waktu menyusul')} · ${esc(item.lokasi || 'Lokasi menyusul')}</small></div></article>`).join('')}</div>` : `<div class="warga-inline-empty"><span>◷</span><b>Belum ada agenda terjadwal</b><small>Agenda baru akan tampil di sini.</small></div>`}</section></div>
      <section class="admin-card warga-panel warga-announcement-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">INFORMASI RT</span><h2>Pengumuman Warga</h2><p>Informasi resmi terbaru dari pengurus.</p></div><button class="warga-link-btn" type="button" data-page-jump="agenda">Buka informasi <span>→</span></button></div>${announcements.length ? `<div class="warga-announcement-grid">${announcements.map(item => `<article><span class="warga-announcement-icon">✦</span><div><b>${esc(item.judul)}</b><small>${formatDate(item.published_at || item.created_at)}</small><p>${esc(item.isi)}</p></div></article>`).join('')}</div>` : `<div class="warga-inline-empty"><b>Belum ada pengumuman</b><small>Informasi pengurus akan muncul di sini.</small></div>`}</section>`;
  }
  function resultValue(result, tableName) {
    if (result.status === 'fulfilled') return result.value || [];
    console.warn(`[Portal Warga] Data ${tableName} gagal dimuat`, result.reason);
    state.dashboardWarnings = state.dashboardWarnings || [];
    state.dashboardWarnings.push(tableName);
    return [];
  }
  async function suratMarkup() {
    if (!state.warga) return needLinkedWarga('Pengajuan Surat');
    const rows = await loadOwnRows('surat_pengajuan');
    window.__wargaSuratRows = rows;
    return `<section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">PELAYANAN WARGA</span><h2>Pengajuan Surat</h2><p>Ajukan surat dan pantau statusnya langsung dari akun Anda.</p></div><button class="warga-btn-primary" id="wargaNewSurat" type="button">＋ Ajukan Surat</button></div>
      <div class="warga-table-tools"><label for="wargaSuratSearch">Cari pengajuan</label><input id="wargaSuratSearch" type="search" placeholder="Cari jenis surat, nomor, atau status…"></div>
      <div class="table-scroll warga-table-scroll"><table class="wide-table warga-table"><thead><tr><th>Jenis Surat</th><th>Tanggal</th><th>Nomor Surat</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody id="wargaSuratRows">${suratRows(rows)}</tbody></table></div>
      <p class="warga-table-note">Data yang ditampilkan hanya pengajuan yang terhubung dengan akun Anda.</p></section>`;
  }
  function suratRows(rows) {
    return rows.length ? rows.map(item => `<tr><td><b>${esc(labelJenis(item.jenis))}</b><small>${esc(item.keperluan || item.catatan || '')}</small></td><td>${formatDate(item.created_at)}</td><td>${esc(item.nomor_surat || '—')}</td><td>${badgeStatus(item.status)}</td><td>${esc(item.tanggapan || item.catatan_admin || 'Belum ada catatan')}</td><td><button class="warga-table-action" type="button" data-view-surat="${esc(item.id)}">Detail</button></td></tr>`).join('') : '<tr><td colspan="6"><div class="warga-table-empty"><b>Belum ada pengajuan surat</b><small>Gunakan tombol Ajukan Surat untuk memulai.</small></div></td></tr>';
  }
  async function aspirasiMarkup() {
    if (!state.warga) return needLinkedWarga('Aspirasi & Laporan');
    const rows = await loadOwnRows('aspirasi');
    return `<section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">SUARA WARGA</span><h2>Aspirasi &amp; Laporan</h2><p>Sampaikan ide, kebutuhan, atau laporan kondisi lingkungan.</p></div><button class="warga-btn-primary" id="wargaNewAspirasi" type="button">＋ Buat Aspirasi</button></div>
      <div class="warga-aspirasi-list">${rows.length ? rows.map(item => `<article class="warga-aspirasi-card"><div class="warga-aspirasi-top"><span class="warga-aspirasi-symbol">♡</span>${badgeStatus(item.status)}</div><h3>${esc(item.judul)}</h3><p>${esc(item.isi)}</p><div class="warga-aspirasi-footer"><small>Dikirim ${formatDate(item.created_at, true)}</small>${item.tanggapan ? `<span class="warga-response"><b>Tanggapan pengurus</b>${esc(item.tanggapan)}</span>` : '<small>Belum ada tanggapan dari pengurus.</small>'}</div></article>`).join('') : '<div class="warga-table-empty warga-card-empty"><span>♡</span><b>Belum ada aspirasi atau laporan</b><small>Aspirasi yang Anda kirim akan tersimpan di sini.</small></div>'}</div></section>`;
  }
  async function agendaMarkup() {
    const today = todayKey();
    const [agenda, announcements] = await Promise.all([
      getRows('agenda', q => q.gte('tanggal', today).order('tanggal', { ascending: true })),
      getRows('pengumuman', q => q.order('published_at', { ascending: false }).limit(20))
    ]);
    return `<section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">KALENDER LINGKUNGAN</span><h2>Agenda Mendatang</h2><p>Jadwal kegiatan dan pertemuan warga.</p></div></div>${agenda.length ? `<div class="warga-agenda-cards">${agenda.map(item => `<article class="warga-agenda-card"><div class="warga-date-tile"><b>${new Date(item.tanggal+'T00:00:00').getDate()}</b><small>${esc(new Intl.DateTimeFormat('id-ID',{month:'short'}).format(new Date(item.tanggal+'T00:00:00')))}</small></div><div class="warga-agenda-body"><span class="warga-eyebrow">AGENDA WARGA</span><h3>${esc(item.judul)}</h3><p>${esc(item.deskripsi || 'Kegiatan warga Dusun Dawung.')}</p><div class="warga-agenda-meta"><span>◷ ${esc(item.jam || 'Waktu menyusul')}</span><span>⌖ ${esc(item.lokasi || 'Lokasi menyusul')}</span></div></div></article>`).join('')}</div>` : '<div class="warga-table-empty"><b>Belum ada agenda mendatang</b><small>Agenda kegiatan akan muncul setelah diumumkan pengurus.</small></div>'}</section>
      <section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">KABAR DUSUN</span><h2>Pengumuman Terbaru</h2><p>Informasi yang diterbitkan oleh pengurus RT.</p></div></div>${announcements.length ? `<div class="warga-notice-list">${announcements.map(item => `<article><span class="warga-notice-icon">✦</span><div><b>${esc(item.judul)}</b><small>${formatDate(item.published_at || item.created_at, true)}</small><p>${esc(item.isi)}</p></div></article>`).join('')}</div>` : '<div class="warga-table-empty"><b>Belum ada pengumuman baru</b><small>Silakan periksa kembali nanti.</small></div>'}</section>`;
  }
  async function notifikasiMarkup() {
    await loadNotificationCount();
    const rows = state.notifications;
    return `<section class="admin-card warga-panel"><div class="warga-panel-head"><div><span class="warga-eyebrow">PUSAT NOTIFIKASI</span><h2>Notifikasi Saya</h2><p>Pesan layanan dan informasi untuk akun Anda.</p></div>${state.unread ? '<button class="warga-btn-secondary" id="wargaMarkAllRead" type="button">Tandai semua dibaca</button>' : ''}</div>
      <div class="warga-notification-list">${rows.length ? rows.map(item => `<article class="warga-notification-item ${item.dibaca ? '' : 'is-unread'}"><span class="warga-notification-dot">${item.dibaca ? '✓' : '•'}</span><div><b>${esc(item.judul)}</b><small>${formatDate(item.created_at, true)}</small><p>${esc(item.isi)}</p></div>${item.dibaca ? '' : `<button class="warga-table-action" type="button" data-mark-read="${esc(item.id)}">Tandai dibaca</button>`}</article>`).join('') : '<div class="warga-table-empty"><span>♧</span><b>Belum ada notifikasi</b><small>Notifikasi dari pengurus akan muncul di halaman ini.</small></div>'}</div></section>`;
  }
  function profilMarkup() {
    const profile = state.profile || {};
    const warga = state.warga || {};
    return `<section class="admin-card warga-panel"><div class="warga-profile-hero"><div class="warga-profile-avatar">${esc(initials(profile.nama || warga.nama))}</div><div><span class="warga-eyebrow">AKUN WARGA</span><h2>${esc(profile.nama || warga.nama || 'Warga')}</h2><p>${esc(profile.email || state.user?.email || 'Email belum tersedia')}</p>${badgeStatus(warga.status || 'aktif')}</div></div>
      <div class="warga-profile-grid"><div><small>Nama lengkap</small><b>${esc(profile.nama || warga.nama || '—')}</b></div><div><small>Email akun</small><b>${esc(profile.email || state.user?.email || '—')}</b></div><div><small>NIK</small><b>${warga.nik ? esc(maskNik(warga.nik)) : 'Belum terhubung'}</b></div><div><small>Nomor KK</small><b>${warga.no_kk ? esc(maskNik(warga.no_kk)) : '—'}</b></div><div><small>Alamat</small><b>${esc(warga.alamat || 'Belum diisi')}</b></div><div><small>Wilayah</small><b>RT ${esc(warga.rt || '04')} / RW ${esc(warga.rw || '01')}</b></div></div>
      <div class="warga-profile-actions"><button type="button" class="warga-btn-primary" id="wargaEditProfile">Edit Profil</button><small>Untuk mengganti email login atau NIK, silakan hubungi pengurus RT.</small></div>
      ${!state.warga ? '<div class="warga-inline-warning">Data profil akun belum dihubungkan dengan data penduduk. Hubungi pengurus RT agar layanan surat dan aspirasi dapat digunakan.</div>' : ''}</section>`;
  }
  function maskNik(value) {
    const str = String(value || '');
    return str.length > 6 ? str.slice(0, 4) + '••••••••' + str.slice(-4) : str;
  }
  function bindPageActions(page) {
    app.querySelectorAll('[data-page-jump]').forEach(button => button.addEventListener('click', () => {
      const next = button.dataset.pageJump;
      history.replaceState(null, '', '#' + next);
      renderPage(next);
    }));
    if (page === 'surat') {
      $('#wargaNewSurat')?.addEventListener('click', openSuratModal);
      const search = $('#wargaSuratSearch');
      search?.addEventListener('input', () => {
        const rows = window.__wargaSuratRows || [];
        const q = search.value.trim().toLowerCase();
        $('#wargaSuratRows').innerHTML = suratRows(rows.filter(item => [labelJenis(item.jenis), item.nomor_surat, item.status, item.keperluan, item.catatan, item.catatan_admin].join(' ').toLowerCase().includes(q)));
        bindDetailButtons();
      });
      window.__wargaSuratRows = window.__wargaSuratRows || [];
      bindDetailButtons();
    }
    if (page === 'aspirasi') $('#wargaNewAspirasi')?.addEventListener('click', openAspirasiModal);
    if (page === 'profil') $('#wargaEditProfile')?.addEventListener('click', openProfileModal);
    if (page === 'notifikasi') {
      app.querySelectorAll('[data-mark-read]').forEach(button => button.addEventListener('click', () => markNotificationRead(button.dataset.markRead)));
      $('#wargaMarkAllRead')?.addEventListener('click', markAllNotificationsRead);
    }
  }
  function bindDetailButtons() {
    app.querySelectorAll('[data-view-surat]').forEach(button => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        const row = (window.__wargaSuratRows || []).find(item => String(item.id) === button.dataset.viewSurat);
        if (!row) return;
        openModal('Detail Pengajuan Surat', `<div class="warga-detail-list"><div><small>Jenis surat</small><b>${esc(labelJenis(row.jenis))}</b></div><div><small>Tanggal pengajuan</small><b>${formatDate(row.created_at, true)}</b></div><div><small>Nomor surat</small><b>${esc(row.nomor_surat || 'Belum tersedia')}</b></div><div><small>Status</small><b>${badgeStatus(row.status)}</b></div><div><small>Keperluan / catatan</small><p>${esc(row.keperluan || row.catatan || 'Tidak ada keterangan tambahan.')}</p></div><div><small>Catatan pengurus</small><p>${esc(row.tanggapan || row.catatan_admin || 'Belum ada catatan dari pengurus.')}</p></div></div>`, 'Tutup', async () => true, 'neutral', true);
      });
    });
  }
  function openSuratModal() {
    if (!state.warga) { notify('Data warga Anda belum tertaut. Hubungi pengurus RT terlebih dahulu.', 'warning', 'Belum dapat mengajukan surat'); return; }
    const options = jenisSurat.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
    openModal('Ajukan Surat', `<p class="warga-modal-intro">Pilih jenis surat dan tuliskan keperluan Anda dengan jelas.</p><label class="warga-field">Jenis surat<select name="jenis"><option value="">Pilih jenis surat</option>${options}</select></label><label class="warga-field">Keperluan<textarea name="keperluan" rows="4" placeholder="Contoh: persyaratan administrasi…"></textarea></label><div class="warga-form-note">Data pemohon akan menggunakan profil warga yang sudah terhubung dengan akun Anda.</div>`, 'Kirim Pengajuan', async form => {
      const jenis = form.get('jenis');
      const keperluan = String(form.get('keperluan') || '').trim();
      if (!jenis) { notify('Silakan pilih jenis surat terlebih dahulu.', 'warning', 'Jenis surat belum dipilih'); return false; }
      if (keperluan.length < 8) { notify('Tuliskan keperluan minimal 8 karakter agar pengurus memahami permintaan Anda.', 'warning', 'Keperluan belum lengkap'); return false; }
      const payload = { warga_id: state.warga.id, pemohon_nama: state.warga.nama, jenis, keperluan, data_form: { pemohon_nama: state.warga.nama, nik: state.warga.nik, no_kk: state.warga.no_kk, alamat: state.warga.alamat }, tanggal_pengajuan: todayKey() };
      const { error } = await sb.from('surat_pengajuan').insert(payload);
      if (error) { notify(errorMessage(error, 'Pengajuan surat belum berhasil dikirim.'), 'error', 'Pengajuan gagal'); return false; }
      notify('Pengajuan surat berhasil dikirim dan akan diproses pengurus.', 'success', 'Pengajuan terkirim');
      await renderPage('surat');
      return true;
    });
  }
  function openAspirasiModal() {
    if (!state.warga) { notify('Data warga Anda belum tertaut. Hubungi pengurus RT terlebih dahulu.', 'warning', 'Belum dapat mengirim aspirasi'); return; }
    openModal('Buat Aspirasi atau Laporan', `<p class="warga-modal-intro">Ceritakan usulan atau kondisi yang perlu ditindaklanjuti pengurus.</p><label class="warga-field">Judul<input name="judul" maxlength="120" placeholder="Ringkasan aspirasi atau laporan"></label><label class="warga-field">Isi laporan<textarea name="isi" rows="5" maxlength="3000" placeholder="Jelaskan lokasi, kondisi, atau saran Anda"></textarea></label>`, 'Kirim Aspirasi', async form => {
      const judul = String(form.get('judul') || '').trim();
      const isi = String(form.get('isi') || '').trim();
      if (judul.length < 4) { notify('Judul minimal 4 karakter.', 'warning', 'Judul belum lengkap'); return false; }
      if (isi.length < 10) { notify('Isi aspirasi minimal 10 karakter.', 'warning', 'Isi laporan belum lengkap'); return false; }
      const { error } = await sb.from('aspirasi').insert({ warga_id: state.warga.id, nama: state.warga.nama, judul, isi });
      if (error) { notify(errorMessage(error, 'Aspirasi belum berhasil dikirim.'), 'error', 'Pengiriman gagal'); return false; }
      notify('Aspirasi atau laporan berhasil dikirim kepada pengurus.', 'success', 'Aspirasi terkirim');
      await renderPage('aspirasi');
      return true;
    });
  }
  function openProfileModal() {
    const profileName = state.profile?.nama || state.warga?.nama || '';
    const address = state.warga?.alamat || '';
    openModal('Edit Profil Saya', `<p class="warga-modal-intro">Ubah informasi dasar agar pengurus lebih mudah menghubungi Anda.</p><label class="warga-field">Nama lengkap<input name="nama" maxlength="120" value="${esc(profileName)}" autocomplete="name"></label><label class="warga-field">Alamat<input name="alamat" maxlength="240" value="${esc(address)}" autocomplete="street-address" ${state.warga ? '' : 'disabled'}></label><div class="warga-form-note">Email login dan NIK tidak bisa diubah dari menu ini.</div>`, 'Simpan Profil', async form => {
      const nama = String(form.get('nama') || '').trim();
      const alamat = String(form.get('alamat') || '').trim();
      if (nama.length < 3) { notify('Nama lengkap minimal 3 karakter.', 'warning', 'Nama belum lengkap'); return false; }
      const { error: profileError } = await sb.from('profiles').update({ nama }).eq('id', state.user.id);
      if (profileError) { notify(errorMessage(profileError, 'Profil belum berhasil diperbarui.'), 'error', 'Gagal menyimpan profil'); return false; }
      if (state.warga) {
        const { error: wargaError } = await sb.from('warga').update({ nama, alamat }).eq('id', state.warga.id);
        if (wargaError) {
          // Best-effort rollback so the profile and resident record stay in sync.
          await sb.from('profiles').update({ nama: profileName }).eq('id', state.user.id);
          notify(errorMessage(wargaError, 'Alamat belum berhasil diperbarui.'), 'error', 'Perubahan belum tersimpan');
          return false;
        }
        state.warga.nama = nama;
        state.warga.alamat = alamat;
      }
      state.profile.nama = nama;
      refreshIdentity();
      notify('Profil Anda berhasil diperbarui.', 'success', 'Profil tersimpan');
      await renderPage('profil');
      return true;
    });
  }
  async function markNotificationRead(id) {
    const { error } = await sb.from('notifikasi').update({ dibaca: true }).eq('id', id).eq('user_id', state.user.id);
    if (error) { notify(errorMessage(error, 'Notifikasi belum dapat diperbarui.'), 'error', 'Gagal memperbarui'); return; }
    notify('Notifikasi ditandai sudah dibaca.', 'success');
    await renderPage('notifikasi');
  }
  async function markAllNotificationsRead() {
    const { error } = await sb.from('notifikasi').update({ dibaca: true }).eq('user_id', state.user.id).eq('dibaca', false);
    if (error) { notify(errorMessage(error, 'Notifikasi belum dapat diperbarui.'), 'error', 'Gagal memperbarui'); return; }
    notify('Semua notifikasi sudah ditandai dibaca.', 'success');
    await renderPage('notifikasi');
  }
  function openModal(title, body, submitLabel, submitHandler, variant = 'neutral', noForm = false) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'warga-modal-overlay';
    overlay.innerHTML = `<section class="warga-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="warga-modal-header"><div><span class="warga-eyebrow">PORTAL WARGA</span><h2>${esc(title)}</h2></div><button type="button" class="warga-modal-close" aria-label="Tutup dialog">×</button></header>${noForm ? `<div class="warga-modal-body">${body}</div>` : `<form class="warga-modal-form" novalidate><div class="warga-modal-body">${body}</div><footer class="warga-modal-actions"><button type="button" class="warga-btn-secondary warga-cancel">Batal</button><button type="submit" class="warga-btn-primary ${variant === 'danger' ? 'warga-btn-danger' : ''}">${esc(submitLabel || 'Simpan')}</button></footer></form>`}${noForm ? `<footer class="warga-modal-actions"><button type="button" class="warga-btn-primary warga-cancel">${esc(submitLabel || 'Tutup')}</button></footer>` : ''}</section>`;
    document.body.appendChild(overlay);
    const close = () => closeModal();
    $('.warga-modal-close', overlay).addEventListener('click', close);
    $('.warga-cancel', overlay)?.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    const form = $('.warga-modal-form', overlay);
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = $('button[type="submit"]', form);
      const originalText = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Memproses…';
      try {
        const shouldClose = await submitHandler(new FormData(form));
        if (shouldClose !== false) close();
      } catch (error) {
        notify(errorMessage(error, 'Permintaan belum berhasil. Coba kembali.'), 'error', 'Terjadi kesalahan');
      } finally {
        if (submit.isConnected) { submit.disabled = false; submit.textContent = originalText; }
      }
    });
    $('.warga-modal-close', overlay).focus();
  }
  function closeModal() { $('.warga-modal-overlay')?.remove(); }

  document.addEventListener('DOMContentLoaded', initialise);
})();
