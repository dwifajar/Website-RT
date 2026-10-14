(function () {
  'use strict';

  const roleButtons = document.querySelectorAll('.tabs button');
  let selectedRole = 'warga';
  const form = document.querySelector('#loginForm');
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;

  function notify(message, type = 'info', duration, title) {
    const ms = Number.isFinite(duration) ? duration : (type === 'error' ? 4400 : 3400);
    if (window.premiumToast && typeof window.premiumToast.show === 'function') {
      return window.premiumToast.show(message, type, ms, title);
    }
    // Lightweight fallback in case the toast script failed to load.
    let stack = document.querySelector('.premium-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'premium-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const node = document.createElement('div');
    node.className = 'premium-toast';
    node.dataset.type = type;
    const icon = type === 'success' ? '✓' : type === 'warning' ? '!' : type === 'error' ? '×' : 'i';
    const heading = title || ({ success: 'Berhasil', info: 'Informasi', warning: 'Perhatian', error: 'Login gagal' }[type] || 'Informasi');
    const iconNode = document.createElement('span'); iconNode.className = 'premium-toast-icon'; iconNode.textContent = icon;
    const copy = document.createElement('div'); copy.className = 'premium-toast-copy';
    const titleNode = document.createElement('div'); titleNode.className = 'premium-toast-title'; titleNode.textContent = heading;
    const messageNode = document.createElement('div'); messageNode.className = 'premium-toast-message'; messageNode.textContent = message;
    copy.append(titleNode, messageNode);
    const close = document.createElement('button'); close.className = 'premium-toast-close'; close.type = 'button'; close.setAttribute('aria-label', 'Tutup notifikasi'); close.textContent = '×';
    const bar = document.createElement('span'); bar.className = 'premium-toast-progress'; bar.style.setProperty('--toast-duration', ms + 'ms');
    node.append(iconNode, copy, close, bar); stack.appendChild(node);
    const remove = () => { if (node.isConnected) { node.classList.add('leaving'); setTimeout(() => node.remove(), 300); } };
    close.addEventListener('click', remove); setTimeout(remove, ms); return node;
  }

  function friendlyAuthError(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('invalid login credentials') || text.includes('invalid_credentials')) {
      return 'Email atau password tidak sesuai. Periksa kembali data login Anda.';
    }
    if (text.includes('email not confirmed')) {
      return 'Email belum dikonfirmasi. Periksa email Anda atau hubungi pengurus RT.';
    }
    if (text.includes('too many requests') || text.includes('rate limit')) {
      return 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat lalu coba lagi.';
    }
    if (text.includes('failed to fetch') || text.includes('network')) {
      return 'Koneksi ke layanan login terganggu. Periksa internet lalu coba lagi.';
    }
    return 'Login belum berhasil. Periksa data Anda dan coba kembali.';
  }

  function setLoading(isLoading) {
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.style.opacity = isLoading ? '.75' : '';
    submitButton.style.cursor = isLoading ? 'wait' : '';
    submitButton.innerHTML = isLoading ? 'Memeriksa akun… <span class="login-loading-dot">●</span>' : 'Login <span>→</span>';
  }

  roleButtons.forEach(button => button.addEventListener('click', () => {
    selectedRole = button.dataset.role || 'warga';
    roleButtons.forEach(item => item.classList.remove('active'));
    button.classList.add('active');
  }));

  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const identity = document.querySelector('#identity').value.trim();
    const password = document.querySelector('#password').value;

    if (!window.DAWUNG_SUPABASE) {
      notify('Layanan login belum siap. Muat ulang halaman beberapa saat lagi.', 'error', 4500, 'Koneksi belum tersedia');
      return;
    }

    setLoading(true);
    let willRedirect = false;
    try {
      const { data, error } = await window.DAWUNG_SUPABASE.auth.signInWithPassword({ email: identity, password });
      if (error) {
        notify(friendlyAuthError(error.message), 'error', 4400, 'Login gagal');
        return;
      }

      const { data: profile, error: profileError } = await window.DAWUNG_SUPABASE
        .from('profiles').select('role,nama').eq('id', data.user.id).single();

      if (profileError || !profile) {
        await window.DAWUNG_SUPABASE.auth.signOut();
        notify('Profil pengguna belum dibuat oleh pengurus. Silakan hubungi admin RT.', 'warning', 4600, 'Profil belum tersedia');
        return;
      }
      if (selectedRole !== 'warga' && !['admin', 'ketua_rt', 'super_admin'].includes(profile.role)) {
        await window.DAWUNG_SUPABASE.auth.signOut();
        notify('Akun ini tidak memiliki akses pengurus. Pilih tab Warga jika Anda warga.', 'warning', 4600, 'Akses pengurus ditolak');
        return;
      }
      if (selectedRole === 'warga' && profile.role !== 'warga') {
        await window.DAWUNG_SUPABASE.auth.signOut();
        notify('Akun ini terdaftar sebagai pengurus. Pilih tab Pengurus/Admin untuk masuk.', 'warning', 4600, 'Pilih jenis akun yang sesuai');
        return;
      }

      localStorage.setItem('dawung_auth', profile.role);
      localStorage.setItem('dawung_user', JSON.stringify({ id: data.user.id, nama: profile.nama, email: data.user.email, role: profile.role }));
      const isAdmin = ['admin', 'ketua_rt', 'super_admin'].includes(profile.role);
      notify('Login berhasil. Mengalihkan ke halaman Anda…', 'success', 1200, 'Selamat datang');
      willRedirect = true;
      const targetPath = isAdmin ? '/admin/index.html' : '/warga/index.html';
      setTimeout(() => location.assign(new URL(targetPath, window.location.origin).href), 450);
    } catch (error) {
      console.error('[Login]', error);
      notify(friendlyAuthError(error && error.message), 'error', 4400, 'Koneksi bermasalah');
    } finally {
      // Keep the button disabled briefly when navigating after a successful login.
      if (!willRedirect) setLoading(false);
    }
  });

  const forgotButton = document.querySelector('#forgot');
  if (forgotButton) forgotButton.addEventListener('click', async event => {
    event.preventDefault();
    const email = document.querySelector('#identity').value.trim();
    if (!window.DAWUNG_SUPABASE) {
      notify('Layanan login belum siap. Coba muat ulang halaman.', 'error', 4300, 'Koneksi belum tersedia');
      return;
    }
    if (!email || !email.includes('@')) {
      notify('Masukkan alamat email yang valid pada kolom Email / NIK terlebih dahulu.', 'warning', 4200, 'Email diperlukan');
      document.querySelector('#identity').focus();
      return;
    }
    try {
      const { error } = await window.DAWUNG_SUPABASE.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/login.html' });
      if (error) notify('Permintaan reset password belum berhasil. Coba kembali beberapa saat lagi.', 'error', 4300, 'Reset password gagal');
      else notify('Jika email terdaftar, tautan reset password akan dikirim. Periksa kotak masuk dan folder spam.', 'success', 4800, 'Permintaan reset dikirim');
    } catch (error) {
      console.error('[Reset password]', error);
      notify('Tidak dapat menghubungi layanan reset password. Periksa koneksi internet Anda.', 'error', 4300, 'Koneksi bermasalah');
    }
  });

  const registerButton = document.querySelector('#register');
  if (registerButton) registerButton.addEventListener('click', event => {
    event.preventDefault();
    notify('Pendaftaran warga akan diproses setelah diverifikasi oleh pengurus RT.', 'info', 4000, 'Informasi pendaftaran');
  });
})();
