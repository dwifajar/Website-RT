const DBKEY = 'dawung_db_v2';
const seed = {
  settings:{name:'Dusun Dawung',rt:'04',rw:'01',slogan:'Sepi Ing Pamrih, Rame Ing Gawe',footer_title:'Portal Digital Dusun Dawung',footer_description:'Layanan warga, informasi kegiatan, dan transparansi lingkungan dalam satu portal digital.',footer_address:'Dusun Dawung RT.04 RW.01',footer_contact:'Untuk bantuan layanan, silakan hubungi Ketua RT atau pengurus setempat.',footer_phone:'',footer_email:'',footer_copyright:'© 2026 Portal Warga Dusun Dawung. Hak cipta dilindungi.'},
  warga:[], kk:[],
  surat:[
    {id:1,nama:'Budi Santoso',jenis:'Surat Domisili',tanggal:'02 Okt 2026',status:'Diproses'},
    {id:2,nama:'Siti Aminah',jenis:'SKTM',tanggal:'01 Okt 2026',status:'Selesai'},
    {id:3,nama:'Joko Prasetyo',jenis:'Surat Pengantar',tanggal:'01 Okt 2026',status:'Menunggu'}
  ],
  agenda:[
    {id:1,tanggal:'05 Okt 2026',jam:'07.00 WIB',judul:'Kerja Bakti Lingkungan',lokasi:'Lapangan Dusun'},
    {id:2,tanggal:'07 Okt 2026',jam:'20.00 WIB',judul:'Rapat Pengurus RT',lokasi:'Balai RT'},
    {id:3,tanggal:'12 Okt 2026',jam:'08.00 WIB',judul:'Posyandu Balita',lokasi:'Balai RT'}
  ],
  pengumuman:[
    {id:1,judul:'Jadwal ronda bulan Oktober',tanggal:'01 Okt 2026',isi:'Jadwal ronda bulan Oktober telah diperbarui.'},
    {id:2,judul:'Kerja bakti pembersihan saluran air',tanggal:'30 Sep 2026',isi:'Mari hadir dan bergotong royong.'}
  ],
  keuangan:[
    {id:1,tanggal:'01 Okt 2026',jenis:'Pemasukan',kategori:'Iuran warga',nominal:12500000,keterangan:'Iuran warga'},
    {id:2,tanggal:'02 Okt 2026',jenis:'Pengeluaran',kategori:'Kebersihan',nominal:4080000,keterangan:'Peralatan kebersihan'}
  ],
  aspirasi:[{id:1,nama:'Budi Santoso',judul:'Lampu jalan',isi:'Mohon lampu di gang timur diperiksa.',status:'Baru',tanggal:'02 Okt 2026'}]
};
function db(){try{const x=localStorage.getItem(DBKEY);if(x)return JSON.parse(x)}catch(e){}localStorage.setItem(DBKEY,JSON.stringify(seed));return structuredClone(seed)}
function save(x){localStorage.setItem(DBKEY,JSON.stringify(x));return x}
function money(n){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast(msg){if(window.showPremiumToast){const s=String(msg||'');const type=/gagal|error|tidak berhasil|kesalahan/i.test(s)?'error':/peringatan|perhatian|konfirmasi/i.test(s)?'warning':/berhasil|tersimpan|dihapus|diperbarui/i.test(s)?'success':'info';window.showPremiumToast(s,type,3200);return}const t=document.querySelector('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function card(content,cls=''){return `<section class="admin-card ${cls}">${content}</section>`}
function table(rows,heads){return `<div class="table-scroll"><table class="wide-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}"><small>Belum ada data.</small></td></tr>`}</tbody></table></div>`}
function head(t){A.title.textContent=t}
let ADMIN_SESSION_PROFILE=null;
// Normalize role identifiers centrally so capitalization or spaces cannot hide
// role-management controls. Database/RLS remains the authority for writes.
function normalizeRoleKey(role){
  const key=String(role??'').trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g,'_');
  if(key==='superadmin')return 'super_admin';
  if(key==='petugasiuran')return 'petugas_iuran';
  return key;
}
function currentAdminRoleKey(){return normalizeRoleKey(ADMIN_SESSION_PROFILE?.role||window.__DAWUNG_ADMIN_PROFILE?.role);}
function isCurrentSuperAdmin(){return currentAdminRoleKey()==='super_admin';}
function sameAdminUserId(a,b){return String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase();}
function adminRoleLabel(role){return ({super_admin:'Super Admin',admin:'Admin Pengurus',ketua_rt:'Ketua RT',petugas_iuran:'Petugas Iuran'})[normalizeRoleKey(role)]||'Admin';}
function adminWelcomeTitle(){return `Selamat Datang, ${adminRoleLabel(ADMIN_SESSION_PROFILE?.role)}! 👋`;}
function modal(title,body,submit){
  document.querySelector('.modal')?.remove();
  const m=document.createElement('div');m.className='modal';
  m.innerHTML=`<div class="modal-box"><div class="card-head"><h3>${esc(title)}</h3><button type="button" id="modalClose">×</button></div><div class="modal-body">${body}</div><div class="modal-actions"><button type="button" id="modalCancel">Batal</button><button type="button" class="green-mini" id="modalSave">Simpan</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#modalClose').onclick=closeModal;m.querySelector('#modalCancel').onclick=closeModal;m.querySelector('#modalSave').onclick=submit;
}
function closeModal(){document.querySelector('.modal')?.remove()}
window.closeModal=closeModal;

const A={d:db(),app:document.querySelector('#app'),title:document.querySelector('#pageTitle')};

// Router state is derived once from the URL. Every admin page is rendered
// from this value so no asynchronous data callback can force Dashboard first.
const ADMIN_PAGE_PARAM = new URLSearchParams(window.location.search).get('page') || 'dashboard';
const ADMIN_ALLOWED_PAGES = new Set(['dashboard','warga','kk','agenda','pengumuman','keuangan','wilayah-iuran','aspirasi','galeri','pengguna','pengaturan']);
const ADMIN_REQUESTED_PAGE = ADMIN_ALLOWED_PAGES.has(ADMIN_PAGE_PARAM) ? ADMIN_PAGE_PARAM : 'dashboard';
window.__ADMIN_REQUESTED_PAGE = ADMIN_REQUESTED_PAGE;

const ADMIN_ROLES=['admin','ketua_rt','super_admin'];

async function ensureAdminSession(){
  const sb=window.DAWUNG_SUPABASE;
  if(!sb){
    location.href='../login.html';
    return null;
  }

  const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError || !user){
    localStorage.removeItem('dawung_auth');
    localStorage.removeItem('dawung_user');
    location.href='../login.html';
    return null;
  }

  const {data:profile,error:profileError}=await sb
    .from('profiles')
    .select('role,nama')
    .eq('id',user.id)
    .maybeSingle();

  const profileRole=normalizeRoleKey(profile?.role);
  if(profileError || !profile || !ADMIN_ROLES.includes(profileRole)){
    localStorage.removeItem('dawung_auth');
    localStorage.removeItem('dawung_user');
    location.href='../login.html';
    return null;
  }

  localStorage.setItem('dawung_auth',profileRole);
  localStorage.setItem('dawung_user',JSON.stringify({
    id:user.id,
    nama:profile.nama || 'Admin Pengurus',
    email:user.email || '',
    role:profileRole
  }));

  ADMIN_SESSION_PROFILE={id:user.id,nama:profile.nama||'',email:user.email||'',role:profileRole};
  window.__DAWUNG_ADMIN_PROFILE=ADMIN_SESSION_PROFILE;
  const avatar=document.querySelector('#adminRoleAvatar');
  if(avatar){avatar.textContent=({super_admin:'SA',admin:'AP',ketua_rt:'RT'})[profileRole]||'AD';avatar.title=adminRoleLabel(profileRole);}

  return {user,profile};
}

document.querySelector('#todayLabel').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
document.querySelector('#logout').onclick=async()=>{try{await window.DAWUNG_SUPABASE?.auth.signOut()}catch(e){}localStorage.removeItem('dawung_auth');localStorage.removeItem('dawung_user');location.href='../login.html'};
document.querySelector('#adminHamb').onclick=()=>document.querySelector('.admin-side').classList.toggle('open');

const adminNav=document.querySelector('#adminNav');

// Menjaga compatibility untuk link internal seperti "Kelola" di Dashboard.
// Navigasi selalu dilakukan lewat URL agar tidak ada dua renderer yang berlomba.
function adminTargetUrl(page){
  const target=String(page||'dashboard');
  return target==='surat' ? './pengajuan.html' : `./?page=${encodeURIComponent(target)}`;
}
function openAdminPage(page){
  window.location.assign(adminTargetUrl(page));
}
window.openAdminPage=openAdminPage;

function setActiveAdminMenu(page){
  const target=String(page||'dashboard');
  document.querySelectorAll('#adminNav a[data-page]').forEach(a=>{
    a.classList.toggle('active',a.dataset.page===target);
  });
}

function render(page=ADMIN_REQUESTED_PAGE){
  const target=ADMIN_ALLOWED_PAGES.has(String(page)) ? String(page) : 'dashboard';
  setActiveAdminMenu(target);
  let result;
  if(target==='dashboard')result=dashboard();
  else if(target==='warga')result=window.renderWarga?window.renderWarga():wargaLocalFallback();
  else if(target==='kk')result=window.renderKK?window.renderKK():kkLocalFallback();
  else if(target==='agenda')result=agenda();
  else if(target==='pengumuman')result=pengumuman();
  else if(target==='keuangan')result=keuangan();
  else if(target==='wilayah-iuran')result=window.renderIuranWilayah?window.renderIuranWilayah():A.app.innerHTML=card('<b>Modul Wilayah Iuran belum termuat.</b><small>Muat ulang halaman admin.</small>','wide');
  else if(target==='aspirasi')result=aspirasi();
  else if(target==='galeri')result=window.renderAdminGallery?window.renderAdminGallery():A.app.innerHTML=card('<b>Menu Galeri Warga belum termuat.</b><small>Muat ulang halaman admin dan coba lagi.</small>','wide');
  else if(target==='pengguna')result=pengguna();
  else if(target==='pengaturan')result=pengaturan();

  if(A.app)A.app.style.visibility='visible';
  return result;
}
function dashboard(){
  head(adminWelcomeTitle());
  const inc=A.d.keuangan.filter(x=>x.jenis==='Pemasukan').reduce((a,b)=>a+Number(b.nominal),0),out=A.d.keuangan.filter(x=>x.jenis==='Pengeluaran').reduce((a,b)=>a+Number(b.nominal),0);
  const wargaCount=A.d.warga.length||0,kkCount=(A.d.kk||[]).length||0;
  A.app.innerHTML=`<div class="admin-kpis"><div><span>👥</span><small>Warga Aktif</small><b>${wargaCount}</b></div><div><span>▣</span><small>Kepala Keluarga</small><b>${kkCount}</b></div><div><span>▤</span><small>Pengajuan Surat</small><b>${A.d.surat.filter(x=>x.status!=='Selesai').length}</b></div><div><span>◉</span><small>Kas RT</small><b>${money(inc-out)}</b></div></div><div class="admin-grid">${card(`<div class="card-head"><div><b>Grafik Kas RT</b><small>Ringkasan arus kas</small></div></div><div class="bars">${[45,72,55,82,64,92,70,78].map(h=>`<i style="height:${h}%"></i>`).join('')}</div><div class="legend">▰ Pemasukan　 <span>▰ Pengeluaran</span></div>`)}${card(`<div class="card-head"><div><b>Pengajuan Terbaru</b><small>${A.d.surat.length} total pengajuan</small></div><a href="./?page=surat">Lihat Semua</a></div>${table(A.d.surat.slice(0,4).map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.jenis)}</small></td><td><label class="p ${x.status==='Selesai'?'greenp':'yellow'}">${esc(x.status)}</label></td></tr>`).join(''),['Warga','Status'])}`)}${card(`<div class="card-head"><b>Aktivitas Warga</b></div><ul class="activity">${A.d.aspirasi.slice(0,4).map(x=>`<li>🟢 <b>${esc(x.judul)}</b><small>${esc(x.tanggal)} · ${esc(x.status)}</small></li>`).join('')}</ul>`)}${card(`<div class="card-head"><b>Agenda Terdekat</b><a href="./?page=agenda">Kelola</a></div><ul class="activity">${A.d.agenda.slice(0,3).map(x=>`<li>🟢 <b>${esc(x.judul)}</b><small>${esc(x.tanggal)} · ${esc(x.jam)}</small></li>`).join('')}</ul>`)}</div>`;
}

function wargaLocalFallback(){head('Data Warga');A.app.innerHTML=card('<b>Data warga belum tersambung.</b><small>Jalankan migration Supabase dan refresh halaman.</small>','wide')}
function kkLocalFallback(){head('Kartu Keluarga');A.app.innerHTML=card('<b>Data KK belum tersambung.</b><small>Jalankan migration Supabase dan refresh halaman.</small>','wide')}

function surat(){head('Pengajuan Surat');A.app.innerHTML=card(`<div class="card-head"><div><b>Pengajuan Surat</b><small>Kelola permohonan warga</small></div><button class="green-mini" id="addSurat">＋ Pengajuan Manual</button></div>${table(A.d.surat.map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.tanggal)}</small></td><td>${esc(x.jenis)}</td><td><select onchange="statusSurat('${x.id}',this.value)"><option ${x.status==='Menunggu'?'selected':''}>Menunggu</option><option ${x.status==='Diproses'?'selected':''}>Diproses</option><option ${x.status==='Selesai'?'selected':''}>Selesai</option><option ${x.status==='Ditolak'?'selected':''}>Ditolak</option></select></td><td><button onclick="printSurat('${x.id}')">Cetak</button></td></tr>`).join(''),['Warga','Jenis','Status','Aksi'])}`,'wide');document.querySelector('#addSurat').onclick=()=>modal('Pengajuan Surat',`<label>Nama<input id="mNama"></label><label>Jenis<select id="mJenis"><option>Surat Pengantar</option><option>Surat Domisili</option><option>SKTM</option><option>Surat Usaha</option></select></label>`,()=>{const nama=document.querySelector('#mNama').value.trim();if(!nama)return toast('Nama wajib diisi');A.d.surat.push({id:Date.now(),nama,jenis:document.querySelector('#mJenis').value,tanggal:'Hari ini',status:'Menunggu'});save(A.d);closeModal();surat();toast('Pengajuan dibuat')})}
window.statusSurat=(id,s)=>{const x=A.d.surat.find(x=>String(x.id)===String(id));if(x){x.status=s;save(A.d);window.updateAdminNotificationBell?.();toast('Status diperbarui')}};
window.printSurat=id=>{const x=A.d.surat.find(x=>String(x.id)===String(id));if(!x)return;const w=window.open('','_blank');w.document.write(`<html><body style="font-family:Arial;padding:50px"><h2>RT 04 / RW 01 DUSUN DAWUNG</h2><hr><h3>SURAT ${esc(x.jenis).toUpperCase()}</h3><p>Permohonan atas nama <b>${esc(x.nama)}</b>.</p><p>Status: <b>${esc(x.status)}</b></p><p>Dusun Dawung, ${esc(x.tanggal)}</p><br><p>Ketua RT 04 / RW 01</p></body></html>`);w.document.close();w.print()};

