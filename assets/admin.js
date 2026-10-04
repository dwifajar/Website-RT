const DBKEY = 'dawung_db_v2';
const seed = {
  settings:{name:'Dusun Dawung',rt:'04',rw:'01',slogan:'Sepi Ing Pamrih, Rame Ing Gawe'},
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
function toast(msg){const t=document.querySelector('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function card(content,cls=''){return `<section class="admin-card ${cls}">${content}</section>`}
function table(rows,heads){return `<div class="table-scroll"><table class="wide-table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}"><small>Belum ada data.</small></td></tr>`}</tbody></table></div>`}
function head(t){A.title.textContent=t}
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

  if(profileError || !profile || !ADMIN_ROLES.includes(profile.role)){
    localStorage.removeItem('dawung_auth');
    localStorage.removeItem('dawung_user');
    location.href='../login.html';
    return null;
  }

  localStorage.setItem('dawung_auth',profile.role);
  localStorage.setItem('dawung_user',JSON.stringify({
    id:user.id,
    nama:profile.nama || 'Admin Pengurus',
    email:user.email || '',
    role:profile.role
  }));

  return {user,profile};
}

document.querySelector('#todayLabel').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
document.querySelector('#logout').onclick=async()=>{try{await window.DAWUNG_SUPABASE?.auth.signOut()}catch(e){}localStorage.removeItem('dawung_auth');localStorage.removeItem('dawung_user');location.href='../login.html'};
document.querySelector('#adminHamb').onclick=()=>document.querySelector('.admin-side').classList.toggle('open');

const adminNav=document.querySelector('#adminNav');
async function openAdminPage(page,clickedLink){
  const target=String(page||'dashboard');
  if(target==='surat'){ location.href='pengajuan.html'; return; }
  document.querySelectorAll('#adminNav a[data-page]').forEach(x=>x.classList.toggle('active',x===clickedLink || x.dataset.page===target));
  try{
    await render(target);
  }catch(err){
    console.error('[Admin menu]',target,err);
    if(A && A.app) A.app.innerHTML=card(`<div class="card-head"><div><b>Menu gagal dibuka</b><small>${esc(err.message||err)}</small></div></div>`,'wide');
    toast('Menu gagal dibuka: '+(err.message||err));
  }
  document.querySelector('.admin-side').classList.remove('open');
}
if(adminNav){
  adminNav.addEventListener('click',async e=>{
    const a=e.target.closest('a[data-page]');
    if(!a || !adminNav.contains(a)) return;
    e.preventDefault();
    e.stopPropagation();
    await openAdminPage(a.dataset.page,a);
  });
}
window.openAdminPage=openAdminPage;

function badge(){document.querySelector('#badgeSurat').textContent=A.d.surat.filter(x=>x.status!=='Selesai').length;document.querySelector('#badgeAspirasi').textContent=A.d.aspirasi.filter(x=>x.status==='Baru').length}
const initialPage = new URLSearchParams(window.location.search).get('page') || 'dashboard';
function render(page='dashboard'){
  // Saat membuka /admin/?page=agenda dari halaman Pengajuan, rt-data.js
  // sebelumnya memanggil render('dashboard') setelah memuat data.
  // Hormati halaman yang diminta dari URL agar tidak kembali ke Dashboard.
  if(page==='dashboard' && initialPage!=='dashboard' && !window.__adminInitialPageRendered){
    page=initialPage;
    window.__adminInitialPageRendered=true;
  }
  badge();
  if(page==='dashboard')return dashboard();
  if(page==='warga')return window.renderWarga?window.renderWarga():wargaLocalFallback();
  if(page==='kk')return window.renderKK?window.renderKK():kkLocalFallback();
  if(page==='surat'){
    location.href='pengajuan.html';
    return;
  }
  if(page==='agenda')return agenda();
  if(page==='pengumuman')return pengumuman();
  if(page==='keuangan')return keuangan();
  if(page==='aspirasi')return aspirasi();
  if(page==='pengguna')return pengguna();
  if(page==='pengaturan')return pengaturan();
}
function dashboard(){
  head('Selamat datang, Admin! 👋');
  const inc=A.d.keuangan.filter(x=>x.jenis==='Pemasukan').reduce((a,b)=>a+Number(b.nominal),0),out=A.d.keuangan.filter(x=>x.jenis==='Pengeluaran').reduce((a,b)=>a+Number(b.nominal),0);
  const wargaCount=A.d.warga.length||0,kkCount=(A.d.kk||[]).length||0;
  A.app.innerHTML=`<div class="admin-kpis"><div><span>👥</span><small>Warga Aktif</small><b>${wargaCount}</b></div><div><span>▣</span><small>Kepala Keluarga</small><b>${kkCount}</b></div><div><span>▤</span><small>Pengajuan Surat</small><b>${A.d.surat.filter(x=>x.status!=='Selesai').length}</b></div><div><span>◉</span><small>Kas RT</small><b>${money(inc-out)}</b></div></div><div class="admin-grid">${card(`<div class="card-head"><div><b>Grafik Kas RT</b><small>Ringkasan arus kas</small></div></div><div class="bars">${[45,72,55,82,64,92,70,78].map(h=>`<i style="height:${h}%"></i>`).join('')}</div><div class="legend">▰ Pemasukan　 <span>▰ Pengeluaran</span></div>`)}${card(`<div class="card-head"><div><b>Pengajuan Terbaru</b><small>${A.d.surat.length} total pengajuan</small></div><a href="#" data-go="surat">Lihat Semua</a></div>${table(A.d.surat.slice(0,4).map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.jenis)}</small></td><td><label class="p ${x.status==='Selesai'?'greenp':'yellow'}">${esc(x.status)}</label></td></tr>`).join(''),['Warga','Status'])}`)}${card(`<div class="card-head"><b>Aktivitas Warga</b></div><ul class="activity">${A.d.aspirasi.slice(0,4).map(x=>`<li>🟢 <b>${esc(x.judul)}</b><small>${esc(x.tanggal)} · ${esc(x.status)}</small></li>`).join('')}</ul>`)}${card(`<div class="card-head"><b>Agenda Terdekat</b><a href="#" data-go="agenda">Kelola</a></div><ul class="activity">${A.d.agenda.slice(0,3).map(x=>`<li>🟢 <b>${esc(x.judul)}</b><small>${esc(x.tanggal)} · ${esc(x.jam)}</small></li>`).join('')}</ul>`)}</div>`;
  A.app.querySelectorAll('[data-go]').forEach(x=>x.onclick=e=>{e.preventDefault();const target=x.dataset.go;openAdminPage(target,document.querySelector(`#adminNav a[data-page=\"${target}\"]`))})
}

function wargaLocalFallback(){head('Data Warga');A.app.innerHTML=card('<b>Data warga belum tersambung.</b><small>Jalankan migration Supabase dan refresh halaman.</small>','wide')}
function kkLocalFallback(){head('Kartu Keluarga');A.app.innerHTML=card('<b>Data KK belum tersambung.</b><small>Jalankan migration Supabase dan refresh halaman.</small>','wide')}

function surat(){head('Pengajuan Surat');A.app.innerHTML=card(`<div class="card-head"><div><b>Pengajuan Surat</b><small>Kelola permohonan warga</small></div><button class="green-mini" id="addSurat">＋ Pengajuan Manual</button></div>${table(A.d.surat.map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.tanggal)}</small></td><td>${esc(x.jenis)}</td><td><select onchange="statusSurat('${x.id}',this.value)"><option ${x.status==='Menunggu'?'selected':''}>Menunggu</option><option ${x.status==='Diproses'?'selected':''}>Diproses</option><option ${x.status==='Selesai'?'selected':''}>Selesai</option><option ${x.status==='Ditolak'?'selected':''}>Ditolak</option></select></td><td><button onclick="printSurat('${x.id}')">Cetak</button></td></tr>`).join(''),['Warga','Jenis','Status','Aksi'])}`,'wide');document.querySelector('#addSurat').onclick=()=>modal('Pengajuan Surat',`<label>Nama<input id="mNama"></label><label>Jenis<select id="mJenis"><option>Surat Pengantar</option><option>Surat Domisili</option><option>SKTM</option><option>Surat Usaha</option></select></label>`,()=>{const nama=document.querySelector('#mNama').value.trim();if(!nama)return toast('Nama wajib diisi');A.d.surat.push({id:Date.now(),nama,jenis:document.querySelector('#mJenis').value,tanggal:'Hari ini',status:'Menunggu'});save(A.d);closeModal();surat();toast('Pengajuan dibuat')})}
window.statusSurat=(id,s)=>{const x=A.d.surat.find(x=>String(x.id)===String(id));if(x){x.status=s;save(A.d);badge();toast('Status diperbarui')}};
window.printSurat=id=>{const x=A.d.surat.find(x=>String(x.id)===String(id));if(!x)return;const w=window.open('','_blank');w.document.write(`<html><body style="font-family:Arial;padding:50px"><h2>RT 04 / RW 01 DUSUN DAWUNG</h2><hr><h3>SURAT ${esc(x.jenis).toUpperCase()}</h3><p>Permohonan atas nama <b>${esc(x.nama)}</b>.</p><p>Status: <b>${esc(x.status)}</b></p><p>Dusun Dawung, ${esc(x.tanggal)}</p><br><p>Ketua RT 04 / RW 01</p></body></html>`);w.document.close();w.print()};

function agenda(){head('Agenda Kegiatan');A.app.innerHTML=card(`<div class="card-head"><div><b>Agenda Kegiatan</b><small>Kelola kegiatan lingkungan</small></div><button class="green-mini" id="addAg">＋ Tambah Agenda</button></div>${table(A.d.agenda.map(x=>`<tr><td><b>${esc(x.tanggal)}</b><small>${esc(x.jam)}</small></td><td>${esc(x.judul)}</td><td>${esc(x.lokasi)}</td><td><button onclick="delAg('${x.id}')">Hapus</button></td></tr>`).join(''),['Tanggal','Kegiatan','Lokasi','Aksi'])}`,'wide');document.querySelector('#addAg').onclick=()=>modal('Tambah Agenda',`<label>Tanggal<input id="mTanggal" placeholder="20 Okt 2026"></label><label>Jam<input id="mJam" placeholder="07.00 WIB"></label><label>Kegiatan<input id="mJudul"></label><label>Lokasi<input id="mLokasi"></label>`,()=>{A.d.agenda.push({id:Date.now(),tanggal:document.querySelector('#mTanggal').value,jam:document.querySelector('#mJam').value,judul:document.querySelector('#mJudul').value,lokasi:document.querySelector('#mLokasi').value});save(A.d);closeModal();agenda();toast('Agenda ditambahkan')})}
window.delAg=id=>{A.d.agenda=A.d.agenda.filter(x=>String(x.id)!==String(id));save(A.d);agenda();toast('Agenda dihapus')};

function pengumuman(){head('Pengumuman');A.app.innerHTML=card(`<div class="card-head"><div><b>Pengumuman</b><small>Informasi untuk warga</small></div><button class="green-mini" id="addP">＋ Buat Pengumuman</button></div>${table(A.d.pengumuman.map(x=>`<tr><td><b>${esc(x.judul)}</b><small>${esc(x.tanggal)}</small></td><td>${esc(x.isi)}</td><td><button onclick="delP('${x.id}')">Hapus</button></td></tr>`).join(''),['Judul','Isi','Aksi'])}`,'wide');document.querySelector('#addP').onclick=()=>modal('Buat Pengumuman',`<label>Judul<input id="mJudul"></label><label>Isi<textarea id="mIsi"></textarea></label>`,()=>{A.d.pengumuman.unshift({id:Date.now(),judul:document.querySelector('#mJudul').value,isi:document.querySelector('#mIsi').value,tanggal:'Hari ini'});save(A.d);closeModal();pengumuman();toast('Pengumuman diterbitkan')})}
window.delP=id=>{A.d.pengumuman=A.d.pengumuman.filter(x=>String(x.id)!==String(id));save(A.d);pengumuman();toast('Pengumuman dihapus')};

function keuangan(){head('Kas & Keuangan');const inc=A.d.keuangan.filter(x=>x.jenis==='Pemasukan').reduce((a,b)=>a+Number(b.nominal),0),out=A.d.keuangan.filter(x=>x.jenis==='Pengeluaran').reduce((a,b)=>a+Number(b.nominal),0);A.app.innerHTML=`<div class="admin-kpis"><div><span>＋</span><small>Pemasukan</small><b>${money(inc)}</b></div><div><span>−</span><small>Pengeluaran</small><b>${money(out)}</b></div><div><span>◉</span><small>Saldo</small><b>${money(inc-out)}</b></div></div>`+card(`<div class="card-head"><div><b>Transaksi Kas</b><small>Catatan transparansi RT</small></div><button class="green-mini" id="addK">＋ Transaksi</button></div>${table(A.d.keuangan.map(x=>`<tr><td>${esc(x.tanggal)}</td><td><label class="p ${x.jenis==='Pemasukan'?'greenp':'redp'}">${esc(x.jenis)}</label></td><td>${esc(x.kategori)}</td><td><b>${money(x.nominal)}</b></td><td>${esc(x.keterangan)}</td><td><button onclick="delK('${x.id}')">Hapus</button></td></tr>`).join(''),['Tanggal','Jenis','Kategori','Nominal','Keterangan','Aksi'])}`,'wide');document.querySelector('#addK').onclick=()=>modal('Tambah Transaksi',`<label>Jenis<select id="mJenis"><option>Pemasukan</option><option>Pengeluaran</option></select></label><label>Kategori<input id="mKat"></label><label>Nominal<input id="mNom" type="number" min="0"></label><label>Keterangan<input id="mKet"></label>`,()=>{A.d.keuangan.push({id:Date.now(),tanggal:'Hari ini',jenis:document.querySelector('#mJenis').value,kategori:document.querySelector('#mKat').value,nominal:Number(document.querySelector('#mNom').value),keterangan:document.querySelector('#mKet').value});save(A.d);closeModal();keuangan();toast('Transaksi tersimpan')})}
window.delK=id=>{A.d.keuangan=A.d.keuangan.filter(x=>String(x.id)!==String(id));save(A.d);keuangan();toast('Transaksi dihapus')};

function aspirasi(){head('Aspirasi & Laporan');A.app.innerHTML=card(`<div class="card-head"><div><b>Aspirasi & Laporan Lingkungan</b><small>Tindak lanjut masukan warga</small></div></div>${table(A.d.aspirasi.map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.tanggal)}</small></td><td>${esc(x.judul)}</td><td>${esc(x.isi)}</td><td><select onchange="statusAsp('${x.id}',this.value)"><option ${x.status==='Baru'?'selected':''}>Baru</option><option ${x.status==='Diproses'?'selected':''}>Diproses</option><option ${x.status==='Selesai'?'selected':''}>Selesai</option></select></td></tr>`).join(''),['Warga','Judul','Isi','Status'])}`,'wide')}
window.statusAsp=(id,s)=>{const x=A.d.aspirasi.find(x=>String(x.id)===String(id));if(x){x.status=s;save(A.d);badge();toast('Status aspirasi diperbarui')}};

