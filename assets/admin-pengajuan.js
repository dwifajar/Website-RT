(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  const ALLOWED=['admin','ketua_rt','super_admin'];
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const statusLabel={menunggu:'Menunggu',diproses:'Diproses',selesai:'Selesai',ditolak:'Ditolak'};
  const jenisLabel={
    surat_pengantar:'Surat Pengantar',
    domisili:'Surat Keterangan Domisili',
    sktm:'Surat Keterangan Tidak Mampu (SKTM)',
    usaha:'Surat Keterangan Usaha',
    lainnya:'Surat Keterangan Lainnya',
    laporan:'Lapor Lingkungan',
    aspirasi:'Aspirasi Warga'
  };
  let rows=[];
  let loading=false;

  function notice(msg,err=false){
    const box=$('#notice');
    if(!box)return;
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
  function formData(x){return x&&x.data_form&&typeof x.data_form==='object'?x.data_form:{}}
  function person(x){
    const f=formData(x),w=x?.warga||{};
    return {
      nama:w.nama||f.pemohon_nama||x?.pemohon_nama||'-',
      nik:w.nik||f.nik||'-',
      alamat:w.alamat||f.alamat||'-',
      nohp:f.no_hp||f.nohp||'-',
      tempat_lahir:f.tempat_lahir||'-',
      tanggal_lahir:f.tanggal_lahir||'-',
      jenis_kelamin:f.jenis_kelamin||'-'
    };
  }

  async function guard(){
    if(!sb)throw new Error('Supabase belum termuat.');
    const {data:{user},error:ae}=await sb.auth.getUser();
    if(ae)throw ae;
    if(!user){location.href='../login.html';return null;}
    const {data:profile,error:pe}=await sb.from('profiles').select('role,nama').eq('id',user.id).maybeSingle();
    if(pe)throw pe;
    if(!profile||!ALLOWED.includes(profile.role)){
      throw new Error('Akun ini belum memiliki role admin, ketua_rt, atau super_admin.');
    }
    const name=profile.nama||'Admin Pengurus';
    const initial=name.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'AF';
    document.querySelectorAll('.admin-user>span,.admin-tools>span').forEach(x=>x.textContent=initial);
    return user;
  }

  async function load(){
    if(loading)return;
    loading=true;
    hideNotice();
    const table=$('#suratTable');
    if(table){table.className='loading';table.innerHTML='Memuat data pengajuan...';}
    try{
      await guard();
      const {data,error}=await sb.from('surat_pengajuan')
        .select('id,kode_pengajuan,warga_id,pemohon_nama,jenis,status,keperluan,data_form,catatan,catatan_admin,nomor_surat,tanggal_pengajuan,created_at,updated_at,selesai_at,warga(nama,nik,no_kk,alamat)')
        .order('created_at',{ascending:false});
      if(error)throw error;
      rows=data||[];
      draw();
      window.updateAdminNotificationBell?.();
      notice(`${rows.length} pengajuan dimuat dari Supabase.`);
    }catch(e){
      console.error('[Pengajuan Surat]',e);
      if(table){table.className='';table.innerHTML='';}
      notice('Gagal memuat pengajuan: '+(e.message||e),true);
    }finally{
      loading=false;
    }
  }

  function filtered(){
    const q=($('#qSurat')?.value||'').trim().toLowerCase();
    if(!q)return rows;
    return rows.filter(x=>{
      const p=person(x),f=formData(x);
      return [x.kode_pengajuan,x.pemohon_nama,p.nama,p.nik,p.alamat,p.nohp,x.jenis,x.nomor_surat,x.status,x.catatan,x.catatan_admin,x.keperluan,JSON.stringify(f)].join(' ').toLowerCase().includes(q);
    });
  }

  function draw(){
    const list=filtered();
    const html=list.map(x=>{
      const p=person(x);
      return `<tr>
        <td><b>${esc(x.kode_pengajuan||'-')}</b><small>${fmtDate(x.tanggal_pengajuan||x.created_at)}</small></td>
        <td><b>${esc(p.nama)}</b><small>NIK: ${esc(p.nik)}</small></td>
        <td>${esc(labelJenis(x.jenis))}</td>
        <td>${statusBadge(x.status)}</td>
        <td>${esc(x.nomor_surat||'-')}</td>
        <td><button type="button" data-detail="${esc(x.id)}">Detail</button></td>
      </tr>`;
    }).join('');
    $('#suratTable').className='table-scroll';
    $('#suratTable').innerHTML=`<table class="wide-table"><thead><tr><th>Kode</th><th>Pemohon</th><th>Jenis</th><th>Status</th><th>Nomor Surat</th><th>Aksi</th></tr></thead><tbody>${html||'<tr><td colspan="6"><small>Tidak ada pengajuan.</small></td></tr>'}</tbody></table>`;
    document.querySelectorAll('[data-detail]').forEach(el=>el.addEventListener('click',()=>openDetail(el.dataset.detail)));
  }

  function openDetail(id){
    const x=rows.find(r=>r.id===id);
    if(!x)return;
    const p=person(x),f=formData(x);
    const field=(label,value)=>`<div style="margin:8px 0"><small style="display:block;color:var(--muted);font-size:9px">${esc(label)}</small><b style="font-size:11px">${esc(value||'-')}</b></div>`;
    const extra=Object.entries(f).filter(([k])=>!['pemohon_nama','nik','alamat','no_hp','tempat_lahir','tanggal_lahir','jenis_kelamin'].includes(k));
    const extraHtml=extra.length?`<div style="border-top:1px solid var(--line);padding-top:10px;margin-top:12px">${extra.map(([k,v])=>field(k.replaceAll('_',' '),Array.isArray(v)?v.join(', '):v)).join('')}</div>`:'';
    const body=`<div class="form-grid">
      <div>${field('Kode Pengajuan',x.kode_pengajuan)}</div>
      <div>${field('Tanggal Pengajuan',fmtDate(x.tanggal_pengajuan||x.created_at))}</div>
      <div>${field('Nama Pemohon',p.nama)}</div>
      <div>${field('NIK',p.nik)}</div>
      <div>${field('Tempat, Tanggal Lahir',`${p.tempat_lahir}, ${p.tanggal_lahir}`)}</div>
      <div>${field('Jenis Kelamin',p.jenis_kelamin)}</div>
      <div style="grid-column:1/-1">${field('Alamat',p.alamat)}</div>
      <div style="grid-column:1/-1">${field('Keperluan',x.keperluan||f.keperluan||'-')}</div>
      ${extraHtml}
      <label style="grid-column:1/-1">Status<select id="detailStatus"><option value="menunggu">Menunggu</option><option value="diproses">Diproses</option><option value="selesai">Selesai</option><option value="ditolak">Ditolak</option></select></label>
      <label style="grid-column:1/-1">Nomor Surat<input id="detailNomor" maxlength="120" value="${esc(x.nomor_surat||'')}" placeholder="Kosongkan untuk nomor otomatis saat status Selesai"></label>
      <label style="grid-column:1/-1">Catatan Admin<textarea id="detailCatatan" rows="4" maxlength="1000" placeholder="Catatan untuk pemohon">${esc(x.catatan_admin||x.catatan||'')}</textarea></label>
    </div>`;
    document.querySelector('.modal')?.remove();
    const m=document.createElement('div');m.className='modal';
    m.innerHTML=`<div class="modal-box"><div class="card-head"><h3>Detail Pengajuan</h3><button type="button" id="modalClose" aria-label="Tutup">×</button></div><div class="modal-body">${body}</div><div class="modal-actions"><button type="button" id="modalCancel">Batal</button><button type="button" class="green-mini" id="modalSave">Simpan Perubahan</button></div></div>`;
    document.body.appendChild(m);
    $('#detailStatus').value=x.status||'menunggu';
    const close=()=>m.remove();
    $('#modalClose').onclick=close;$('#modalCancel').onclick=close;
    let saving=false;
    $('#modalSave').onclick=async()=>{
      if(saving)return;
      const saveBtn=$('#modalSave');saving=true;saveBtn.disabled=true;saveBtn.textContent='Menyimpan...';
      try{
        const status=$('#detailStatus').value;
        const nomor=$('#detailNomor').value.trim();
        const catatan=$('#detailCatatan').value.trim();
        const {error}=await sb.from('surat_pengajuan').update({status,nomor_surat:nomor||null,catatan_admin:catatan||null,catatan:catatan||null,updated_at:new Date().toISOString()}).eq('id',id);
        if(error)throw error;
        close();
        await load();
        notice('Pengajuan berhasil diperbarui.');
      }catch(e){
        console.error('[Pengajuan update]',e);
        saving=false;saveBtn.disabled=false;saveBtn.textContent='Simpan Perubahan';
        notice('Gagal memperbarui pengajuan: '+(e.message||e),true);
      }
    };
  }

  function printSurat(id){
    const x=rows.find(r=>r.id===id);if(!x)return;
    const p=person(x),w=window.open('','_blank');
    if(!w){notice('Popup diblokir browser. Izinkan popup untuk mencetak surat.',true);return;}
    w.document.write(`<html><head><title>${esc(x.nomor_surat||'Surat RT Dawung')}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.6;color:#222}.center{text-align:center}hr{border:0;border-top:2px solid #222}.row{margin:5px 0}.meta{color:#555;font-size:13px}@media print{body{margin:0 auto}}</style></head><body>
      <div class="center"><b>PEMERINTAH DUSUN DAWUNG</b><br>RT 04 / RW 01</div><hr>
      <div class="center"><b>SURAT ${esc(labelJenis(x.jenis)).toUpperCase()}</b><br>${esc(x.nomor_surat||'')}</div>
      <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
      <p><b>${esc(p.nama)}</b><br>NIK: ${esc(p.nik)}<br>Alamat: ${esc(p.alamat)}</p>
      ${x.keperluan?`<p>Keperluan: ${esc(x.keperluan)}</p>`:''}
      <p>Status pengajuan: <b>${esc(statusLabel[x.status]||x.status||'-')}</b></p>
      <p>Catatan: ${esc(x.catatan_admin||x.catatan||'-')}</p>
      <br><p>Dusun Dawung, ${fmtDate(x.tanggal_pengajuan||x.created_at)}</p><p>Ketua RT 04 / RW 01</p>
    </body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),150);
  }

  $('#todayLabel').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  $('#adminHamb').onclick=()=>$('.admin-side').classList.toggle('open');
  const refreshBtn=$('#refreshBtn');if(refreshBtn)refreshBtn.onclick=()=>load();
  $('#searchBtn').onclick=draw;
  $('#qSurat').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();draw();}};
  $('#logout').onclick=async()=>{try{await sb?.auth.signOut()}catch(_){} localStorage.removeItem('dawung_auth');localStorage.removeItem('dawung_user');location.href='../login.html';};
  window.printPengajuanSurat=printSurat;
  load();
})();