function agenda(){head('Agenda Kegiatan');A.app.innerHTML=card(`<div class="card-head"><div><b>Agenda Kegiatan</b><small>Kelola kegiatan lingkungan</small></div><button class="green-mini" id="addAg">＋ Tambah Agenda</button></div>${table(A.d.agenda.map(x=>`<tr><td><b>${esc(x.tanggal)}</b><small>${esc(x.jam)}</small></td><td>${esc(x.judul)}</td><td>${esc(x.lokasi)}</td><td><button onclick="delAg('${x.id}')">Hapus</button></td></tr>`).join(''),['Tanggal','Kegiatan','Lokasi','Aksi'])}`,'wide');document.querySelector('#addAg').onclick=()=>modal('Tambah Agenda',`<label>Tanggal<input id="mTanggal" placeholder="20 Okt 2026"></label><label>Jam<input id="mJam" placeholder="07.00 WIB"></label><label>Kegiatan<input id="mJudul"></label><label>Lokasi<input id="mLokasi"></label>`,()=>{A.d.agenda.push({id:Date.now(),tanggal:document.querySelector('#mTanggal').value,jam:document.querySelector('#mJam').value,judul:document.querySelector('#mJudul').value,lokasi:document.querySelector('#mLokasi').value});save(A.d);closeModal();agenda();toast('Agenda ditambahkan')})}
window.delAg=async id=>{const ok=await window.DawungConfirm({title:'Hapus agenda?',entity:'Agenda kegiatan',message:'Agenda ini akan dihapus dari daftar kegiatan Dusun Dawung.',confirmText:'Ya, hapus agenda'});if(!ok)return;A.d.agenda=A.d.agenda.filter(x=>String(x.id)!==String(id));save(A.d);agenda()};

