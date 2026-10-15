/* Admin UI: pengaturan wilayah iuran. Loaded before admin.js; invoked after admin session validation. */
(function(){
  const sb=()=>window.DAWUNG_SUPABASE;
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function currentUser(){const {data,error}=await sb().auth.getUser();if(error)throw error;if(!data.user)throw new Error('Sesi login berakhir. Silakan login kembali.');return data.user;}
  async function loadData(){
    const [wr,staff,assignedW,assignedP,user]=await Promise.all([
      sb().from('iuran_wilayah').select('*').order('nama'),
      sb().from('profiles').select('id,nama,email,role').eq('role','petugas_iuran').order('nama'),
      sb().from('warga_iuran_wilayah').select('warga_id,wilayah_id'),
      sb().from('iuran_petugas_wilayah').select('petugas_id,wilayah_id,aktif'),
      currentUser()
    ]);
    for(const r of [wr,staff,assignedW,assignedP])if(r.error)throw r.error;
    return {regions:wr.data||[],staff:staff.data||[],assignW:assignedW.data||[],assignP:assignedP.data||[],user};
  }
  window.renderIuranWilayah=async function(){
    head('Pengaturan Wilayah Iuran');
    A.app.innerHTML=card('<div class="card-head"><div><b>Pengaturan Wilayah Iuran</b><small>Memuat wilayah, warga, dan penugasan petugas…</small></div></div>','wide');
    try{const d=await loadData();const warga=(A.d.warga||[]).filter(x=>String(x.status||'').toLowerCase()==='aktif');
      const assignedIds=new Set(d.assignW.map(x=>String(x.warga_id)));
      const unassigned=warga.filter(x=>!assignedIds.has(String(x.id))).length;
      const staffMap=new Map(d.assignP.filter(x=>x.aktif).map(x=>[String(x.petugas_id),String(x.wilayah_id)]));
      const regionsHtml=d.regions.map(r=>{
        const count=d.assignW.filter(x=>String(x.wilayah_id)===String(r.id)).length;
        const staffNames=d.staff.filter(p=>staffMap.get(String(p.id))===String(r.id)).map(p=>p.nama||p.email||p.id);
        return `<tr><td><b>${escHtml(r.nama)}</b><small>${escHtml(r.keterangan||'')}</small></td><td>${count} warga</td><td>${staffNames.length?staffNames.map(escHtml).join(', '):'<span class="yellow">Belum ada petugas</span>'}</td><td><span class="p ${r.aktif?'greenp':'redp'}">${r.aktif?'Aktif':'Nonaktif'}</span></td><td><div class="user-row-actions"><button type="button" data-iuran-warga="${r.id}">Atur Warga</button><button type="button" data-iuran-staff="${r.id}">Atur Petugas</button><button type="button" data-iuran-edit="${r.id}">Edit</button></div></td></tr>`;
      }).join('');
      A.app.innerHTML=`<div class="admin-kpis"><div><span>♙</span><small>Warga aktif</small><b>${warga.length}</b></div><div><span>✓</span><small>Sudah dibagi wilayah</small><b>${warga.length-unassigned}</b></div><div><span>!</span><small>Belum ditentukan</small><b>${unassigned}</b></div></div>`+
        card(`<div class="card-head"><div><b>Wilayah Penarikan</b><small>Admin menentukan wilayah warga dan petugas secara manual.</small></div><button type="button" class="green-mini" id="addIuranRegion">＋ Tambah Wilayah</button></div>${table(regionsHtml,['Nama Wilayah','Jumlah Warga','Petugas','Status','Aksi'])}`,'wide')+
        card(`<div class="card-head"><div><b>Petunjuk</b><small>Pengaturan ini menggunakan data warga yang sudah tersimpan di Supabase.</small></div></div><p>1. Tambahkan wilayah. 2. Pilih warga yang masuk wilayah tersebut. 3. Tetapkan akun dengan role <b>Petugas Iuran</b>. Setiap warga hanya memiliki satu wilayah aktif.</p><p>Warga yang belum ditentukan: <b>${unassigned}</b>. Petugas yang belum ditugaskan tidak dapat membuka daftar warga.</p>`,'wide');
      document.querySelector('#addIuranRegion').onclick=()=>regionModal(null);
      document.querySelectorAll('[data-iuran-warga]').forEach(b=>b.onclick=()=>assignWargaModal(b.dataset.iuranWarga));
      document.querySelectorAll('[data-iuran-staff]').forEach(b=>b.onclick=()=>assignStaffModal(b.dataset.iuranStaff));
      document.querySelectorAll('[data-iuran-edit]').forEach(b=>b.onclick=()=>regionModal(d.regions.find(r=>String(r.id)===b.dataset.iuranEdit)));
    }catch(e){console.error('[Wilayah iuran]',e);A.app.innerHTML=card(`<div class="card-head"><div><b>Pengaturan Wilayah Iuran</b><small>Gagal memuat data.</small></div></div><p>${escHtml(e.message||e)}</p><p>Pastikan SQL 05 dan 06 sudah dijalankan di Supabase, lalu muat ulang halaman.</p><button type="button" class="green-mini" id="retryIuranRegions">Coba Lagi</button>`,'wide');document.querySelector('#retryIuranRegions')?.addEventListener('click',()=>window.renderIuranWilayah());}
  };
  function regionModal(existing){
    modal(existing?'Edit Wilayah Iuran':'Tambah Wilayah Iuran',`<label>Nama wilayah<input id="iuranRegionName" maxlength="80" required value="${escHtml(existing?.nama||'')}" placeholder="Contoh: Wilayah A"></label><label>Keterangan (opsional)<textarea id="iuranRegionDesc" maxlength="250" rows="3" placeholder="Batas wilayah atau catatan">${escHtml(existing?.keterangan||'')}</textarea></label><label>Status<select id="iuranRegionActive"><option value="true" ${existing?.aktif!==false?'selected':''}>Aktif</option><option value="false" ${existing?.aktif===false?'selected':''}>Nonaktif</option></select></label>`,async()=>{
      const nama=document.querySelector('#iuranRegionName').value.trim(),keterangan=document.querySelector('#iuranRegionDesc').value.trim()||null,aktif=document.querySelector('#iuranRegionActive').value==='true';if(!nama){toast('Nama wilayah wajib diisi.');return;}
      const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
      try{const user=await currentUser();const payload={nama,keterangan,aktif};let res=existing?await sb().from('iuran_wilayah').update(payload).eq('id',existing.id):await sb().from('iuran_wilayah').insert({...payload,dibuat_oleh:user.id});if(res.error)throw res.error;closeModal();toast(existing?'Wilayah berhasil diperbarui.':'Wilayah berhasil ditambahkan.');await window.renderIuranWilayah();}
      catch(e){toast('Gagal menyimpan wilayah: '+(e.message||e));}finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Simpan';}}
    });
  }
  async function assignWargaModal(regionId){
    try{const d=await loadData(),region=d.regions.find(r=>String(r.id)===String(regionId));if(!region)throw new Error('Wilayah tidak ditemukan.');
      const warga=(A.d.warga||[]).filter(x=>String(x.status||'').toLowerCase()==='aktif');const assignment=new Map(d.assignW.map(x=>[String(x.warga_id),String(x.wilayah_id)]));
      const rows=warga.map(w=>{const current=assignment.get(String(w.id));const checked=current===String(regionId);const elsewhere=current&&current!==String(regionId);return `<label class="iuran-check-row"><input type="checkbox" name="iuranWargaPick" value="${escHtml(w.id)}" ${checked?'checked':''}><span><b>${escHtml(w.nama)}</b><small>${escHtml(w.alamat||'Alamat belum diisi')}${elsewhere?' · Saat ini di wilayah lain':''}</small></span></label>`;}).join('');
      modal('Atur Warga — '+region.nama,`<p>Pilih warga untuk wilayah ini. Jika warga yang dipilih saat ini berada di wilayah lain, penugasannya akan dipindahkan.</p><label>Cari warga<input id="iuranWargaSearch" placeholder="Ketik nama atau alamat"></label><div class="iuran-check-list" id="iuranWargaList">${rows||'<p>Belum ada warga aktif.</p>'}</div>`,async()=>{
        const selected=[...document.querySelectorAll('input[name="iuranWargaPick"]:checked')].map(x=>x.value);const currentHere=d.assignW.filter(x=>String(x.wilayah_id)===String(regionId)).map(x=>String(x.warga_id));const remove=currentHere.filter(id=>!selected.includes(id));const user=await currentUser();const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
        try{if(selected.length){const payload=selected.map(warga_id=>({warga_id,wilayah_id:regionId,diperbarui_oleh:user.id}));const res=await sb().from('warga_iuran_wilayah').upsert(payload,{onConflict:'warga_id'});if(res.error)throw res.error;}if(remove.length){const res=await sb().from('warga_iuran_wilayah').delete().eq('wilayah_id',regionId).in('warga_id',remove);if(res.error)throw res.error;}closeModal();toast('Pembagian warga berhasil disimpan.');await window.renderIuranWilayah();}
        catch(e){toast('Gagal menyimpan pembagian warga: '+(e.message||e));}finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Simpan';}}
      });
      const search=document.querySelector('#iuranWargaSearch');search?.addEventListener('input',()=>{const q=search.value.toLowerCase();document.querySelectorAll('#iuranWargaList .iuran-check-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));});
    }catch(e){toast('Gagal membuka daftar warga: '+(e.message||e));}
  }
  async function assignStaffModal(regionId){
    try{const d=await loadData(),region=d.regions.find(r=>String(r.id)===String(regionId));if(!region)throw new Error('Wilayah tidak ditemukan.');
      const assigned=new Map(d.assignP.filter(x=>x.aktif).map(x=>[String(x.petugas_id),String(x.wilayah_id)]));
      const rows=d.staff.map(p=>{const current=assigned.get(String(p.id));const checked=current===String(regionId);const elsewhere=current&&current!==String(regionId);return `<label class="iuran-check-row"><input type="checkbox" name="iuranPetugasPick" value="${escHtml(p.id)}" ${checked?'checked':''}><span><b>${escHtml(p.nama||'Tanpa nama')}</b><small>${escHtml(p.email||'')}${elsewhere?' · Saat ini di wilayah lain':''}</small></span></label>`;}).join('');
      modal('Atur Petugas — '+region.nama,`<p>Pilih akun dengan role <b>Petugas Iuran</b>. Setiap petugas hanya dapat memiliki satu wilayah aktif. Memilih petugas dari wilayah lain akan memindahkan penugasannya.</p><div class="iuran-check-list">${rows||'<p>Belum ada akun dengan role Petugas Iuran. Buat akun di Supabase Authentication, lalu ubah role melalui menu Pengguna & Admin.</p>'}</div>`,async()=>{
        const selected=[...document.querySelectorAll('input[name="iuranPetugasPick"]:checked')].map(x=>x.value);const currentHere=d.assignP.filter(x=>String(x.wilayah_id)===String(regionId)).map(x=>String(x.petugas_id));const remove=currentHere.filter(id=>!selected.includes(id));const user=await currentUser();const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
        try{if(selected.length){const payload=selected.map(petugas_id=>({petugas_id,wilayah_id:regionId,aktif:true,ditetapkan_oleh:user.id}));const res=await sb().from('iuran_petugas_wilayah').upsert(payload,{onConflict:'petugas_id'});if(res.error)throw res.error;}if(remove.length){const res=await sb().from('iuran_petugas_wilayah').delete().eq('wilayah_id',regionId).in('petugas_id',remove);if(res.error)throw res.error;}closeModal();toast('Penugasan petugas berhasil disimpan.');await window.renderIuranWilayah();}
        catch(e){toast('Gagal menyimpan petugas: '+(e.message||e));}finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Simpan';}}
      });
    }catch(e){toast('Gagal membuka daftar petugas: '+(e.message||e));}
  }
})();
