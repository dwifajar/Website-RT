/* Pelayanan surat: admin + warga, Supabase production module. */
(function(){
  const sb = window.DAWUNG_SUPABASE;
  if(!sb) return;
  const jenis = [
    ['surat_pengantar','Surat Pengantar'],
    ['domisili','Surat Keterangan Domisili'],
    ['sktm','Surat Keterangan Tidak Mampu (SKTM)'],
    ['usaha','Surat Keterangan Usaha'],
    ['lainnya','Surat Keterangan Lainnya']
  ];
  const statusLabel={menunggu:'Menunggu',diproses:'Diproses',selesai:'Selesai',ditolak:'Ditolak'};
  const escLocal=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtDate=d=>d?new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';

  async function currentUser(){const {data,error}=await sb.auth.getUser();if(error)throw error;return data.user;}
  async function admin(){
    const u=await currentUser(); if(!u)return false;
    const {data,error}=await sb.from('profiles').select('role').eq('id',u.id).maybeSingle();
    if(error)throw error; return !!data&&['admin','ketua_rt','super_admin'].includes(data.role);
  }
  async function wargaForUser(){
    const u=await currentUser(); if(!u) return null;
    const {data,error}=await sb.from('warga').select('*').eq('profile_id',u.id).maybeSingle();
    if(error)throw error; return data;
  }
  function options(selected=''){return jenis.map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');}
  function statusBadge(s){return `<label class="p ${s==='selesai'?'greenp':s==='ditolak'?'redp':s==='diproses'?'blue':'yellow'}">${statusLabel[s]||s}</label>`;}

  async function loadAdmin(){
    const ok=await admin();
    if(!ok){
      head('Pengajuan Surat');
      A.app.innerHTML=card('<div class="card-head"><div><b>Akses Pengajuan Surat</b><small>Akun Anda belum memiliki hak akses untuk modul pengajuan surat.</small></div></div>','wide');
      return;
    }
    const {data,error}=await sb.from('surat_pengajuan').select('*,warga(nama,nik,no_kk,alamat)').order('created_at',{ascending:false});
    if(error)throw error; window.__DAWUNG_SURAT=data||[]; return data||[];
  }
  async function renderAdmin(){
    if(!window.A)return;
    head('Pengajuan Surat');
    A.app.innerHTML=card(`<div class="card-head"><div><b>Pelayanan Surat</b><small>Pengajuan warga tersimpan di PostgreSQL Supabase</small></div><button class="green-mini" id="addSuratOnline">＋ Pengajuan Manual</button></div><div class="search"><input id="qSurat" placeholder="Cari nama, jenis, nomor surat"><button id="searchSurat">Cari</button></div><div id="suratOnlineTable"><small>Memuat data...</small></div>`,'wide');
    try{await loadAdmin();drawAdmin();}catch(e){document.querySelector('#suratOnlineTable').innerHTML=`<p class="redp">Gagal memuat pelayanan: ${escLocal(e.message)}</p>`;return;}
    document.querySelector('#searchSurat').onclick=drawAdmin;
    document.querySelector('#qSurat').onkeydown=e=>{if(e.key==='Enter')drawAdmin()};
    document.querySelector('#addSuratOnline').onclick=()=>adminModal();
  }
  function drawAdmin(){
    const q=(document.querySelector('#qSurat')?.value||'').toLowerCase();
    const rows=(window.__DAWUNG_SURAT||[]).filter(x=>[x.warga?.nama,x.jenis,x.nomor_surat,x.keperluan].join(' ').toLowerCase().includes(q)).map(x=>`<tr>
      <td><b>${escLocal(x.warga?.nama||x.pemohon_nama||'-')}</b><small>${escLocal(x.warga?.nik||'')}</small></td>
      <td>${escLocal(labelJenis(x.jenis))}</td>
      <td>${fmtDate(x.tanggal_pengajuan)}</td>
      <td>${x.nomor_surat?escLocal(x.nomor_surat):'-'}</td>
      <td>${statusBadge(x.status)}</td>
      <td><button onclick="viewSurat('${x.id}')">Detail</button> <button onclick="processSurat('${x.id}')">Proses</button></td>
    </tr>`).join('');
    document.querySelector('#suratOnlineTable').innerHTML=table(rows,['Pemohon','Jenis','Tanggal','Nomor Surat','Status','Aksi']);
  }
  function labelJenis(v){return (jenis.find(x=>x[0]===v)||[,v])[1];}
  function adminModal(existing){
    const x=existing;
    const body=`<label>Warga (nama)<input id="mPemohon" value="${escLocal(x?.warga?.nama||x?.pemohon_nama||'')}" placeholder="Nama warga"></label>
      <label>Jenis Surat<select id="mJenis">${options(x?.jenis||'surat_pengantar')}</select></label>
      <label>Keperluan<textarea id="mKeperluan" rows="3" placeholder="Jelaskan keperluan surat">${escLocal(x?.keperluan||'')}</textarea></label>
      <label>Catatan Admin<textarea id="mCatatan" rows="3" placeholder="Catatan untuk warga">${escLocal(x?.catatan_admin||'')}</textarea></label>`;
    modal(x?'Detail / Edit Pengajuan':'Pengajuan Surat Manual',body,async()=>{
      if(!existing){toast('Pengajuan manual sebaiknya memilih warga terdaftar dari modul Warga. Gunakan pengajuan dari akun warga untuk data produksi.');return;}
      const payload={jenis:document.querySelector('#mJenis').value,keperluan:document.querySelector('#mKeperluan').value.trim(),catatan_admin:document.querySelector('#mCatatan').value.trim()};
      const {error}=await sb.from('surat_pengajuan').update(payload).eq('id',existing.id); if(error){toast(error.message);return;}
      closeModal();await renderAdmin();toast('Pengajuan diperbarui');
    });
  }
  window.viewSurat=async id=>{const x=(window.__DAWUNG_SURAT||[]).find(x=>x.id===id);if(x)adminModal(x)};
  window.processSurat=async id=>{
    const x=(window.__DAWUNG_SURAT||[]).find(x=>x.id===id); if(!x)return;
    const body=`<label>Status<select id="pStatus"><option value="menunggu">Menunggu</option><option value="diproses">Diproses</option><option value="selesai">Selesai</option><option value="ditolak">Ditolak</option></select></label><label>Nomor Surat (opsional)<input id="pNomor" value="${escLocal(x.nomor_surat||'')}" placeholder="Otomatis saat selesai"></label><label>Catatan Admin<textarea id="pCatatan" rows="3">${escLocal(x.catatan_admin||'')}</textarea></label>`;
    modal('Proses Pengajuan',body,async()=>{
      const payload={status:document.querySelector('#pStatus').value,nomor_surat:document.querySelector('#pNomor').value.trim()||null,catatan_admin:document.querySelector('#pCatatan').value.trim()||null};
      const {error}=await sb.from('surat_pengajuan').update(payload).eq('id',id); if(error){toast(error.message);return;}
      closeModal();await renderAdmin();toast('Status pengajuan diperbarui');
    });
    document.querySelector('#pStatus').value=x.status;
  };
  window.printOnlineSurat=async id=>{
    const x=(window.__DAWUNG_SURAT||[]).find(x=>x.id===id);if(!x)return;
    const w=window.open('','_blank');w.document.write(`<html><head><title>${escLocal(x.nomor_surat||'Surat RT Dawung')}</title><style>body{font-family:Arial;max-width:760px;margin:40px auto;line-height:1.6}.center{text-align:center}hr{border:0;border-top:2px solid #222}</style></head><body><div class="center"><b>PEMERINTAH DUSUN DAWUNG</b><br>RT 04 / RW 01</div><hr><div class="center"><b>SURAT ${escLocal(labelJenis(x.jenis)).toUpperCase()}</b><br>${escLocal(x.nomor_surat||'')}</div><p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p><p><b>${escLocal(x.warga?.nama||x.pemohon_nama||'-')}</b><br>NIK: ${escLocal(x.warga?.nik||'-')}<br>No. KK: ${escLocal(x.warga?.no_kk||'-')}<br>Alamat: ${escLocal(x.warga?.alamat||'-')}</p><p>Keperluan: ${escLocal(x.keperluan||'-')}</p><br><p>Dusun Dawung, ${fmtDate(x.tanggal_pengajuan)}</p><p>Ketua RT 04 / RW 01</p></body></html>`);w.document.close();w.print();
  };

  async function renderWargaPage(){
    const warga=await wargaForUser();
    const container=document.querySelector('#wargaApp'); if(!container||!warga)return;
    const {data,error}=await sb.from('surat_pengajuan').select('*').eq('warga_id',warga.id).order('created_at',{ascending:false});
    if(error){toast(error.message);return;}
    window.__WARGA_SURAT=data||[];
    container.innerHTML=`<section class="admin-card wide"><div class="card-head"><div><b>Pengajuan Surat</b><small>Ajukan surat administrasi RT secara online</small></div><button class="green-mini" id="ajukanSurat">＋ Ajukan Surat</button></div><div class="table-scroll"><table class="wide-table"><thead><tr><th>Jenis</th><th>Tanggal</th><th>Nomor</th><th>Status</th><th>Catatan</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><b>${escLocal(labelJenis(x.jenis))}</b><small>${escLocal(x.keperluan||'')}</small></td><td>${fmtDate(x.tanggal_pengajuan)}</td><td>${escLocal(x.nomor_surat||'-')}</td><td>${statusBadge(x.status)}</td><td>${escLocal(x.catatan_admin||'-')}</td></tr>`).join('')||'<tr><td colspan="5"><small>Belum ada pengajuan.</small></td></tr>'}</tbody></table></div></section>`;
    document.querySelector('#ajukanSurat').onclick=()=>wargaModal(warga);
  }
  function wargaModal(warga){
    modal('Ajukan Surat',`<label>Jenis Surat<select id="wJenis">${options()}</select></label><label>Keperluan<textarea id="wKeperluan" rows="4" placeholder="Tuliskan keperluan surat"></textarea></label>`,async()=>{
      const payload={warga_id:warga.id,pemohon_nama:warga.nama,jenis:document.querySelector('#wJenis').value,keperluan:document.querySelector('#wKeperluan').value.trim(),data_form:{alamat:warga.alamat,nik:warga.nik,no_kk:warga.no_kk}};
      if(!payload.keperluan){toast('Keperluan wajib diisi');return;}
      const {error}=await sb.from('surat_pengajuan').insert(payload);if(error){toast(error.message);return;}
      closeModal();await renderWargaPage();toast('Pengajuan surat berhasil dikirim');
    });
  }

  window.renderPelayananAdmin=renderAdmin;
  window.renderPelayananWarga=renderWargaPage;
})();