async function refreshPengumuman(){
  const sb=window.DAWUNG_SUPABASE;
  if(!sb) return false;
  const {data,error}=await sb.from('pengumuman').select('*').order('published_at',{ascending:false});
  if(error){
    console.warn('[Pengumuman] Supabase:',error);
    return false;
  }
  if(Array.isArray(data) && data.length){
    A.d.pengumuman=data.map(x=>({
      id:x.id,
      judul:x.judul,
      isi:x.isi,
      tanggal:new Date(x.published_at||x.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}),
      published_at:x.published_at,
      created_at:x.created_at
    }));
    save(A.d);
  }
  return true;
}

function pengumuman(){
  head('Pengumuman');
  A.app.innerHTML=card(`<div class="card-head"><div><b>Pengumuman</b><small>Informasi untuk warga · tersimpan di Supabase</small></div><button class="green-mini" id="addP">＋ Buat Pengumuman</button></div>${table(A.d.pengumuman.map(x=>`<tr><td><b>${esc(x.judul)}</b><small>${esc(x.tanggal)}</small></td><td>${esc(x.isi)}</td><td><button onclick="delP('${x.id}')">Hapus</button></td></tr>`).join(''),['Judul','Isi','Aksi'])}`,'wide');
  document.querySelector('#addP').onclick=()=>{
    let saving=false;
    modal('Buat Pengumuman',`<label>Judul<input id="mJudul" maxlength="160"></label><label>Isi<textarea id="mIsi" rows="5"></textarea></label>`,async()=>{
      if(saving)return;
      const saveBtn=document.querySelector('#modalSave');
      const judul=document.querySelector('#mJudul')?.value.trim()||'';
      const isi=document.querySelector('#mIsi')?.value.trim()||'';
      if(!judul||!isi){toast('Judul dan isi wajib diisi');return;}
      saving=true;
      if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Menyimpan...';saveBtn.style.pointerEvents='none';}
      try{
        const sb=window.DAWUNG_SUPABASE;
        if(sb){
          const {error}=await sb.from('pengumuman').insert({judul,isi});
          if(error)throw error;
          await refreshPengumuman();
          closeModal();pengumuman();toast('Pengumuman diterbitkan');
          return;
        }
        A.d.pengumuman.unshift({id:Date.now(),judul,isi,tanggal:'Hari ini'});save(A.d);closeModal();pengumuman();toast('Pengumuman diterbitkan (mode lokal)');
      }catch(error){
        saving=false;
        if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Simpan';saveBtn.style.pointerEvents='';}
        toast('Gagal menyimpan: '+(error?.message||error));
      }
    });
  };
}
window.delP=async id=>{
  const sb=window.DAWUNG_SUPABASE;
  const ok=await window.DawungConfirm({title:'Hapus pengumuman?',entity:'Pengumuman warga',message:'Pengumuman ini akan dihapus dan tidak lagi tampil pada portal warga.',confirmText:'Ya, hapus pengumuman'});
  if(!ok) return;
  if(sb && /^[0-9a-f-]{36}$/i.test(String(id))){
    const {error}=await sb.from('pengumuman').delete().eq('id',id);
    if(error){toast('Gagal menghapus: '+error.message);return;}
    A.d.pengumuman=A.d.pengumuman.filter(x=>String(x.id)!==String(id));save(A.d);pengumuman();return;
  }
  A.d.pengumuman=A.d.pengumuman.filter(x=>String(x.id)!==String(id));save(A.d);pengumuman();
};

