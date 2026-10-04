/* Production data layer for Warga + Kartu Keluarga. Requires DAWUNG_SUPABASE and admin.js. */
(function(){
  const sb = window.DAWUNG_SUPABASE;
  if(!sb) return;
  const statusMap={aktif:'Aktif',nonaktif:'Nonaktif'};
  const roleCache={};
  async function isAdmin(){
    const {data:{user}}=await sb.auth.getUser();
    if(!user) return false;
    const {data,error}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();
    if(error) throw error;
    return !!data && ['admin','ketua_rt','super_admin'].includes(data.role);
  }
  function rowToLocal(w){return {id:w.id,nama:w.nama,nik:w.nik||'',kk:w.no_kk||'',alamat:w.alamat||'',status:statusMap[w.status]||w.status,profile_id:w.profile_id};}
  async function load(){
    const ok=await isAdmin();
    if(!ok){return false;}
    const [{data:warga,error:we},{data:kk,error:ke}]=await Promise.all([
      sb.from('warga').select('*').order('nama'),
      sb.from('kartu_keluarga').select('*').order('no_kk')
    ]);
    if(we) throw we; if(ke) throw ke;
    A.d.warga=(warga||[]).map(rowToLocal);
    A.d.kk=kk||[];
    window.__DAWUNG_KK=A.d.kk;
    window.renderWarga=renderWarga;
    window.renderKK=renderKK;
    render(window.__ADMIN_REQUESTED_PAGE || 'dashboard');
  }
  function renderWarga(){
    head('Data Warga');
    A.app.innerHTML=card(`<div class="card-head"><div><b>Data Warga</b><small>Data tersimpan di PostgreSQL Supabase</small></div><button class="green-mini" id="addWarga">＋ Tambah Warga</button></div><div class="search"><input id="qW" placeholder="Cari nama, NIK, atau KK"><button id="searchW">Cari</button></div><div id="wTable"></div>`,`wide`);
    drawWarga();
    document.querySelector('#searchW').onclick=drawWarga;
    document.querySelector('#qW').addEventListener('keydown',e=>{if(e.key==='Enter')drawWarga()});
    document.querySelector('#addWarga').onclick=()=>wargaModal();
  }
  function drawWarga(){
    const q=(document.querySelector('#qW')?.value||'').toLowerCase();
    const rows=A.d.warga.filter(x=>Object.values(x).join(' ').toLowerCase().includes(q)).map(x=>`<tr><td><b>${esc(x.nama)}</b><small>${esc(x.alamat)}</small></td><td>${esc(x.nik||'-')}</td><td>${esc(x.kk||'-')}</td><td><label class="p ${x.status==='Aktif'?'greenp':'yellow'}">${x.status}</label></td><td><button onclick="editW('${x.id}')">Edit</button> <button onclick="delW('${x.id}')">Hapus</button></td></tr>`).join('');
    document.querySelector('#wTable').innerHTML=table(rows,['Nama','NIK','No. KK','Status','Aksi']);
  }
  async function wargaModal(existing){
    const kk=A.d.kk||[];
    const options=kk.map(k=>`<option value="${esc(k.no_kk)}" ${existing&&existing.kk===k.no_kk?'selected':''}>${esc(k.no_kk)} — ${esc(k.kepala_keluarga)}</option>`).join('');
    const body=`<label>Nama Lengkap<input id="mNama" value="${existing?esc(existing.nama):''}" required></label><label>NIK<input id="mNik" maxlength="16" inputmode="numeric" value="${existing?esc(existing.nik||''):''}"></label><label>No. KK<select id="mKk"><option value="">Belum ditautkan</option>${options}</select></label><label>Alamat<input id="mAlamat" value="${existing?esc(existing.alamat):'Dusun Dawung'}"></label><label>Status<select id="mStatus"><option value="aktif" ${!existing||existing.status==='Aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${existing&&existing.status==='Nonaktif'?'selected':''}>Nonaktif</option></select></label>`;
    modal(existing?'Edit Warga':'Tambah Warga',body,async()=>{
      const payload={nama:mNama.value.trim(),nik:mNik.value.trim()||null,no_kk:mKk.value||null,alamat:mAlamat.value.trim()||'Dusun Dawung',rt:'04',rw:'01',status:mStatus.value};
      if(!payload.nama){toast('Nama wajib diisi');return;}
      let res;
      if(existing) res=await sb.from('warga').update(payload).eq('id',existing.id).select().single();
      else res=await sb.from('warga').insert(payload).select().single();
      if(res.error){toast(res.error.message);return;}
      closeModal();toast(existing?'Data warga diperbarui':'Warga ditambahkan');await refreshWarga();renderWarga();
    });
  }
  async function refreshWarga(){const {data,error}=await sb.from('warga').select('*').order('nama');if(error)throw error;A.d.warga=(data||[]).map(rowToLocal);}
  window.editW=async id=>{const x=A.d.warga.find(x=>x.id===id);if(x)wargaModal(x)};
  window.delW=async id=>{if(!confirm('Hapus warga ini? Data akan dihapus dari database.'))return;const {error}=await sb.from('warga').delete().eq('id',id);if(error){toast(error.message);return;}await refreshWarga();renderWarga();toast('Warga dihapus');};

  function renderKK(){
    head('Kartu Keluarga');
    const rows=(A.d.kk||[]).map(x=>`<tr><td><b>${esc(x.no_kk)}</b></td><td>${esc(x.kepala_keluarga)}</td><td>${esc(x.alamat)}</td><td>${esc(x.rt)} / ${esc(x.rw)}</td><td><button onclick="editKK('${x.id}')">Edit</button> <button onclick="delKK('${x.id}')">Hapus</button></td></tr>`).join('');
    A.app.innerHTML=card(`<div class="card-head"><div><b>Data Kartu Keluarga</b><small>${(A.d.kk||[]).length} KK tersimpan di PostgreSQL Supabase</small></div><button class="green-mini" id="addKK">＋ Tambah KK</button></div>${table(rows,['No. KK','Kepala Keluarga','Alamat','RT/RW','Aksi'])}`,`wide`);
    document.querySelector('#addKK').onclick=()=>kkModal();
  }
  function kkModal(existing){
    const body=`<label>No. KK<input id="kNo" maxlength="16" inputmode="numeric" value="${existing?esc(existing.no_kk):''}"></label><label>Kepala Keluarga<input id="kKepala" value="${existing?esc(existing.kepala_keluarga):''}"></label><label>Alamat<input id="kAlamat" value="${existing?esc(existing.alamat):'Dusun Dawung'}"></label>`;
    modal(existing?'Edit Kartu Keluarga':'Tambah Kartu Keluarga',body,async()=>{
      const payload={no_kk:kNo.value.trim(),kepala_keluarga:kKepala.value.trim(),alamat:kAlamat.value.trim()||'Dusun Dawung',rt:'04',rw:'01'};
      if(!payload.no_kk||!payload.kepala_keluarga){toast('No. KK dan kepala keluarga wajib diisi');return;}
      let res=existing?await sb.from('kartu_keluarga').update(payload).eq('id',existing.id).select().single():await sb.from('kartu_keluarga').insert(payload).select().single();
      if(res.error){toast(res.error.message);return;}
      await refreshKK();closeModal();renderKK();toast(existing?'KK diperbarui':'KK ditambahkan');
    });
  }
  async function refreshKK(){const {data,error}=await sb.from('kartu_keluarga').select('*').order('no_kk');if(error)throw error;A.d.kk=data||[];window.__DAWUNG_KK=A.d.kk;}
  window.editKK=async id=>{const x=(A.d.kk||[]).find(x=>x.id===id);if(x)kkModal(x)};
  window.delKK=async id=>{if(!confirm('Hapus KK ini? Warga yang tertaut akan kehilangan tautan KK.'))return;const {error}=await sb.from('kartu_keluarga').delete().eq('id',id);if(error){toast(error.message);return;}await refreshKK();await refreshWarga();renderKK();toast('KK dihapus');};

  window.initSupabaseWarga=async()=>{try{await load()}catch(e){console.error(e);toast('Gagal memuat data RT: '+(e.message||e));render(window.__ADMIN_REQUESTED_PAGE||'dashboard')}};
})();
