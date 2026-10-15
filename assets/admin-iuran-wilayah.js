/* Admin UI: wilayah, petugas, and household collection boxes for voluntary dues. */
(function(){
  const sb=()=>window.DAWUNG_SUPABASE;
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function currentUser(){const {data,error}=await sb().auth.getUser();if(error)throw error;if(!data.user)throw new Error('Sesi login berakhir. Silakan login kembali.');return data.user;}
  async function loadData(){
    const [wr,staff,assignedW,assignedP,houseRes,houseKkRes,user]=await Promise.all([
      sb().from('iuran_wilayah').select('*').order('nama'),
      sb().from('profiles').select('id,nama,email,role').eq('role','petugas_iuran').order('nama'),
      sb().from('warga_iuran_wilayah').select('warga_id,wilayah_id'),
      sb().from('iuran_petugas_wilayah').select('petugas_id,wilayah_id,aktif'),
      sb().from('iuran_rumah').select('*').order('kode_rumah'),
      sb().from('iuran_rumah_kk').select('kk_id,rumah_id'),
      currentUser()
    ]);
    for(const r of [wr,staff,assignedW,assignedP,houseRes,houseKkRes])if(r.error)throw r.error;
    return {regions:wr.data||[],staff:staff.data||[],assignW:assignedW.data||[],assignP:assignedP.data||[],houses:houseRes.data||[],houseKks:houseKkRes.data||[],kks:window.__DAWUNG_KK||A.d.kk||[],user};
  }
  window.renderIuranWilayah=async function(){
    head('Pengaturan Wilayah Iuran');
    A.app.innerHTML=card('<div class="card-head"><div><b>Pengaturan Wilayah Iuran</b><small>Memuat wilayah, petugas, rumah, dan kotak iuran…</small></div></div>','wide');
    try{
      const d=await loadData();
      const warga=(A.d.warga||[]).filter(x=>String(x.status||'').toLowerCase()==='aktif');
      const assignedIds=new Set(d.assignW.map(x=>String(x.warga_id)));
      const unassigned=warga.filter(x=>!assignedIds.has(String(x.id))).length;
      const staffMap=new Map(d.assignP.filter(x=>x.aktif).map(x=>[String(x.petugas_id),String(x.wilayah_id)]));
      const kkById=new Map(d.kks.map(k=>[String(k.id),k]));
      const rumahKkCount=new Map();d.houseKks.forEach(x=>rumahKkCount.set(String(x.rumah_id),(rumahKkCount.get(String(x.rumah_id))||0)+1));
      const regionRows=d.regions.map(r=>{
        const count=d.assignW.filter(x=>String(x.wilayah_id)===String(r.id)).length;
        const houses=d.houses.filter(x=>String(x.wilayah_id)===String(r.id));
        const staffNames=d.staff.filter(p=>staffMap.get(String(p.id))===String(r.id)).map(p=>p.nama||p.email||p.id);
        return `<tr><td><b>${escHtml(r.nama)}</b><small>${escHtml(r.keterangan||'')}</small></td><td>${count} warga</td><td><b>${houses.length} rumah</b></td><td>${staffNames.length?staffNames.map(escHtml).join(', '):'<span class="yellow">Belum ada petugas</span>'}</td><td><span class="p ${r.aktif?'greenp':'redp'}">${r.aktif?'Aktif':'Nonaktif'}</span></td><td><div class="user-row-actions"><button type="button" data-iuran-warga="${r.id}">Atur Warga</button><button type="button" data-iuran-staff="${r.id}">Atur Petugas</button><button type="button" data-iuran-new-house="${r.id}">＋ Rumah</button><button type="button" data-iuran-edit="${r.id}">Edit</button></div></td></tr>`;
      }).join('');
      const houseRows=d.houses.map(h=>{
        const region=d.regions.find(r=>String(r.id)===String(h.wilayah_id));
        const kkCount=rumahKkCount.get(String(h.id))||0;
        const linked=d.houseKks.filter(x=>String(x.rumah_id)===String(h.id)).map(x=>kkById.get(String(x.kk_id))).filter(Boolean);
        const summary=linked.slice(0,3).map(k=>k.kepala_keluarga||k.no_kk).join(', ')+(linked.length>3?` +${linked.length-3}`:'');
        return `<tr><td><b>${escHtml(h.kode_rumah)}</b><small>${escHtml(h.nama_rumah)}</small></td><td>${escHtml(h.alamat)}</td><td>${escHtml(region?.nama||'Wilayah tidak ditemukan')}</td><td><b>${kkCount} KK</b><small>${escHtml(summary||'Belum ditautkan ke KK')}</small></td><td><span class="p ${h.aktif?'greenp':'redp'}">${h.aktif?'Aktif':'Nonaktif'}</span></td><td><div class="user-row-actions"><button type="button" data-house-edit="${h.id}">Edit / Atur KK</button><button type="button" data-house-toggle="${h.id}">${h.aktif?'Nonaktifkan':'Aktifkan'}</button></div></td></tr>`;
      }).join('');
      A.app.innerHTML=`<div class="admin-kpis"><div><span>♙</span><small>Warga aktif</small><b>${warga.length}</b></div><div><span>✓</span><small>Warga sudah dibagi wilayah</small><b>${warga.length-unassigned}</b></div><div><span>⌂</span><small>Rumah/kotak terdaftar</small><b>${d.houses.length}</b></div><div><span>!</span><small>Belum dibagi wilayah (warga)</small><b>${unassigned}</b></div></div>`+
        card(`<div class="card-head"><div><b>Wilayah Penarikan</b><small>Wilayah mengelompokkan petugas serta rumah/kotak iuran.</small></div><button type="button" class="green-mini" id="addIuranRegion">＋ Tambah Wilayah</button></div>${table(regionRows,['Nama Wilayah','Warga lama','Rumah/Kotak','Petugas','Status','Aksi'])}`,'wide')+
        card(`<div class="card-head"><div><b>Rumah / Kotak Iuran</b><small>Satu rumah/kotak = satu riwayat setoran gabungan, meskipun di dalamnya ada beberapa KK.</small></div><button type="button" class="green-mini" id="addIuranHouse">＋ Tambah Rumah/Kotak</button></div>${table(houseRows,['Kode / Nama Rumah','Alamat','Wilayah','KK Tertaut','Status','Aksi'])}<p class="muted" style="margin-top:12px">Pilih satu atau beberapa KK yang tinggal di rumah yang menggunakan kotak iuran yang sama. Transaksi baru akan dicatat atas rumah/kotak, bukan nama orang yang menyerahkan uang.</p>`,'wide')+
        card(`<div class="card-head"><div><b>Petunjuk Pengaturan</b><small>Gunakan data warga dan KK yang sudah tersimpan.</small></div></div><p>1. Tambahkan wilayah. 2. Tetapkan petugas pada wilayah. 3. Tambahkan rumah/kotak, pilih wilayah, lalu tautkan semua KK yang berbagi kotak tersebut.</p><p>Penugasan warga lama tetap dipertahankan untuk menjaga riwayat transaksi lama. Aplikasi petugas baru akan menggunakan daftar Rumah/Kotak Iuran.</p>`,'wide');
      document.querySelector('#addIuranRegion').onclick=()=>regionModal(null);
      document.querySelector('#addIuranHouse').onclick=()=>houseModal(null,null);
      document.querySelectorAll('[data-iuran-warga]').forEach(b=>b.onclick=()=>assignWargaModal(b.dataset.iuranWarga));
      document.querySelectorAll('[data-iuran-staff]').forEach(b=>b.onclick=()=>assignStaffModal(b.dataset.iuranStaff));
      document.querySelectorAll('[data-iuran-new-house]').forEach(b=>b.onclick=()=>houseModal(null,b.dataset.iuranNewHouse));
      document.querySelectorAll('[data-iuran-edit]').forEach(b=>b.onclick=()=>regionModal(d.regions.find(r=>String(r.id)===b.dataset.iuranEdit)));
      document.querySelectorAll('[data-house-edit]').forEach(b=>b.onclick=()=>houseModal(d.houses.find(h=>String(h.id)===b.dataset.houseEdit),null));
      document.querySelectorAll('[data-house-toggle]').forEach(b=>b.onclick=()=>toggleHouse(d.houses.find(h=>String(h.id)===b.dataset.houseToggle)));
    }catch(e){console.error('[Wilayah iuran]',e);A.app.innerHTML=card(`<div class="card-head"><div><b>Pengaturan Wilayah Iuran</b><small>Gagal memuat data.</small></div></div><p>${escHtml(e.message||e)}</p><p>Pastikan SQL 05, 06, dan 07 sudah dijalankan pada project Supabase Website RT, lalu muat ulang halaman.</p><button type="button" class="green-mini" id="retryIuranRegions">Coba Lagi</button>`,'wide');document.querySelector('#retryIuranRegions')?.addEventListener('click',()=>window.renderIuranWilayah());}
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
      modal('Atur Warga — '+region.nama,`<p>Pembagian warga ini dipertahankan untuk data/riwayat lama. Untuk transaksi baru, atur rumah/kotak di bagian Rumah / Kotak Iuran.</p><label>Cari warga<input id="iuranWargaSearch" placeholder="Ketik nama atau alamat"></label><div class="iuran-check-list" id="iuranWargaList">${rows||'<p>Belum ada warga aktif.</p>'}</div>`,async()=>{
        const selected=[...document.querySelectorAll('input[name="iuranWargaPick"]:checked')].map(x=>x.value);const currentHere=d.assignW.filter(x=>String(x.wilayah_id)===String(regionId)).map(x=>String(x.warga_id));const remove=currentHere.filter(id=>!selected.includes(id));const user=await currentUser();const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
        try{if(selected.length){const payload=selected.map(warga_id=>({warga_id,wilayah_id:regionId,diperbarui_oleh:user.id}));const res=await sb().from('warga_iuran_wilayah').upsert(payload,{onConflict:'warga_id'});if(res.error)throw res.error;}if(remove.length){const res=await sb().from('warga_iuran_wilayah').delete().eq('wilayah_id',regionId).in('warga_id',remove);if(res.error)throw res.error;}closeModal();toast('Pembagian warga lama berhasil diperbarui.');await window.renderIuranWilayah();}
        catch(e){toast('Gagal menyimpan pembagian warga: '+(e.message||e));}finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Simpan';}}
      });
      const search=document.querySelector('#iuranWargaSearch');search?.addEventListener('input',()=>{const q=search.value.toLowerCase();document.querySelectorAll('#iuranWargaList .iuran-check-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));});
    }catch(e){toast('Gagal membuka daftar warga: '+(e.message||e));}
  }
  async function assignStaffModal(regionId){
    try{const d=await loadData(),region=d.regions.find(r=>String(r.id)===String(regionId));if(!region)throw new Error('Wilayah tidak ditemukan.');
      const assigned=new Map(d.assignP.filter(x=>x.aktif).map(x=>[String(x.petugas_id),String(x.wilayah_id)]));
      const rows=d.staff.map(p=>{const current=assigned.get(String(p.id));const checked=current===String(regionId);const elsewhere=current&&current!==String(regionId);return `<label class="iuran-check-row"><input type="checkbox" name="iuranPetugasPick" value="${escHtml(p.id)}" ${checked?'checked':''}><span><b>${escHtml(p.nama||'Tanpa nama')}</b><small>${escHtml(p.email||'')}${elsewhere?' · Saat ini di wilayah lain':''}</small></span></label>`;}).join('');
      modal('Atur Petugas — '+region.nama,`<p>Pilih akun dengan role <b>Petugas Iuran</b>. Setiap petugas hanya dapat memiliki satu wilayah aktif. Memilih petugas dari wilayah lain akan memindahkan penugasannya.</p><div class="iuran-check-list">${rows||'<p>Belum ada akun dengan role Petugas Iuran. Buat akun melalui Supabase Authentication, lalu ubah role melalui Pengguna & Admin.</p>'}</div>`,async()=>{
        const selected=[...document.querySelectorAll('input[name="iuranPetugasPick"]:checked')].map(x=>x.value);const currentHere=d.assignP.filter(x=>String(x.wilayah_id)===String(regionId)).map(x=>String(x.petugas_id));const remove=currentHere.filter(id=>!selected.includes(id));const user=await currentUser();const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
        try{if(selected.length){const payload=selected.map(petugas_id=>({petugas_id,wilayah_id:regionId,aktif:true,ditetapkan_oleh:user.id}));const res=await sb().from('iuran_petugas_wilayah').upsert(payload,{onConflict:'petugas_id'});if(res.error)throw res.error;}if(remove.length){const res=await sb().from('iuran_petugas_wilayah').delete().eq('wilayah_id',regionId).in('petugas_id',remove);if(res.error)throw res.error;}closeModal();toast('Penugasan petugas berhasil disimpan.');await window.renderIuranWilayah();}
        catch(e){toast('Gagal menyimpan petugas: '+(e.message||e));}finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Simpan';}}
      });
    }catch(e){toast('Gagal membuka daftar petugas: '+(e.message||e));}
  }
  async function houseModal(existing,defaultRegionId){
    try{
      const d=await loadData();
      if(!d.regions.length)throw new Error('Buat wilayah terlebih dahulu sebelum menambah rumah/kotak.');
      const kks=d.kks||[];const ownLinks=d.houseKks.filter(x=>String(x.rumah_id)===String(existing?.id));
      const currentByKk=new Map(d.houseKks.map(x=>[String(x.kk_id),String(x.rumah_id)]));
      const houseById=new Map(d.houses.map(h=>[String(h.id),h]));
      const selectedKkIds=new Set(ownLinks.map(x=>String(x.kk_id)));
      const kkRows=kks.map(k=>{
        const currentHomeId=currentByKk.get(String(k.id));const currentHouse=currentHomeId?houseById.get(currentHomeId):null;
        const checked=selectedKkIds.has(String(k.id));const elsewhere=currentHomeId&&currentHomeId!==String(existing?.id);
        return `<label class="iuran-check-row"><input type="checkbox" name="iuranHouseKkPick" value="${escHtml(k.id)}" ${checked?'checked':''}><span><b>${escHtml(k.kepala_keluarga||'Kepala keluarga belum diisi')}</b><small>No. KK: ${escHtml(k.no_kk||'—')} · ${escHtml(k.alamat||'Alamat belum diisi')}${elsewhere?' · Saat ini tertaut ke '+escHtml(currentHouse?.kode_rumah||currentHouse?.nama_rumah||'rumah lain'):''}</small></span></label>`;
      }).join('');
      const regionOptions=d.regions.map(r=>`<option value="${escHtml(r.id)}" ${String(existing?.wilayah_id||defaultRegionId||'')===String(r.id)?'selected':''}>${escHtml(r.nama)}${r.aktif?'':' (Nonaktif)'}</option>`).join('');
      const body=`<p>Satu rumah/kotak dapat menampung beberapa KK. Semua KK yang dipilih akan melihat konsep riwayat gabungan pada tahap kartu iuran warga.</p><label>Nama/label rumah<input id="iuranHouseName" maxlength="120" required value="${escHtml(existing?.nama_rumah||'')}" placeholder="Contoh: Rumah Pak Andi"></label><label>Alamat rumah<input id="iuranHouseAddress" maxlength="250" required value="${escHtml(existing?.alamat||'Dusun Dawung')}" placeholder="Alamat atau penanda rumah"></label><label>Wilayah penarikan<select id="iuranHouseRegion" required>${regionOptions}</select></label><label>Catatan (opsional)<textarea id="iuranHouseNote" maxlength="300" rows="2" placeholder="Petunjuk lokasi atau catatan">${escHtml(existing?.catatan||'')}</textarea></label><label>Status<select id="iuranHouseActive"><option value="true" ${existing?.aktif!==false?'selected':''}>Aktif</option><option value="false" ${existing?.aktif===false?'selected':''}>Nonaktif</option></select></label><div style="margin-top:16px"><b>Tautkan Kartu Keluarga</b><p class="muted">Pilih semua KK yang berbagi kotak iuran ini. KK yang sedang terhubung ke rumah lain akan dipindahkan bila dicentang.</p><label>Cari KK<input id="iuranHouseKkSearch" placeholder="Cari kepala keluarga, No. KK, atau alamat"></label><div class="iuran-check-list" id="iuranHouseKkList">${kkRows||'<p>Belum ada data Kartu Keluarga. Tambahkan data KK terlebih dahulu, atau simpan rumah untuk melengkapi tautan nanti.</p>'}</div></div>`;
      modal(existing?'Edit Rumah / Kotak Iuran':'Tambah Rumah / Kotak Iuran',body,async()=>{
        const nama_rumah=document.querySelector('#iuranHouseName').value.trim();const alamat=document.querySelector('#iuranHouseAddress').value.trim();const wilayah_id=document.querySelector('#iuranHouseRegion').value;const catatan=document.querySelector('#iuranHouseNote').value.trim()||null;const aktif=document.querySelector('#iuranHouseActive').value==='true';
        if(!nama_rumah||!alamat||!wilayah_id){toast('Nama rumah, alamat, dan wilayah wajib diisi.');return;}
        const selected=[...document.querySelectorAll('input[name="iuranHouseKkPick"]:checked')].map(x=>x.value);
        const moving=selected.filter(id=>{const prev=currentByKk.get(String(id));return prev&&prev!==String(existing?.id)});
        if(moving.length&&!window.confirm(`${moving.length} KK sudah ditautkan ke rumah/kotak lain. Jika diteruskan, KK tersebut akan dipindahkan ke rumah ini. Lanjutkan?`))return;
        const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
        try{
          const user=await currentUser();const payload={nama_rumah,alamat,wilayah_id,catatan,aktif};
          let result;
          if(existing)result=await sb().from('iuran_rumah').update(payload).eq('id',existing.id).select('*').single();
          else result=await sb().from('iuran_rumah').insert({...payload,dibuat_oleh:user.id}).select('*').single();
          if(result.error)throw result.error;const house=result.data;
          const currentHouseKks=d.houseKks.filter(x=>String(x.rumah_id)===String(house.id)).map(x=>String(x.kk_id));const remove=currentHouseKks.filter(id=>!selected.includes(id));
          if(remove.length){const res=await sb().from('iuran_rumah_kk').delete().eq('rumah_id',house.id).in('kk_id',remove);if(res.error)throw new Error('Rumah tersimpan, tetapi pelepasan tautan KK gagal: '+res.error.message);}
          if(selected.length){const relation=selected.map(kk_id=>({kk_id,rumah_id:house.id,ditetapkan_oleh:user.id}));const res=await sb().from('iuran_rumah_kk').upsert(relation,{onConflict:'kk_id'});if(res.error)throw new Error('Rumah tersimpan, tetapi penautan KK gagal: '+res.error.message);}
          closeModal();toast(existing?'Rumah/kotak berhasil diperbarui.':'Rumah/kotak berhasil ditambahkan.');await window.renderIuranWilayah();
        }catch(e){toast('Gagal menyimpan rumah/kotak: '+(e.message||e));}
        finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Simpan';}}
      });
      document.querySelector('#iuranHouseKkSearch')?.addEventListener('input',()=>{const q=document.querySelector('#iuranHouseKkSearch').value.toLocaleLowerCase('id-ID');document.querySelectorAll('#iuranHouseKkList .iuran-check-row').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('id-ID').includes(q));});
    }catch(e){toast('Gagal membuka form rumah/kotak: '+(e.message||e));}
  }
  async function toggleHouse(house){if(!house)return;try{const {error}=await sb().from('iuran_rumah').update({aktif:!house.aktif}).eq('id',house.id);if(error)throw error;toast(house.aktif?'Rumah/kotak dinonaktifkan.':'Rumah/kotak diaktifkan.');await window.renderIuranWilayah();}catch(e){toast('Gagal mengubah status rumah: '+(e.message||e));}}
})();