function keuangan(){head('Kas & Keuangan');const inc=A.d.keuangan.filter(x=>x.jenis==='Pemasukan').reduce((a,b)=>a+Number(b.nominal),0),out=A.d.keuangan.filter(x=>x.jenis==='Pengeluaran').reduce((a,b)=>a+Number(b.nominal),0);A.app.innerHTML=`<div class="admin-kpis"><div><span>＋</span><small>Pemasukan</small><b>${money(inc)}</b></div><div><span>−</span><small>Pengeluaran</small><b>${money(out)}</b></div><div><span>◉</span><small>Saldo</small><b>${money(inc-out)}</b></div></div>`+card(`<div class="card-head"><div><b>Transaksi Kas</b><small>Catatan transparansi RT</small></div><button class="green-mini" id="addK">＋ Transaksi</button></div>${table(A.d.keuangan.map(x=>`<tr><td>${esc(x.tanggal)}</td><td><label class="p ${x.jenis==='Pemasukan'?'greenp':'redp'}">${esc(x.jenis)}</label></td><td>${esc(x.kategori)}</td><td><b>${money(x.nominal)}</b></td><td>${esc(x.keterangan)}</td><td><button onclick="delK('${x.id}')">Hapus</button></td></tr>`).join(''),['Tanggal','Jenis','Kategori','Nominal','Keterangan','Aksi'])}`,'wide');document.querySelector('#addK').onclick=()=>modal('Tambah Transaksi',`<label>Jenis<select id="mJenis"><option>Pemasukan</option><option>Pengeluaran</option></select></label><label>Kategori<input id="mKat"></label><label>Nominal<input id="mNom" type="number" min="0"></label><label>Keterangan<input id="mKet"></label>`,()=>{A.d.keuangan.push({id:Date.now(),tanggal:'Hari ini',jenis:document.querySelector('#mJenis').value,kategori:document.querySelector('#mKat').value,nominal:Number(document.querySelector('#mNom').value),keterangan:document.querySelector('#mKet').value});save(A.d);closeModal();keuangan();toast('Transaksi tersimpan')})}
window.delK=async id=>{const ok=await window.DawungConfirm({title:'Hapus transaksi kas?',entity:'Catatan kas & keuangan',message:'Transaksi yang dipilih akan dihapus dari catatan kas RT.',confirmText:'Ya, hapus transaksi'});if(!ok)return;A.d.keuangan=A.d.keuangan.filter(x=>String(x.id)!==String(id));save(A.d);keuangan()};

