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
    const all=A.d.warga||[];
    const active=all.filter(x=>String(x.status).toLowerCase()==='aktif').length;
    const inactive=all.length-active;
    A.app.innerHTML=card(`<div class="warga-management">
      <div class="warga-page-heading"><div><span class="warga-kicker">DATABASE KEPENDUDUKAN</span><h2>Data Warga</h2><p>Kelola identitas dan status warga Dusun Dawung dalam satu tempat.</p></div><div class="warga-heading-actions"><button type="button" class="warga-btn warga-btn-soft" id="refreshWarga">↻ Muat ulang</button><button type="button" class="warga-btn warga-btn-primary" id="addWarga">＋ Tambah Warga</button></div></div>
      <div class="warga-summary-grid">
        <div class="warga-summary-card"><span class="warga-summary-icon purple">♙</span><div><small>Total warga</small><b id="wargaTotalCount">${all.length}</b><span>Data terdaftar</span></div></div>
        <div class="warga-summary-card"><span class="warga-summary-icon green">✓</span><div><small>Warga aktif</small><b id="wargaActiveCount">${active}</b><span>Berstatus aktif</span></div></div>
        <div class="warga-summary-card"><span class="warga-summary-icon amber">Ⅱ</span><div><small>Nonaktif</small><b id="wargaInactiveCount">${inactive}</b><span>Perlu ditinjau bila berubah</span></div></div>
      </div>
      <div class="warga-data-panel"><div class="warga-panel-heading"><div><h3>Daftar Warga</h3><p id="wargaResultMeta">Menampilkan ${all.length} data</p></div><button type="button" class="warga-btn warga-btn-outline" id="exportWargaCsv">⇩ Ekspor CSV</button></div>
        <div class="warga-filters"><label class="warga-search-field"><span aria-hidden="true">⌕</span><input id="qW" type="search" placeholder="Cari nama, NIK, alamat, atau No. KK…" autocomplete="off"></label>
          <label class="warga-filter-label"><span>Status</span><select id="filterStatusW"><option value="">Semua status</option><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></select></label>
          <label class="warga-filter-label"><span>Kartu keluarga</span><select id="filterKKW"><option value="">Semua keluarga</option>${(A.d.kk||[]).map(k=>`<option value="${esc(k.no_kk)}">${esc(k.no_kk)} · ${esc(k.kepala_keluarga)}</option>`).join('')}</select></label>
        </div>
        <div id="wTable" aria-live="polite"></div>
      </div>
      <div class="warga-footnote"><span>ⓘ</span> Perubahan data tersimpan ke Supabase. NIK bersifat unik dan harus terdiri dari 16 digit jika diisi.</div>
    </div>`,`wide warga-management-card`);
    drawWarga();
    document.querySelector('#addWarga').onclick=()=>wargaModal();
    document.querySelector('#refreshWarga').onclick=async()=>{const b=document.querySelector('#refreshWarga');b.disabled=true;b.classList.add('is-loading');try{await refreshWarga();await refreshKK();renderWarga();toast('Data warga diperbarui.')}catch(e){toast('Gagal memuat data warga: '+(e.message||e));}finally{b.disabled=false;b.classList.remove('is-loading')}};
    document.querySelector('#qW').addEventListener('input',drawWarga);
    document.querySelector('#filterStatusW').addEventListener('change',drawWarga);
    document.querySelector('#filterKKW').addEventListener('change',drawWarga);
    document.querySelector('#exportWargaCsv').onclick=exportWargaCsv;
  }
  function getFilteredWarga(){
    const q=(document.querySelector('#qW')?.value||'').trim().toLocaleLowerCase('id-ID');
    const status=document.querySelector('#filterStatusW')?.value||'';
    const kk=document.querySelector('#filterKKW')?.value||'';
    return (A.d.warga||[]).filter(x=>{
      const hay=[x.nama,x.nik,x.kk,x.alamat,x.status].join(' ').toLocaleLowerCase('id-ID');
      return (!q||hay.includes(q))&&(!status||x.status===status)&&(!kk||x.kk===kk);
    });
  }
  function drawWarga(){
    const all=A.d.warga||[],rows=getFilteredWarga();
    const active=all.filter(x=>String(x.status).toLowerCase()==='aktif').length;
    const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    setText('wargaTotalCount',all.length);setText('wargaActiveCount',active);setText('wargaInactiveCount',all.length-active);
    setText('wargaResultMeta',`Menampilkan ${rows.length} dari ${all.length} warga`);
    const target=document.querySelector('#wTable');if(!target)return;
    const html=rows.map(x=>{
      const initial=String(x.nama||'?').trim().charAt(0).toUpperCase()||'?';
      const statusClass=x.status==='Aktif'?'greenp':'yellow';
      return `<tr>
        <td><div class="warga-person-cell"><span class="warga-person-avatar">${esc(initial)}</span><div><b>${esc(x.nama||'Tanpa nama')}</b><small>${esc(x.alamat||'Alamat belum diisi')}</small></div></div></td>
        <td><span class="warga-mono">${esc(x.nik||'—')}</span></td>
        <td><span class="warga-mono">${esc(x.kk||'—')}</span></td>
        <td><span class="warga-status-pill ${statusClass}"><i></i>${esc(x.status||'Tidak diketahui')}</span></td>
        <td><div class="warga-row-actions"><button type="button" class="warga-action-edit" data-edit-warga="${esc(x.id)}">Edit</button><button type="button" class="warga-action-delete" data-delete-warga="${esc(x.id)}">Hapus</button></div></td>
      </tr>`;
    }).join('');
    target.innerHTML=rows.length?`<div class="warga-table-scroll"><table class="warga-table"><thead><tr><th>Nama warga</th><th>NIK</th><th>No. KK</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${html}</tbody></table></div>`:`<div class="warga-empty-state"><span>⌕</span><b>${all.length?'Data tidak ditemukan':'Belum ada data warga'}</b><p>${all.length?'Coba ubah kata kunci atau filter pencarian.':'Tambahkan data warga untuk mulai mengelola database kependudukan.'}</p>${all.length?'':'<button type="button" class="warga-btn warga-btn-primary" id="addFirstWarga">＋ Tambah Warga Pertama</button>'}</div>`;
    target.querySelectorAll('[data-edit-warga]').forEach(btn=>btn.addEventListener('click',()=>window.editW(btn.dataset.editWarga)));
    target.querySelectorAll('[data-delete-warga]').forEach(btn=>btn.addEventListener('click',()=>window.delW(btn.dataset.deleteWarga)));
    target.querySelector('#addFirstWarga')?.addEventListener('click',()=>wargaModal());
  }
  function exportWargaCsv(){
    const rows=getFilteredWarga();
    if(!rows.length){toast('Tidak ada data yang dapat diekspor.');return;}
    const values=[['Nama','NIK','No. KK','Alamat','Status'],...rows.map(x=>[x.nama,x.nik,x.kk,x.alamat,x.status])];
    const csv='\uFEFF'+values.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='data-warga-dawung-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast(`Ekspor ${rows.length} data warga berhasil dibuat.`);
  }
  async function wargaModal(existing){
    const kk=A.d.kk||[];
    const options=kk.map(k=>`<option value="${esc(k.no_kk)}" ${existing&&existing.kk===k.no_kk?'selected':''}>${esc(k.no_kk)} — ${esc(k.kepala_keluarga)}</option>`).join('');
    const body=`<form class="warga-editor-form" onsubmit="return false"><div class="warga-form-intro"><span class="warga-form-icon">♙</span><div><b>Identitas Warga</b><small>Nama wajib diisi. NIK dan Kartu Keluarga boleh dikosongkan.</small></div></div><div class="form-grid"><label>Nama lengkap <em>*</em><input id="mNama" maxlength="150" value="${existing?esc(existing.nama):''}" placeholder="Masukkan nama lengkap" autocomplete="name" required></label><label>NIK <span class="optional-tag">Tidak wajib</span><input id="mNik" type="text" maxlength="16" inputmode="numeric" autocomplete="off" value="${existing?esc(existing.nik||''):''}" placeholder="Kosongkan jika belum tahu" aria-describedby="mNikHint"></label></div><label>Kartu Keluarga <span class="optional-tag">Tidak wajib</span><select id="mKk"><option value="">Belum tahu / tidak ditautkan ke KK</option>${options}</select></label><label>Alamat<input id="mAlamat" maxlength="250" value="${existing?esc(existing.alamat):'Dusun Dawung'}" placeholder="Alamat tempat tinggal" autocomplete="street-address"></label><label>Status warga<select id="mStatus"><option value="aktif" ${!existing||existing.status==='Aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${existing&&existing.status==='Nonaktif'?'selected':''}>Nonaktif</option></select></label><p class="warga-form-note" id="mNikHint">NIK dan nomor KK tidak wajib. Jika NIK diisi, harus tepat 16 digit angka. Warga tetap dapat disimpan tanpa NIK dan tanpa memilih KK.</p></form>`;
    modal(existing?'Edit Data Warga':'Tambah Data Warga',body,async()=>{
      const get=id=>document.getElementById(id);
      const nama=get('mNama').value.trim();
      const nikInput=get('mNik').value.trim();
      const kkInput=get('mKk').value.trim();
      const payload={nama,nik:nikInput||null,no_kk:kkInput||null,alamat:get('mAlamat').value.trim()||'Dusun Dawung',rt:'04',rw:'01',status:get('mStatus').value};
      if(!payload.nama){toast('Nama lengkap wajib diisi.');get('mNama').focus();return;}
      if(payload.nik&&!/^\d{16}$/.test(payload.nik)){toast('NIK harus terdiri dari tepat 16 digit angka.');get('mNik').focus();return;}
      if(payload.nik&&A.d.warga.some(w=>w.nik===payload.nik&&String(w.id)!==String(existing?.id))){toast('NIK sudah terdaftar pada data warga lain.');get('mNik').focus();return;}
      const saveBtn=document.querySelector('#modalSave');if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Menyimpan…'}
      try{
        let res;
        if(existing)res=await sb.from('warga').update(payload).eq('id',existing.id).select().single();
        else res=await sb.from('warga').insert(payload).select().single();
        if(res.error)throw res.error;
        closeModal();await refreshWarga();renderWarga();toast(existing?'Data warga berhasil diperbarui.':'Warga berhasil ditambahkan.');
      }catch(error){console.error('[Simpan warga]',error);const msg=String(error?.message||'');toast(/duplicate key|warga_nik_key|warga_nik_idx/i.test(msg)?'NIK sudah terdaftar pada warga lain.':(/not-null|not null|violates not-null constraint/i.test(msg)?'Database masih mewajibkan kolom NIK/KK. Jalankan migrasi opsional NIK dan KK terlebih dahulu.':(msg||'Gagal menyimpan data warga.')));}
      finally{if(saveBtn?.isConnected){saveBtn.disabled=false;saveBtn.textContent='Simpan'}}
    });
  }
  async function refreshWarga(){
    const {data,error}=await sb.from('warga').select('*').order('nama');if(error)throw error;A.d.warga=(data||[]).map(rowToLocal);return A.d.warga;
  }
  window.editW=async id=>{const x=A.d.warga.find(x=>String(x.id)===String(id));if(x)wargaModal(x)};
  window.delW=async id=>{
    const person=A.d.warga.find(x=>String(x.id)===String(id));
    const ok=await window.DawungConfirm({title:'Hapus data warga?',entity:person?.nama||'Data warga',message:'Data warga ini akan dihapus dari database. Pastikan data yang dipilih sudah benar.',confirmText:'Ya, hapus warga'});if(!ok)return;
    try{const {error}=await sb.from('warga').delete().eq('id',id);if(error)throw error;await refreshWarga();renderWarga();toast('Data warga berhasil dihapus.')}catch(error){toast('Gagal menghapus data warga: '+(error.message||error))}
  };

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
  window.delKK=async id=>{const family=(A.d.kk||[]).find(x=>String(x.id)===String(id));const ok=await window.DawungConfirm({title:'Hapus kartu keluarga?',entity:family?.no_kk||'Data kartu keluarga',message:'Warga yang tertaut akan kehilangan tautan ke kartu keluarga ini. Periksa kembali sebelum melanjutkan.',confirmText:'Ya, hapus KK'});if(!ok)return;const {error}=await sb.from('kartu_keluarga').delete().eq('id',id);if(error){toast(error.message);return;}await refreshKK();await refreshWarga();renderKK();};

  window.initSupabaseWarga=async()=>{try{await load()}catch(e){console.error(e);toast('Gagal memuat data RT: '+(e.message||e));render(window.__ADMIN_REQUESTED_PAGE||'dashboard')}};
})();