function pengguna(){head('Pengguna & Hak Akses');const u=JSON.parse(localStorage.getItem('dawung_user')||'{}');A.app.innerHTML=card(`<div class="card-head"><div><b>Pengguna Sistem</b><small>Akun yang sedang masuk</small></div></div>${table(`<tr><td><b>${esc(u.nama||'Admin RT Dawung')}</b><small>${esc(u.email||'-')}</small></td><td>${esc(u.role||'admin')}</td><td><label class="p greenp">Aktif</label></td></tr>`,['Pengguna','Role','Status'])}`,'wide')}
function pengaturan(){head('Pengaturan');A.app.innerHTML=card(`<div class="card-head"><div><b>Identitas Portal</b><small>Perbarui identitas Dusun Dawung</small></div></div><form id="settingsForm"><label>Nama wilayah<input id="sName" value="${esc(A.d.settings.name)}"></label><div class="form-grid"><label>RT<input id="sRt" value="${esc(A.d.settings.rt)}"></label><label>RW<input id="sRw" value="${esc(A.d.settings.rw)}"></label></div><label>Slogan<input id="sSlogan" value="${esc(A.d.settings.slogan)}"></label><button type="submit" class="btn green">Simpan Pengaturan</button></form>`,'wide');document.querySelector('#settingsForm').onsubmit=e=>{e.preventDefault();A.d.settings={name:document.querySelector('#sName').value,rt:document.querySelector('#sRt').value,rw:document.querySelector('#sRw').value,slogan:document.querySelector('#sSlogan').value};save(A.d);toast('Pengaturan disimpan')}}

window.addEventListener('error',e=>console.error(e.error||e.message));
(async()=>{
  const ctx=await ensureAdminSession();
  if(!ctx) return;
  try{
    if(window.initSupabaseWarga) await window.initSupabaseWarga();
    else render('dashboard');
  }catch(e){
    console.error(e);
    render('dashboard');
    toast('Dashboard siap, data Supabase belum termuat: '+(e.message||e));
  }
})();