function aspirasi(){head('Aspirasi & Laporan');A.app.innerHTML=card(`<div class="card-head"><div><b>Aspirasi & Laporan Lingkungan</b><small>Tindak lanjut masukan warga</small></div></div>${table(A.d.aspirasi.map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.tanggal)}</small></td><td>${esc(x.judul)}</td><td>${esc(x.isi)}</td><td><select onchange="statusAsp('${x.id}',this.value)"><option ${x.status==='Baru'?'selected':''}>Baru</option><option ${x.status==='Diproses'?'selected':''}>Diproses</option><option ${x.status==='Selesai'?'selected':''}>Selesai</option></select></td></tr>`).join(''),['Warga','Judul','Isi','Status'])}`,'wide')}
window.statusAsp=(id,s)=>{const x=A.d.aspirasi.find(x=>String(x.id)===String(id));if(x){x.status=s;save(A.d);window.updateAdminNotificationBell?.();toast('Status aspirasi diperbarui')}};

let ADMIN_USERS_CACHE=[];
function pengguna(){
  head('Pengguna & Hak Akses');
  const isSuper=isCurrentSuperAdmin();
  const activeRoleLabel=adminRoleLabel(currentAdminRoleKey());
  A.app.innerHTML=card(`<div class="user-management">
    <div class="user-page-heading"><div><span class="user-kicker">MANAJEMEN AKUN</span><h2>Pengguna &amp; Hak Akses</h2><p>Kelola profil akun yang sudah terdaftar dan atur peran sesuai kewenangan.</p></div><div class="user-heading-actions"><button type="button" class="user-btn user-btn-primary" id="addUserProfile">＋ Tambah Pengguna</button><button type="button" class="user-btn user-btn-soft" id="refreshUsers">↻ Muat ulang</button></div></div>
    <div class="user-summary-grid"><div class="user-summary-card"><span class="user-summary-icon">♙</span><div><small>Total akun</small><b id="usersTotal">—</b></div></div><div class="user-summary-card"><span class="user-summary-icon warga">♧</span><div><small>Warga</small><b id="usersWarga">—</b></div></div><div class="user-summary-card"><span class="user-summary-icon pengurus">⚙</span><div><small>Pengurus</small><b id="usersPengurus">—</b></div></div><div class="user-summary-card"><span class="user-summary-icon super">✦</span><div><small>Super Admin</small><b id="usersSuper">—</b></div></div></div>
    <div class="user-data-panel"><div class="user-panel-heading"><div><h3>Daftar Akun</h3><p id="usersResultMeta">Memuat akun…</p></div><span class="user-permission-chip ${isSuper?'is-super':''}">${isSuper?'Super Admin · Kelola role':`${esc(activeRoleLabel)} · Role dibatasi`}</span></div>
      <div class="user-filters"><label class="user-search-field"><span aria-hidden="true">⌕</span><input id="qUsers" type="search" placeholder="Cari nama, email, atau role…" autocomplete="off"></label><label class="user-filter-label"><span>Role</span><select id="filterRoleUsers"><option value="">Semua role</option><option value="warga">Warga</option><option value="admin">Admin Pengurus</option><option value="ketua_rt">Ketua RT</option><option value="super_admin">Super Admin</option><option value="petugas_iuran">Petugas Iuran</option></select></label></div>
      <div id="usersTable" aria-live="polite"><div class="user-loading"><span class="user-spinner"></span><b>Memuat data akun</b><small>Mengambil profil dari Supabase…</small></div></div>
    </div>
    <div class="user-security-note"><span>ⓘ</span><div><b>Catatan keamanan akun</b><p>Role akun yang sedang login: <b>${esc(adminRoleLabel(currentAdminRoleKey()))}</b>. Perubahan role hanya dapat dilakukan oleh Super Admin pada akun lain; role akun sendiri tidak dapat diubah dari sini. Jika label ini bukan Super Admin, login menggunakan akun Super Admin yang benar. Untuk menambah pengguna, pilih nama dari Data Warga; akun login tetap harus dibuat terlebih dahulu di Supabase Authentication dan Auth User ID serta email diambil dari sana. Setelah disimpan, profil akan ditautkan ke data warga yang dipilih. Menghapus autentikasi akun dilakukan melalui Supabase Authentication, bukan dari tabel profil.</p></div></div>
  </div>`,'wide user-management-card');
  document.querySelector('#refreshUsers').onclick=()=>loadAdminUsers(true);
  document.querySelector('#addUserProfile').onclick=()=>openAdminUserCreate();
  document.querySelector('#qUsers').addEventListener('input',drawAdminUsers);
  document.querySelector('#filterRoleUsers').addEventListener('change',drawAdminUsers);
  loadAdminUsers(false);
}
function roleText(role){const key=normalizeRoleKey(role);return ({warga:'Warga',admin:'Admin Pengurus',ketua_rt:'Ketua RT',super_admin:'Super Admin',petugas_iuran:'Petugas Iuran'})[key]||String(role||'Belum ditentukan')}
function roleClass(role){return ({warga:'role-warga',admin:'role-admin',ketua_rt:'role-ketua',super_admin:'role-super',petugas_iuran:'role-petugas'})[normalizeRoleKey(role)]||'role-warga'}
function userDate(value){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
async function loadAdminUsers(showToast){
  const target=document.querySelector('#usersTable');const refresh=document.querySelector('#refreshUsers');
  if(target)target.innerHTML='<div class="user-loading"><span class="user-spinner"></span><b>Memuat data akun</b><small>Mengambil profil dari Supabase…</small></div>';
  if(refresh){refresh.disabled=true;refresh.classList.add('is-loading')}
  try{
    const sb=window.DAWUNG_SUPABASE;if(!sb)throw new Error('Koneksi Supabase belum tersedia.');
    const {data,error}=await sb.from('profiles').select('id,nama,email,role,created_at,updated_at').order('created_at',{ascending:false});
    if(error)throw error;
    ADMIN_USERS_CACHE=(data||[]).map(x=>({...x,role:normalizeRoleKey(x.role||'warga')}));
    drawAdminUsers();if(showToast)toast('Daftar pengguna berhasil diperbarui.');
  }catch(error){
    console.error('[Pengguna & Hak Akses]',error);
    if(target)target.innerHTML=`<div class="user-empty-state user-error-state"><span>!</span><b>Data pengguna belum bisa dimuat</b><p>${esc(error.message||'Periksa koneksi Supabase dan kebijakan akses tabel profiles.')}</p><small>Pastikan SQL <code>supabase/07-admin-user-management.sql</code> sudah dijalankan di Supabase SQL Editor.</small><button class="user-btn user-btn-primary" id="retryUsers" type="button">Coba lagi</button></div>`;
    document.querySelector('#retryUsers')?.addEventListener('click',()=>loadAdminUsers(false));
    if(showToast)toast('Gagal memuat pengguna: '+(error.message||error));
  }finally{if(refresh){refresh.disabled=false;refresh.classList.remove('is-loading')}}
}
function drawAdminUsers(){
  const q=(document.querySelector('#qUsers')?.value||'').trim().toLocaleLowerCase('id-ID');const role=document.querySelector('#filterRoleUsers')?.value||'';
  const rows=ADMIN_USERS_CACHE.filter(x=>(!role||x.role===role)&&(!q||[x.nama,x.email,x.role].join(' ').toLocaleLowerCase('id-ID').includes(q)));
  const count=(r)=>ADMIN_USERS_CACHE.filter(x=>x.role===r).length;
  const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
  set('usersTotal',ADMIN_USERS_CACHE.length);set('usersWarga',count('warga'));set('usersPengurus',count('admin')+count('ketua_rt'));set('usersSuper',count('super_admin'));set('usersResultMeta',`Menampilkan ${rows.length} dari ${ADMIN_USERS_CACHE.length} akun`);
  const target=document.querySelector('#usersTable');if(!target)return;
  const isSuper=isCurrentSuperAdmin();
  const activeRoleLabel=adminRoleLabel(currentAdminRoleKey());
  const html=rows.map(x=>{
    const name=String(x.nama||'Pengguna');const initial=name.trim().charAt(0).toUpperCase()||'P';const self=sameAdminUserId(x.id,ADMIN_SESSION_PROFILE?.id);
    const roleAction=self
      ? `<button type="button" class="user-action-role user-action-role-disabled" disabled title="Role akun yang sedang login tidak dapat diubah dari halaman ini">⚙ <span>Akun sendiri</span></button>`
      : isSuper
        ? `<button type="button" class="user-action-role" data-edit-role="${esc(x.id)}">⚙ <span>Atur Role</span></button>`
        : `<button type="button" class="user-action-role user-action-role-disabled" disabled title="Role login saat ini: ${esc(activeRoleLabel)}. Hanya Super Admin yang dapat mengubah role.">⚙ <span>Super Admin saja</span></button>`;
    const deleteAction=isSuper&&!self?`<button type="button" class="user-action-delete" data-delete-user="${esc(x.id)}">⌫ <span>Hapus</span></button>`:'';
    return `<tr><td><div class="user-person-cell"><span class="user-person-avatar ${roleClass(x.role)}">${esc(initial)}</span><div><b>${esc(name)}${self?'<span class="user-self-tag">Anda</span>':''}</b><small>${esc(x.email||'Email profil belum tersedia')}</small></div></div></td><td><span class="user-role-pill ${roleClass(x.role)}">${esc(roleText(x.role))}</span></td><td><span class="user-created-date">${esc(userDate(x.created_at))}</span></td><td><div class="user-row-actions"><button type="button" class="user-action-edit" data-edit-user="${esc(x.id)}">✎ <span>Edit</span></button>${roleAction}${deleteAction}</div></td></tr>`;
  }).join('');
  target.innerHTML=rows.length?`<div class="user-table-scroll"><table class="user-table"><thead><tr><th>Pengguna</th><th>Role / Hak Akses</th><th>Terdaftar</th><th>Aksi</th></tr></thead><tbody>${html}</tbody></table></div>`:`<div class="user-empty-state"><span>⌕</span><b>${ADMIN_USERS_CACHE.length?'Tidak ada akun yang cocok':'Belum ada profil pengguna'}</b><p>${ADMIN_USERS_CACHE.length?'Ubah kata kunci pencarian atau filter role.':'Akun yang sudah memiliki profil Supabase akan tampil di sini.'}</p></div>`;
  target.querySelectorAll('[data-edit-user]').forEach(btn=>btn.addEventListener('click',()=>openAdminUserEditor(btn.dataset.editUser,false)));
  target.querySelectorAll('[data-edit-role]').forEach(btn=>btn.addEventListener('click',()=>openAdminUserEditor(btn.dataset.editRole,true)));
  target.querySelectorAll('[data-delete-user]').forEach(btn=>btn.addEventListener('click',()=>deleteAdminUserProfile(btn.dataset.deleteUser)));
}
async function openAdminUserCreate(){
  if(!isCurrentSuperAdmin()){toast('Hanya Super Admin yang dapat menambah pengguna dan hak akses.');return;}
  const sb=window.DAWUNG_SUPABASE;
  if(!sb){toast('Koneksi Supabase belum tersedia.');return;}
  let wargaRows=[];
  try{
    const {data,error}=await sb.from('warga')
      .select('id,profile_id,nik,nama,alamat,status')
      .order('nama',{ascending:true});
    if(error)throw error;
    wargaRows=(data||[]).filter(w=>!w.profile_id);
  }catch(error){
    console.error('[Pilihan nama warga untuk pengguna]',error);
    toast('Data Warga belum dapat dimuat: '+(error.message||error));
    return;
  }
  if(!wargaRows.length){
    toast('Tidak ada warga yang belum terhubung ke akun. Periksa menu Data Warga atau gunakan Edit pada akun yang sudah terdaftar.');
    return;
  }
  const options=wargaRows.map(w=>{
    const detail=[w.alamat, w.nik ? `NIK …${String(w.nik).slice(-4)}` : 'NIK belum diisi'].filter(Boolean).join(' · ');
    return `<option value="${esc(w.id)}">${esc(w.nama||'Tanpa nama')}${detail?` — ${esc(detail)}`:''}</option>`;
  }).join('');
  const body=`<form class="user-editor-form" onsubmit="return false">
    <div class="user-editor-intro"><span class="user-person-avatar role-super">＋</span><div><b>Tambah Pengguna &amp; Hak Akses</b><small>Pilih warga dari Data Warga, lalu hubungkan dengan akun Supabase Authentication.</small></div></div>
    <label>Pilih nama warga<select id="newUserWarga" required><option value="">— Pilih warga dari Data Warga —</option>${options}</select><small class="user-field-help">Daftar ini diambil langsung dari tabel <code>warga</code>. Warga yang sudah tertaut ke akun tidak ditampilkan.</small></label>
    <input id="newUserWargaId" type="hidden" value="">
    <label>Nama lengkap<input id="newUserNama" maxlength="150" placeholder="Nama otomatis dari Data Warga" readonly required></label>
    <label>Auth User ID (UUID)<input id="newUserId" maxlength="36" placeholder="UUID dari Supabase Authentication" autocomplete="off" required></label>
    <label>Email akun<input id="newUserEmail" type="email" maxlength="180" placeholder="Email akun di Supabase Authentication" autocomplete="off" required></label>
    <label>Peran / hak akses<select id="newUserRole"><option value="warga">Warga</option><option value="admin">Admin Pengurus</option><option value="ketua_rt">Ketua RT</option><option value="super_admin">Super Admin</option><option value="petugas_iuran">Petugas Iuran</option></select></label>
    <p class="user-form-note">Akun login tetap harus dibuat terlebih dahulu di Supabase → Authentication → Users. Untuk keamanan, form ini tidak membuat password atau akun Auth. Saat disimpan, profil dan warga yang dipilih akan ditautkan.</p>
  </form>`;
  modal('Tambah Pengguna',body,async()=>{
    const wargaId=document.querySelector('#newUserWarga')?.value||'';
    const id=document.querySelector('#newUserId')?.value.trim()||'';
    const email=document.querySelector('#newUserEmail')?.value.trim()||'';
    const role=document.querySelector('#newUserRole')?.value||'warga';
    const selectedWarga=wargaRows.find(w=>String(w.id)===String(wargaId));
    const nama=String(selectedWarga?.nama||'').trim();
    if(!wargaId||!selectedWarga){toast('Pilih nama warga dari daftar terlebih dahulu.');document.querySelector('#newUserWarga')?.focus();return;}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){toast('Auth User ID harus berupa UUID yang valid.');document.querySelector('#newUserId')?.focus();return;}
    if(!nama||!email){toast('Nama warga dan email akun wajib tersedia.');return;}
    const button=document.querySelector('#modalSave');if(button){button.disabled=true;button.textContent='Menambahkan…';}
    let insertedProfileId='';
    try{
      // Cek ulang untuk menghindari menautkan warga yang baru saja dipakai di tab lain.
      const {data:currentWarga,error:wargaCheckError}=await sb.from('warga').select('id,profile_id,nama').eq('id',wargaId).maybeSingle();
      if(wargaCheckError)throw wargaCheckError;
      if(!currentWarga){throw new Error('Data warga yang dipilih tidak ditemukan. Muat ulang Data Warga lalu coba lagi.');}
      if(currentWarga.profile_id){throw new Error('Warga ini sudah terhubung dengan akun. Gunakan menu Edit untuk mengubah role akun yang ada.');}
      const {data,error}=await sb.from('profiles').insert({id,nama:currentWarga.nama,email,role}).select('id,nama,email,role,created_at,updated_at').single();
      if(error)throw error;
      insertedProfileId=data.id;
      const {data:linkedRows,error:linkError}=await sb.from('warga').update({profile_id:id}).eq('id',wargaId).is('profile_id',null).select('id');
      if(linkError)throw new Error('Profil berhasil dibuat, tetapi data warga gagal ditautkan: '+(linkError.message||linkError));
      if(!linkedRows||!linkedRows.length)throw new Error('Profil berhasil dibuat, tetapi warga sudah berubah atau gagal ditautkan.');
      ADMIN_USERS_CACHE.unshift({...data,role:normalizeRoleKey(data.role||'warga')});
      closeModal();drawAdminUsers();toast('Pengguna berhasil ditambahkan dan ditautkan ke Data Warga.');
    }catch(error){
      console.error('[Tambah profil pengguna]',error);
      // Jika pembuatan profil sukses namun tautan warga gagal, batalkan profil baru bila memungkinkan.
      if(insertedProfileId){
        try{await sb.from('profiles').delete().eq('id',insertedProfileId);}catch(rollbackError){console.warn('[Rollback profil pengguna]',rollbackError);}
      }
      const message=error?.message||String(error);
      toast(/duplicate|already exists|unique/i.test(message)?'Auth User ID atau profil tersebut sudah digunakan. Periksa Supabase Authentication dan daftar pengguna.':'Gagal menambah profil: '+message);
    }finally{if(button?.isConnected){button.disabled=false;button.textContent='Simpan';}}
  });
  const wargaSelect=document.querySelector('#newUserWarga');
  wargaSelect?.addEventListener('change',()=>{
    const chosen=wargaRows.find(w=>String(w.id)===String(wargaSelect.value));
    const nameInput=document.querySelector('#newUserNama');
    const idInput=document.querySelector('#newUserWargaId');
    if(nameInput)nameInput.value=chosen?.nama||'';
    if(idInput)idInput.value=chosen?.id||'';
  });
}
async function deleteAdminUserProfile(id){
  if(!isCurrentSuperAdmin()){toast('Hanya Super Admin yang dapat menghapus akses pengguna.');return;}
  const user=ADMIN_USERS_CACHE.find(x=>String(x.id)===String(id));if(!user)return;
  if(sameAdminUserId(user.id,ADMIN_SESSION_PROFILE?.id)){toast('Akun yang sedang digunakan tidak dapat dihapus.');return;}
  const ok=await window.DawungConfirm({title:'Hapus akses pengguna?',entity:user.nama||user.email||'Pengguna',message:'Tindakan ini menghapus profil dan hak akses pada portal. Akun autentikasi Supabase tidak ikut terhapus dan perlu dihapus terpisah oleh administrator.',confirmText:'Ya, hapus akses'});if(!ok)return;
  try{const {error}=await window.DAWUNG_SUPABASE.from('profiles').delete().eq('id',user.id);if(error)throw error;ADMIN_USERS_CACHE=ADMIN_USERS_CACHE.filter(x=>String(x.id)!==String(user.id));drawAdminUsers();toast('Profil dan hak akses portal berhasil dihapus. Akun Auth masih ada di Supabase Authentication.');}
  catch(error){console.error('[Hapus profil pengguna]',error);toast('Gagal menghapus akses: '+(error.message||error));}
}

function openAdminUserEditor(id,focusRole){
  const user=ADMIN_USERS_CACHE.find(x=>String(x.id)===String(id));if(!user)return;
  const isSuper=isCurrentSuperAdmin();const self=sameAdminUserId(user.id,ADMIN_SESSION_PROFILE?.id);const canChangeRole=isSuper&&!self;
  const body=`<form class="user-editor-form" onsubmit="return false"><div class="user-editor-intro"><span class="user-person-avatar ${roleClass(user.role)}">${esc(String(user.nama||'P').trim().charAt(0).toUpperCase())}</span><div><b>Edit Profil Pengguna</b><small>${esc(user.email||'Email profil belum tersedia')}</small></div></div><label>Nama lengkap<input id="userEditNama" maxlength="150" value="${esc(user.nama||'')}" placeholder="Nama lengkap" required></label><label>Email akun<small class="user-field-help">Email autentikasi dikelola oleh Supabase Authentication.</small><input value="${esc(user.email||'') }" disabled></label>${canChangeRole?`<label>Peran / hak akses<select id="userEditRole"><option value="warga" ${user.role==='warga'?'selected':''}>Warga</option><option value="admin" ${user.role==='admin'?'selected':''}>Admin Pengurus</option><option value="ketua_rt" ${user.role==='ketua_rt'?'selected':''}>Ketua RT</option><option value="super_admin" ${user.role==='super_admin'?'selected':''}>Super Admin</option><option value="petugas_iuran" ${user.role==='petugas_iuran'?'selected':''}>Petugas Iuran</option></select><small class="user-field-help">Perubahan role memengaruhi akses ke halaman administrasi.</small></label>`:`<div class="user-role-readonly"><span>Role saat ini</span><b>${esc(roleText(user.role))}</b><small>${self?'Role akun sendiri tidak dapat diubah dari sini.':'Hanya Super Admin yang dapat mengubah role pengguna.'}</small></div>`}<p class="user-form-note">Akun autentikasi tidak dihapus atau dibuat dari form ini. Form ini hanya mengubah profil dan, jika berwenang, role.</p></form>`;
  modal(canChangeRole?'Edit Profil & Role':'Edit Profil Pengguna',body,async()=>{
    const name=document.querySelector('#userEditNama')?.value.trim()||'';if(!name){toast('Nama lengkap wajib diisi.');document.querySelector('#userEditNama')?.focus();return;}
    const payload={nama:name};if(canChangeRole)payload.role=document.querySelector('#userEditRole')?.value||user.role;
    const button=document.querySelector('#modalSave');if(button){button.disabled=true;button.textContent='Menyimpan…'}
    try{
      const {data,error}=await window.DAWUNG_SUPABASE.from('profiles').update(payload).eq('id',user.id).select('id,nama,email,role,created_at,updated_at').single();if(error)throw error;
      const index=ADMIN_USERS_CACHE.findIndex(x=>String(x.id)===String(user.id));if(index>=0)ADMIN_USERS_CACHE[index]={...ADMIN_USERS_CACHE[index],...data};
      if(self){ADMIN_SESSION_PROFILE={...ADMIN_SESSION_PROFILE,nama:data.nama,role:data.role};window.__DAWUNG_ADMIN_PROFILE=ADMIN_SESSION_PROFILE;localStorage.setItem('dawung_user',JSON.stringify({...JSON.parse(localStorage.getItem('dawung_user')||'{}'),nama:data.nama,role:data.role}));}
      closeModal();drawAdminUsers();toast('Profil pengguna berhasil diperbarui.');
    }catch(error){console.error('[Simpan profil]',error);toast(/super admin|role|permission|row-level|policy/i.test(error.message||'')?'Perubahan ditolak oleh aturan keamanan. Pastikan role dan kebijakan Supabase sesuai.':'Gagal menyimpan profil: '+(error.message||error));}
    finally{if(button?.isConnected){button.disabled=false;button.textContent='Simpan'}}
  });
  if(focusRole)setTimeout(()=>document.querySelector('#userEditRole')?.focus(),50);
}

function pengaturan(){
  head('Pengaturan');
  const st=A.d.settings||{};
  const year=new Date().getFullYear();
  const defaults={
    footer_title:st.footer_title||'Portal Digital Dusun Dawung',
    footer_description:st.footer_description||'Layanan warga, informasi kegiatan, dan transparansi lingkungan dalam satu portal digital.',
    footer_address:st.footer_address||`Dusun Dawung RT.${st.rt||'04'} RW.${st.rw||'01'}`,
    footer_contact:st.footer_contact||'Untuk bantuan layanan, silakan hubungi Ketua RT atau pengurus setempat.',
    footer_phone:st.footer_phone||'',
    footer_email:st.footer_email||'',
    footer_copyright:st.footer_copyright||`© ${year} Portal Warga Dusun Dawung. Hak cipta dilindungi.`
  };
  A.app.innerHTML=card(`<div class="card-head"><div><b>Identitas Portal</b><small>Perbarui identitas Dusun Dawung dan informasi footer publik</small></div></div>
    <form id="settingsForm" class="footer-settings-form">
      <div class="settings-subhead"><b>Identitas Wilayah</b><small>Nama dan slogan yang dipakai di portal.</small></div>
      <label>Nama wilayah<input id="sName" value="${esc(st.name||'Dusun Dawung')}"></label>
      <div class="form-grid"><label>RT<input id="sRt" value="${esc(st.rt||'04')}"></label><label>RW<input id="sRw" value="${esc(st.rw||'01')}"></label></div>
      <label>Slogan<input id="sSlogan" value="${esc(st.slogan||'Sepi Ing Pamrih, Rame Ing Gawe')}"></label>
      <div class="settings-subhead footer-settings-heading"><b>Konten Footer Halaman Utama</b><small>Perubahan akan tampil untuk semua pengunjung setelah disimpan ke Supabase.</small></div>
      <label>Judul Footer<input id="sFooterTitle" maxlength="100" value="${esc(defaults.footer_title)}" placeholder="Portal Digital Dusun Dawung"></label>
      <label>Deskripsi Footer<textarea id="sFooterDescription" rows="3" maxlength="500" placeholder="Deskripsi singkat portal">${esc(defaults.footer_description)}</textarea></label>
      <label>Deskripsi Informasi & Kontak<textarea id="sFooterContact" rows="2" maxlength="500" placeholder="Contoh: Untuk bantuan layanan, hubungi pengurus RT.">${esc(defaults.footer_contact)}</textarea></label>
      <label>Nomor HP / WhatsApp<input id="sFooterPhone" type="tel" maxlength="40" value="${esc(defaults.footer_phone)}" placeholder="Contoh: 081234567890"></label>
      <label>Email<input id="sFooterEmail" type="email" maxlength="160" value="${esc(defaults.footer_email)}" placeholder="Contoh: rt.dawung@email.com"></label>
      <label>Alamat Kontak<input id="sFooterAddress" maxlength="200" value="${esc(defaults.footer_address)}" placeholder="Masukkan alamat yang ingin ditampilkan"></label>
      <p class="settings-sync-hint" id="settingsSyncHint">Tambahkan kolom kontak dengan menjalankan file <code>supabase/04-footer-contact-fields.sql</code> satu kali di SQL Editor Supabase.</p>
      <button type="submit" class="btn green">Simpan Pengaturan</button>
    </form>`,'wide');

  const form=document.querySelector('#settingsForm');
  const setVal=(id,value)=>{const el=document.getElementById(id);if(el && document.activeElement!==el && value!==null && value!==undefined)el.value=value;};
  const sb=window.DAWUNG_SUPABASE;
  if(sb){
    sb.from('site_settings').select('site_name,rt,rw,slogan,footer_title,footer_description,footer_address,footer_contact,footer_phone,footer_email').eq('id',1).maybeSingle().then(({data,error})=>{
      if(error){console.warn('[Site settings] Belum bisa memuat pengaturan footer:',error.message);return;}
      if(!data)return;
      setVal('sName',data.site_name);setVal('sRt',data.rt);setVal('sRw',data.rw);setVal('sSlogan',data.slogan);
      setVal('sFooterTitle',data.footer_title);setVal('sFooterDescription',data.footer_description);setVal('sFooterAddress',data.footer_address);setVal('sFooterContact',data.footer_contact);setVal('sFooterPhone',data.footer_phone);setVal('sFooterEmail',data.footer_email);
      const hint=document.querySelector('#settingsSyncHint');if(hint)hint.textContent='Pengaturan footer tersambung ke Supabase dan dapat ditampilkan untuk semua pengunjung.';
    }).catch(err=>console.warn('[Site settings]',err));
  }
  form.onsubmit=async e=>{
    e.preventDefault();
    const next={
      name:document.querySelector('#sName').value.trim(),rt:document.querySelector('#sRt').value.trim(),rw:document.querySelector('#sRw').value.trim(),slogan:document.querySelector('#sSlogan').value.trim(),
      footer_title:document.querySelector('#sFooterTitle').value.trim(),footer_description:document.querySelector('#sFooterDescription').value.trim(),footer_address:document.querySelector('#sFooterAddress').value.trim(),footer_contact:document.querySelector('#sFooterContact').value.trim(),footer_phone:document.querySelector('#sFooterPhone').value.trim(),footer_email:document.querySelector('#sFooterEmail').value.trim()
    };
    if(!next.name||!next.footer_title){toast('Nama wilayah dan judul footer wajib diisi.');return;}
    if(!sb){toast('Supabase belum tersedia. Pengaturan footer belum disimpan untuk pengunjung.');return;}
    const payload={id:1,site_name:next.name,rt:next.rt,rw:next.rw,slogan:next.slogan,footer_title:next.footer_title,footer_description:next.footer_description,footer_address:next.footer_address,footer_contact:next.footer_contact,footer_phone:next.footer_phone,footer_email:next.footer_email,updated_at:new Date().toISOString()};
    const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Menyimpan…';}
    let saveResult;
    try{saveResult=await sb.from('site_settings').upsert(payload,{onConflict:'id'});}
    catch(err){saveResult={error:err};}
    if(submit){submit.disabled=false;submit.textContent='Simpan Pengaturan';}
    const error=saveResult?.error;
    if(error){console.error('[Site settings] Gagal menyimpan:',error);toast(/site_settings|schema cache|does not exist/i.test(error.message||'')?'Struktur pengaturan footer belum lengkap. Jalankan supabase/04-footer-contact-fields.sql terlebih dahulu.':'Gagal menyimpan footer: '+(error.message||'periksa koneksi Supabase'));return;}
    A.d.settings={...A.d.settings,...next};save(A.d);
    const hint=document.querySelector('#settingsSyncHint');if(hint)hint.textContent='Pengaturan berhasil disimpan. Footer publik akan memakai teks terbaru dari Supabase.';
    toast('Identitas dan footer berhasil disimpan.');
  };
}

window.addEventListener('error',e=>console.error(e.error||e.message));
(async()=>{
  const ctx=await ensureAdminSession();
  if(!ctx) return;
  try{
    await refreshPengumuman();
    if(window.initSupabaseWarga) await window.initSupabaseWarga();
    else render(ADMIN_REQUESTED_PAGE);
  }catch(e){
    console.error(e);
    render(ADMIN_REQUESTED_PAGE);
    toast('Data Supabase belum termuat: '+(e.message||e));
  }
})();
