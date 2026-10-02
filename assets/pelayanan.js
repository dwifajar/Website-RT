/* Pelayanan Surat: Admin + pengajuan publik tanpa akun warga. */
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

  function options(selected=''){return jenis.map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');}
  function labelJenis(v){return (jenis.find(x=>x[0]===v)||[,v])[1];}
  function statusBadge(s){return `<label class="p ${s==='selesai'?'greenp':s==='ditolak'?'redp':s==='diproses'?'blue':'yellow'}">${statusLabel[s]||s}</label>`;}

  async function currentUser(){
    const {data,error}=await sb.auth.getUser();
    if(error) throw error;
    return data.user;
  }
  async function admin(){
    const u=await currentUser(); if(!u)return false;
    const {data,error}=await sb.from('profiles').select('role').eq('id',u.id).maybeSingle();
    if(error)throw error;
    return !!data&&['admin','ketua_rt'].includes(data.role);
  }

  async function loadAdmin(){
    const ok=await admin(); if(!ok)return false;
    const {data,error}=await sb.from('surat_pengajuan')
      .select('*,warga(nama,nik,no_kk,alamat)')
      .order('created_at',{ascending:false});
    if(error)throw error;
    window.__DAWUNG_SURAT=data||[];
    return data||[];
  }

  async function renderAdmin(){
    if(!window.A)return;
    head('Pengajuan Surat');
    A.app.innerHTML=card(`<div class="card-head"><div><b>Pelayanan Surat</b><small>Pengajuan warga tersimpan di PostgreSQL Supabase</small></div><button class="green-mini" id="addSuratOnline">＋ Pengajuan Manual</button></div>
      <div class="search"><input id="qSurat" placeholder="Cari nama, NIK, jenis, nomor surat"><button id="searchSurat">Cari</button></div>
      <div id="suratOnlineTable"><small>Memuat data...</small></div>`,'wide');
    try{await loadAdmin();drawAdmin();}catch(e){
      document.querySelector('#suratOnlineTable').innerHTML=`<p class="redp">Gagal memuat pelayanan: ${escLocal(e.message)}</p>`;return;
    }
    document.querySelector('#searchSurat').onclick=drawAdmin;
    document.querySelector('#qSurat').onkeydown=e=>{if(e.key==='Enter')drawAdmin()};
    document.querySelector('#addSuratOnline').onclick=()=>adminModal();
  }

  function drawAdmin(){
    const q=(document.querySelector('#qSurat')?.value||'').toLowerCase();
    const rows=(window.__DAWUNG_SURAT||[]).filter(x=>{
      const f=x.data_form||{};
      return [x.warga?.nama,x.warga?.nik,x.pemohon_nama,f.nik,x.jenis,x.nomor_surat,x.keperluan].join(' ').toLowerCase().includes(q);
    }).map(x=>`<tr>
      <td><b>${escLocal(x.warga?.nama||x.pemohon_nama||'-')}</b><small>${escLocal(x.warga?.nik||x.data_form?.nik||'')}</small></td>
      <td>${escLocal(labelJenis(x.jenis))}</td>
      <td>${fmtDate(x.tanggal_pengajuan)}</td>
      <td>${x.nomor_surat?escLocal(x.nomor_surat):'-'}</td>
      <td>${statusBadge(x.status)}</td>
      <td><button onclick="viewSurat('${x.id}')">Detail</button> <button onclick="processSurat('${x.id}')">Proses</button></td>
    </tr>`).join('');
    document.querySelector('#suratOnlineTable').innerHTML=table(rows,['Pemohon','Jenis','Tanggal','Nomor Surat','Status','Aksi']);
  }

  function adminModal(existing){
    const x=existing;
    const body=`<label>Nama Pemohon<input id="mPemohon" value="${escLocal(x?.pemohon_nama||x?.warga?.nama||'')}" placeholder="Nama pemohon"></label>
      <label>NIK<input id="mNik" maxlength="16" value="${escLocal(x?.data_form?.nik||x?.warga?.nik||'')}" placeholder="16 digit NIK"></label>
      <label>Jenis Surat<select id="mJenis">${options(x?.jenis||'surat_pengantar')}</select></label>
      <label>Keperluan<textarea id="mKeperluan" rows="3" placeholder="Jelaskan keperluan surat">${escLocal(x?.keperluan||'')}</textarea></label>
      <label>Catatan Admin<textarea id="mCatatan" rows="3" placeholder="Catatan untuk warga">${escLocal(x?.catatan_admin||'')}</textarea></label>`;
    modal(x?'Detail / Edit Pengajuan':'Pengajuan Surat Manual',body,async()=>{
      if(!existing){
        toast('Pengajuan manual dapat dibuat setelah data pemohon diisi melalui form yang tersedia.');return;
      }
      const nik=document.querySelector('#mNik').value.trim();
      const payload={
        pemohon_nama:document.querySelector('#mPemohon').value.trim(),
        jenis:document.querySelector('#mJenis').value,
        keperluan:document.querySelector('#mKeperluan').value.trim(),
        catatan_admin:document.querySelector('#mCatatan').value.trim(),
        data_form:{...(x.data_form||{}),nik}
      };
      if(!payload.pemohon_nama||!/^\d{16}$/.test(nik)||!payload.keperluan){toast('Nama, NIK 16 digit, dan keperluan wajib diisi');return;}
      const {error}=await sb.from('surat_pengajuan').update(payload).eq('id',existing.id);
      if(error){toast(error.message);return;}
      closeModal();await renderAdmin();toast('Pengajuan diperbarui');
    });
  }

  window.viewSurat=async id=>{const x=(window.__DAWUNG_SURAT||[]).find(x=>x.id===id);if(x)adminModal(x);};
  window.processSurat=async id=>{
    const x=(window.__DAWUNG_SURAT||[]).find(x=>x.id===id); if(!x)return;
    const body=`<label>Status<select id="pStatus"><option value="menunggu">Menunggu</option><option value="diproses">Diproses</option><option value="selesai">Selesai</option><option value="ditolak">Ditolak</option></select></label>
      <label>Nomor Surat (opsional)<input id="pNomor" value="${escLocal(x.nomor_surat||'')}" placeholder="Isi nomor surat"></label>
      <label>Catatan Admin<textarea id="pCatatan" rows="3">${escLocal(x.catatan_admin||'')}</textarea></label>`;
    modal('Proses Pengajuan',body,async()=>{
      const status=document.querySelector('#pStatus').value;
      const nomor=document.querySelector('#pNomor').value.trim()||null;
      const payload={status,nomor_surat:nomor,catatan_admin:document.querySelector('#pCatatan').value.trim()||null};
      const {error}=await sb.from('surat_pengajuan').update(payload).eq('id',id);
      if(error){toast(error.message);return;}
      closeModal();await renderAdmin();toast('Status pengajuan diperbarui');
    });
    document.querySelector('#pStatus').value=x.status;
  };

  window.printOnlineSurat=async id=>{
    const x=(window.__DAWUNG_SURAT||[]).find(x=>x.id===id);if(!x)return;
    const f=x.data_form||{};
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>${escLocal(x.nomor_surat||'Surat RT Dawung')}</title><style>body{font-family:Arial;max-width:760px;margin:40px auto;line-height:1.6}.center{text-align:center}hr{border:0;border-top:2px solid #222}</style></head><body>
      <div class="center"><b>PEMERINTAH DUSUN DAWUNG</b><br>RT 04 / RW 01</div><hr>
      <div class="center"><b>SURAT ${escLocal(labelJenis(x.jenis)).toUpperCase()}</b><br>${escLocal(x.nomor_surat||'')}</div>
      <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
      <p><b>${escLocal(x.pemohon_nama||x.warga?.nama||'-')}</b><br>NIK: ${escLocal(f.nik||x.warga?.nik||'-')}<br>Alamat: ${escLocal(f.alamat||x.warga?.alamat||'-')}</p>
      <p>Keperluan: ${escLocal(x.keperluan||'-')}</p><br>
      <p>Dusun Dawung, ${fmtDate(x.tanggal_pengajuan)}</p><p>Ketua RT 04 / RW 01</p>
      <script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  };

  /* Form publik: tidak memerlukan login warga dan tidak meminta No. KK. */
  function publicFormHtml(){
    return `<section class="admin-card wide">
      <div class="card-head"><div><b>Pengajuan Surat</b><small>Isi data seperlunya. Tidak perlu membuat akun warga.</small></div></div>
      <form id="publicSuratForm" class="form-grid">
        <label>Nama Lengkap *<input id="pNama" required maxlength="100" autocomplete="name"></label>
        <label>NIK *<input id="pNik" required maxlength="16" inputmode="numeric" pattern="\\d{16}" placeholder="16 digit NIK"></label>
        <label>Tempat Lahir<input id="pTempatLahir" maxlength="80"></label>
        <label>Tanggal Lahir<input id="pTanggalLahir" type="date"></label>
        <label>Jenis Kelamin<select id="pJk"><option value="">Pilih</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
        <label class="full">Alamat *<textarea id="pAlamat" required rows="2"></textarea></label>
        <label>RT/RW<input id="pRtRw" value="04/01" maxlength="5"></label>
        <label>No. HP / WhatsApp *<input id="pHp" required maxlength="20" inputmode="tel"></label>
        <label>Jenis Surat *<select id="pJenis" required>${options()}</select></label>
        <label class="full">Keperluan *<textarea id="pKeperluan" required rows="4" placeholder="Jelaskan keperluan surat"></textarea></label>
        <div class="full"><button class="green-mini" type="submit">Kirim Pengajuan</button></div>
      </form>
      <div id="publicSuratResult"></div>
    </section>`;
  }

  async function submitPublic(e){
    e.preventDefault();
    const btn=e.currentTarget.querySelector('button[type=submit]');
    const result=document.querySelector('#publicSuratResult');
    const nik=document.querySelector('#pNik').value.trim();
    if(!/^\d{16}$/.test(nik)){result.innerHTML='<p class="redp">NIK harus terdiri dari 16 digit angka.</p>';return;}
    btn.disabled=true; btn.textContent='Mengirim...';
    const data_form={
      nik,
      tempat_lahir:document.querySelector('#pTempatLahir').value.trim(),
      tanggal_lahir:document.querySelector('#pTanggalLahir').value,
      jenis_kelamin:document.querySelector('#pJk').value,
      alamat:document.querySelector('#pAlamat').value.trim(),
      rt_rw:document.querySelector('#pRtRw').value.trim()||'04/01',
      hp:document.querySelector('#pHp').value.trim()
    };
    const payload={
      pemohon_nama:document.querySelector('#pNama').value.trim(),
      jenis:document.querySelector('#pJenis').value,
      keperluan:document.querySelector('#pKeperluan').value.trim(),
      data_form
    };
    const {data,error}=await sb.from('surat_pengajuan').insert(payload).select('id,tanggal_pengajuan,nomor_pengajuan,status').single();
    if(error){
      result.innerHTML=`<p class="redp">Pengajuan gagal: ${escLocal(error.message)}</p>`;
      btn.disabled=false;btn.textContent='Kirim Pengajuan';return;
    }
    result.innerHTML=`<div class="admin-card" style="margin-top:16px"><h3>Pengajuan berhasil dikirim</h3><p>Nomor pengajuan Anda:</p><p style="font-size:24px;font-weight:800">${escLocal(data.nomor_pengajuan||data.id)}</p><p>Status: ${statusBadge(data.status||'menunggu')}</p><small>Simpan nomor pengajuan ini untuk mengecek status.</small></div>`;
    e.currentTarget.reset();
    document.querySelector('#pRtRw').value='04/01';
    btn.disabled=false;btn.textContent='Kirim Pengajuan';
  }

  async function renderPelayananPublik(target){
    const el=typeof target==='string'?document.querySelector(target):target||document.querySelector('#pelayananApp');
    if(!el)return;
    el.innerHTML=publicFormHtml();
    document.querySelector('#publicSuratForm').addEventListener('submit',submitPublic);
  }

  window.renderPelayananAdmin=renderAdmin;
  window.renderPelayananWarga=renderPelayananPublik;
  window.renderPelayananPublik=renderPelayananPublik;
})();