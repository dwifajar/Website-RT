(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  const ALLOWED=['admin','ketua_rt','super_admin'];
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const statusLabel={menunggu:'Menunggu',diproses:'Diproses',selesai:'Selesai',ditolak:'Ditolak'};
  const jenisLabel={surat_pengantar:'Surat Pengantar',domisili:'Surat Keterangan Domisili',sktm:'Surat Keterangan Tidak Mampu (SKTM)',usaha:'Surat Keterangan Usaha',lainnya:'Surat Keterangan Lainnya',laporan:'Lapor Lingkungan',aspirasi:'Aspirasi Warga'};
  let rows=[];

  function notice(msg,err=false){
    const box=$('#notice'); if(!box)return;
    box.textContent=msg;
    box.className=err?'error-box':'notice-box';
    box.style.display='block';
  }
  function hideNotice(){const box=$('#notice');if(box)box.style.display='none'}
  function fmtDate(v){
    if(!v)return '-';
    const d=new Date(v);
    return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  }
  function statusBadge(v){
    const cls=v==='selesai'?'greenp':v==='ditolak'?'redp':v==='diproses'?'blue':'yellow';
    return `<label class="p ${cls}">${esc(statusLabel[v]||v||'-')}</label>`;
  }
  function labelJenis(v){return jenisLabel[v]||v||'-'}

  async function guard(){
    if(!sb){throw new Error('Supabase belum termuat.');}
    const {data:{user},error:ae}=await sb.auth.getUser();
    if(ae)throw ae;
    if(!user){location.href='../login.html';return null;}
    const {data:profile,error:pe}=await sb.from('profiles').select('role,nama').eq('id',user.id).maybeSingle();
    if(pe)throw pe;
    if(!profile || !ALLOWED.includes(profile.role)){
      throw new Error('Akun ini belum memiliki role admin, ketua_rt, atau super_admin.');
    }
    const name=profile.nama||'Admin Pengurus';
    const initial=name.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'AF';
    document.querySelectorAll('.admin-user>span,.admin-tools>span').forEach(x=>x.textContent=initial);
    return user;
  }

  async function load(){
    hideNotice();
    const table=$('#suratTable');
    table.className='loading';
    table.innerHTML='Memuat data pengajuan...';
    await guard();
    const {data,error}=await sb.from('surat_pengajuan')
      .select('id,warga_id,pemohon_nama,jenis,status,catatan,nomor_surat,dokumen_url,created_at,updated_at,warga(nama,nik,no_kk,alamat)')
      .order('created_at',{ascending:false});
    if(error)throw error;
    rows=data||[];
    const pending=rows.filter(x=>x.status!=='selesai').length;
    const badgeSurat=document.querySelector('#badgeSurat');
    if(badgeSurat) badgeSurat.textContent=String(pending);
    const localDb=(()=>{try{return JSON.parse(localStorage.getItem('dawung_db_v2')||'{}')}catch(_){return {}}})();
    const badgeAspirasi=document.querySelector('#badgeAspirasi');
    if(badgeAspirasi) badgeAspirasi.textContent=String((localDb.aspirasi||[]).filter(x=>x.status==='Baru').length);
    draw();
    notice(`${rows.length} pengajuan dimuat dari Supabase.`);
  }

  function filtered(){
    const q=($('#qSurat')?.value||'').trim().toLowerCase();
    if(!q)return rows;
    return rows.filter(x=>{
      const w=x.warga||{};
      return [x.pemohon_nama,w.nama,w.nik,x.jenis,x.nomor_surat,x.status,x.catatan].join(' ').toLowerCase().includes(q);
    });
  }

  function draw(){
    const list=filtered();
    const html=list.map(x=>{
      const w=x.warga||{};
      return `<tr>
        <td><b>${esc(w.nama||x.pemohon_nama||'-')}</b><small>${esc(w.nik||'')}</small></td>
        <td>${esc(labelJenis(x.jenis))}</td>
        <td>${fmtDate(x.created_at)}</td>
        <td>${esc(x.nomor_surat||'-')}</td>
        <td><select class="status-select" data-status="${esc(x.id)}">
          ${['menunggu','diproses','selesai','ditolak'].map(s=>`<option value="${s}" ${x.status===s?'selected':''}>${esc(statusLabel[s])}</option>`).join('')}
        </select></td>
        <td>${esc(x.catatan||'-')}</td>
        <td><button type="button" data-print="${esc(x.id)}">Cetak</button></td>
      </tr>`;
    }).join('');
    $('#suratTable').className='table-scroll';
    $('#suratTable').innerHTML=`<table class="wide-table"><thead><tr><th>Pemohon</th><th>Jenis</th><th>Tanggal</th><th>Nomor Surat</th><th>Status</th><th>Catatan</th><th>Aksi</th></tr></thead><tbody>${html||'<tr><td colspan="7"><small>Tidak ada pengajuan.</small></td></tr>'}</tbody></table>`;
    document.querySelectorAll('[data-status]').forEach(el=>el.addEventListener('change',()=>updateStatus(el.dataset.status,el.value)));
    document.querySelectorAll('[data-print]').forEach(el=>el.addEventListener('click',()=>printSurat(el.dataset.print)));
  }

  async function updateStatus(id,status){
    try{
      const {error}=await sb.from('surat_pengajuan').update({status,updated_at:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
      const row=rows.find(x=>x.id===id); if(row)row.status=status;
      notice('Status pengajuan diperbarui.');
    }catch(e){notice('Gagal memperbarui status: '+(e.message||e),true);await load().catch(()=>{});}
  }

  function printSurat(id){
    const x=rows.find(r=>r.id===id); if(!x)return;
    const wdata=x.warga||{};
    const w=window.open('','_blank');
    if(!w){notice('Popup diblokir browser. Izinkan popup untuk mencetak surat.',true);return;}
    w.document.write(`<html><head><title>${esc(x.nomor_surat||'Surat RT Dawung')}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.6;color:#222}.center{text-align:center}hr{border:0;border-top:2px solid #222}</style></head><body>
      <div class="center"><b>PEMERINTAH DUSUN DAWUNG</b><br>RT 04 / RW 01</div><hr>
      <div class="center"><b>SURAT ${esc(labelJenis(x.jenis)).toUpperCase()}</b><br>${esc(x.nomor_surat||'')}</div>
      <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
      <p><b>${esc(wdata.nama||x.pemohon_nama||'-')}</b><br>NIK: ${esc(wdata.nik||'-')}<br>No. KK: ${esc(wdata.no_kk||'-')}<br>Alamat: ${esc(wdata.alamat||'-')}</p>
      <p>Status pengajuan: <b>${esc(statusLabel[x.status]||x.status||'-')}</b></p>
      <p>Catatan: ${esc(x.catatan||'-')}</p>
      <br><p>Dusun Dawung, ${fmtDate(x.created_at)}</p><p>Ketua RT 04 / RW 01</p>
    </body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),150);
  }

  $('#todayLabel').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  $('#adminHamb').onclick=()=>$('.admin-side').classList.toggle('open');
  $('#refreshBtn').onclick=()=>load().catch(e=>notice('Gagal memuat: '+(e.message||e),true));
  $('#searchBtn').onclick=draw;
  $('#qSurat').onkeydown=e=>{if(e.key==='Enter')draw()};
  $('#logout').onclick=async()=>{
    try{await sb?.auth.signOut()}catch(_){}
    localStorage.removeItem('dawung_auth');localStorage.removeItem('dawung_user');
    location.href='../login.html';
  };
  load().catch(e=>{console.error('[Pengajuan Surat]',e);notice('Gagal memuat pengajuan: '+(e.message||e),true);});
})();