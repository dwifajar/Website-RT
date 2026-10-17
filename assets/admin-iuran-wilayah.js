/* Admin UI: wilayah, petugas, and household collection boxes for voluntary dues. */
(function(){
  const ADMIN_IURAN_SCRIPT_URL=document.currentScript?.src||Array.from(document.scripts).find(s=>/admin-iuran-wilayah\.js(?:[?#]|$)/.test(s.src))?.src||window.location.href;
  const sb=()=>window.DAWUNG_SUPABASE;
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function currentUser(){const {data,error}=await sb().auth.getUser();if(error)throw error;if(!data.user)throw new Error('Sesi login berakhir. Silakan login kembali.');return data.user;}
  async function loadData(){
    const [wr,staff,assignedW,assignedP,houseRes,houseKkRes,wargaRes,user,cardRes]=await Promise.all([
      sb().from('iuran_wilayah').select('*').order('nama'),
      sb().from('profiles').select('id,nama,email,role').eq('role','petugas_iuran').order('nama'),
      sb().from('warga_iuran_wilayah').select('warga_id,wilayah_id'),
      sb().from('iuran_petugas_wilayah').select('petugas_id,wilayah_id,aktif'),
      sb().from('iuran_rumah').select('*').order('kode_rumah'),
      sb().from('iuran_rumah_kk').select('kk_id,rumah_id'),
      sb().from('warga').select('id,nama,alamat,status,nik,no_kk').order('nama'),
      currentUser(),
      sb().rpc('admin_list_iuran_kartu')
    ]);
    for(const r of [wr,staff,assignedW,assignedP,houseRes,houseKkRes,wargaRes])if(r.error)throw r.error;
    if(cardRes.error)console.warn('[Kartu iuran] Status kartu belum tersedia; jalankan migrasi 08.',cardRes.error.message);
    return {regions:wr.data||[],staff:staff.data||[],assignW:assignedW.data||[],assignP:assignedP.data||[],houses:houseRes.data||[],houseKks:houseKkRes.data||[],warga:wargaRes.data||[],cards:cardRes.error?[]:(cardRes.data||[]),kks:window.__DAWUNG_KK||A.d.kk||[],user};
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
      const cardByHouse=new Map((d.cards||[]).map(x=>[String(x.rumah_id),x]));
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
        const visibleNames=linked.slice(0,2).map(k=>k.kepala_keluarga||k.no_kk).filter(Boolean);
        const summary=visibleNames.join(' · ')+(linked.length>2?` +${linked.length-2} lainnya`:'');
        const card=cardByHouse.get(String(h.id));
        return `<tr><td><div class="iuran-house-name-cell"><b>${escHtml(h.kode_rumah)}</b><span>${escHtml(h.nama_rumah)}</span><small class="iuran-card-status ${card?.akses_aktif?'is-issued':''}">${card?.akses_aktif?'Kartu digital aktif':'Kartu digital belum dibuat'}</small></div></td><td><div class="iuran-house-address-cell">${escHtml(h.alamat||'Alamat belum diisi')}</div></td><td><span class="iuran-region-chip">${escHtml(region?.nama||'Wilayah tidak ditemukan')}</span></td><td><div class="iuran-kk-summary"><b>${kkCount} KK tertaut</b><small>${escHtml(summary||'Belum ditautkan ke KK')}</small></div></td><td><span class="p ${h.aktif?'greenp':'redp'}">${h.aktif?'Aktif':'Nonaktif'}</span></td><td><div class="iuran-house-actions"><button type="button" class="iuran-house-edit" data-house-edit="${h.id}">Edit / Atur KK</button>${card?.akses_aktif?`<button type="button" class="iuran-house-reprint-action" data-house-reprint="${h.id}">Cetak Ulang</button><button type="button" class="iuran-house-card-action" data-house-card="${h.id}">Reset Kartu</button>`:`<button type="button" class="iuran-house-card-action" data-house-card="${h.id}">Buat Kartu</button>`}<button type="button" class="iuran-house-toggle" data-house-toggle="${h.id}">${h.aktif?'Nonaktifkan':'Aktifkan'}</button></div></td></tr>`;
      }).join('');
      const houseTable=`<div class="table-scroll iuran-house-table-scroll"><table class="wide-table iuran-house-table"><colgroup><col style="width:16%"><col style="width:18%"><col style="width:11%"><col style="width:19%"><col style="width:8%"><col style="width:28%"></colgroup><thead><tr><th>Rumah / Kotak</th><th>Alamat</th><th>Wilayah</th><th>KK Tertaut</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${houseRows||`<tr class="iuran-house-empty-row"><td colspan="6"><div class="iuran-house-empty-state"><span class="iuran-house-empty-icon">⌂</span><div><b>Belum ada rumah atau kotak iuran</b><p>Daftarkan rumah terlebih dahulu. Setelah itu, pilih wilayah dan tautkan satu atau beberapa KK yang menggunakan kotak iuran bersama.</p></div></div></td></tr>`}</tbody></table></div><div class="iuran-house-table-note"><span class="iuran-house-note-icon">i</span><p><b>Catatan pencatatan</b><br>Setiap transaksi akan dicatat atas rumah/kotak iuran. Orang yang menyerahkan uang boleh berbeda, tetapi seluruh setoran tetap masuk ke riwayat rumah yang sama.</p></div>`;
      const wargaAssignment=new Map(d.assignW.map(x=>[String(x.warga_id),String(x.wilayah_id)]));
      const wargaRegionFilterOptions=d.regions.map(r=>`<option value="${escHtml(r.id)}">${escHtml(r.nama)}</option>`).join('');
      const wargaFilterCard=`<div class="card-head"><div><b>Filter Warga per Wilayah</b><small>Temukan warga yang belum ditugaskan atau periksa daftar warga di setiap wilayah.</small></div><span class="p yellow">Pengecekan wilayah</span></div>
        <div class="iuran-warga-filter-controls" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0">
          <label>Filter wilayah<select id="iuranWargaRegionFilter" style="width:100%;margin-top:6px;padding:10px;border:1px solid var(--line,#d9deea);border-radius:10px;background:var(--card,#fff);color:inherit"><option value="all">Semua warga</option><option value="unassigned">Belum masuk wilayah</option>${wargaRegionFilterOptions}</select></label>
          <label>Cari nama atau alamat warga<input id="iuranWargaRegionSearch" type="search" placeholder="Ketik nama atau alamat…" style="width:100%;margin-top:6px;padding:10px;border:1px solid var(--line,#d9deea);border-radius:10px;background:var(--card,#fff);color:inherit"></label>
        </div>
        <div class="table-scroll"><table class="wide-table"><thead><tr><th>Nama Warga</th><th>Alamat</th><th>Wilayah Iuran</th><th>Status Penempatan</th></tr></thead><tbody id="iuranWargaRegionRows"></tbody></table></div>`;
      A.app.innerHTML=`<div class="admin-kpis"><div><span>♙</span><small>Warga aktif</small><b>${warga.length}</b></div><div><span>✓</span><small>Warga sudah dibagi wilayah</small><b>${warga.length-unassigned}</b></div><div><span>⌂</span><small>Rumah/kotak terdaftar</small><b>${d.houses.length}</b></div><div><span>!</span><small>Belum dibagi wilayah (warga)</small><b>${unassigned}</b></div></div>`+
        card(wargaFilterCard,'wide iuran-warga-filter-card')+
        card(`<div class="card-head"><div><b>Wilayah Penarikan</b><small>Wilayah mengelompokkan petugas serta rumah/kotak iuran.</small></div><button type="button" class="green-mini" id="addIuranRegion">＋ Tambah Wilayah</button></div>${table(regionRows,['Nama Wilayah','Warga lama','Rumah/Kotak','Petugas','Status','Aksi'])}`,'wide')+
        card(`<div class="card-head iuran-house-card-head"><div><b>Rumah / Kotak Iuran</b><small>Satu rumah/kotak memiliki satu riwayat setoran gabungan, walaupun penghuninya terdiri dari beberapa KK.</small></div><button type="button" class="green-mini" id="addIuranHouse">＋ Tambah Rumah/Kotak</button></div>${houseTable}`,'wide iuran-house-card')+
        card(`<div class="card-head"><div><b>Petunjuk Pengaturan</b><small>Ikuti langkah berikut untuk menyiapkan pencatatan iuran.</small></div></div><div class="iuran-guide-steps"><div class="iuran-guide-step"><span>1</span><div><b>Buat wilayah</b><p>Buat kelompok wilayah sesuai pembagian di lingkungan RT.</p></div></div><div class="iuran-guide-step"><span>2</span><div><b>Tetapkan petugas</b><p>Pilih petugas yang bertanggung jawab pada setiap wilayah.</p></div></div><div class="iuran-guide-step"><span>3</span><div><b>Daftarkan rumah</b><p>Tambah rumah/kotak, pilih wilayah, lalu tautkan semua KK yang berbagi kotak tersebut.</p></div></div></div><div class="iuran-guide-footnote">Penugasan warga lama tetap disimpan untuk menjaga riwayat transaksi sebelumnya. Aplikasi petugas menggunakan daftar Rumah/Kotak Iuran.</div>`,'wide iuran-guide-card');
      document.querySelector('#addIuranRegion').onclick=()=>regionModal(null);
      document.querySelector('#addIuranHouse').onclick=()=>houseModal(null,null);
      const renderWargaRegionFilter=()=>{
        const filter=document.querySelector('#iuranWargaRegionFilter')?.value||'all';
        const q=(document.querySelector('#iuranWargaRegionSearch')?.value||'').trim().toLocaleLowerCase('id-ID');
        const filtered=warga.filter(w=>{
          const regionId=wargaAssignment.get(String(w.id));
          const matchesRegion=filter==='all'||(filter==='unassigned'?!regionId:String(regionId)===String(filter));
          const matchesQuery=!q||`${w.nama||''} ${w.alamat||''} ${w.nik||''}`.toLocaleLowerCase('id-ID').includes(q);
          return matchesRegion&&matchesQuery;
        });
        const tbody=document.querySelector('#iuranWargaRegionRows');
        if(tbody)tbody.innerHTML=filtered.map(w=>{
          const regionId=wargaAssignment.get(String(w.id));
          const region=d.regions.find(r=>String(r.id)===String(regionId));
          return `<tr><td><b>${escHtml(w.nama||'Tanpa nama')}</b></td><td>${escHtml(w.alamat||'Alamat belum diisi')}</td><td>${escHtml(region?.nama||'—')}</td><td><span class="p ${region?'greenp':'yellow'}">${region?'Sudah ditugaskan':'Belum masuk wilayah'}</span></td></tr>`;
        }).join('')||`<tr><td colspan="4" style="text-align:center;padding:22px;color:var(--muted,#687386)">${filter==='unassigned'?'Semua warga aktif sudah masuk wilayah.':'Tidak ada warga yang cocok dengan filter.'}</td></tr>`;
      };
      document.querySelector('#iuranWargaRegionFilter')?.addEventListener('change',renderWargaRegionFilter);
      document.querySelector('#iuranWargaRegionSearch')?.addEventListener('input',renderWargaRegionFilter);
      renderWargaRegionFilter();
      document.querySelectorAll('[data-iuran-warga]').forEach(b=>b.onclick=()=>assignWargaModal(b.dataset.iuranWarga));
      document.querySelectorAll('[data-iuran-staff]').forEach(b=>b.onclick=()=>assignStaffModal(b.dataset.iuranStaff));
      document.querySelectorAll('[data-iuran-new-house]').forEach(b=>b.onclick=()=>houseModal(null,b.dataset.iuranNewHouse));
      document.querySelectorAll('[data-iuran-edit]').forEach(b=>b.onclick=()=>regionModal(d.regions.find(r=>String(r.id)===b.dataset.iuranEdit)));
      document.querySelectorAll('[data-house-edit]').forEach(b=>b.onclick=()=>houseModal(d.houses.find(h=>String(h.id)===b.dataset.houseEdit),null));
      document.querySelectorAll('[data-house-toggle]').forEach(b=>b.onclick=()=>toggleHouse(d.houses.find(h=>String(h.id)===b.dataset.houseToggle)));
      document.querySelectorAll('[data-house-card]').forEach(b=>b.onclick=()=>issueHouseCard(d.houses.find(h=>String(h.id)===b.dataset.houseCard),cardByHouse.get(String(b.dataset.houseCard))));
      document.querySelectorAll('[data-house-reprint]').forEach(b=>b.onclick=()=>reprintHouseCard(d.houses.find(h=>String(h.id)===b.dataset.houseReprint)));
    }catch(e){console.error('[Wilayah iuran]',e);A.app.innerHTML=card(`<div class="card-head"><div><b>Pengaturan Wilayah Iuran</b><small>Gagal memuat data.</small></div></div><p>${escHtml(e.message||e)}</p><p>Pastikan SQL 05, 06, 07, dan 08 sudah dijalankan pada project Supabase Website RT, lalu muat ulang halaman.</p><button type="button" class="green-mini" id="retryIuranRegions">Coba Lagi</button>`,'wide');document.querySelector('#retryIuranRegions')?.addEventListener('click',()=>window.renderIuranWilayah());}
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
      const kks=d.kks||[];
      const wargaList=(d.warga||[]).slice().sort((a,b)=>String(a.nama||'').localeCompare(String(b.nama||''),'id-ID'));
      const ownLinks=d.houseKks.filter(x=>String(x.rumah_id)===String(existing?.id));
      const currentByKk=new Map(d.houseKks.map(x=>[String(x.kk_id),String(x.rumah_id)]));
      const houseById=new Map(d.houses.map(h=>[String(h.id),h]));
      const selectedKkIds=new Set(ownLinks.map(x=>String(x.kk_id)));
      const kkRows=kks.map(k=>{
        const currentHomeId=currentByKk.get(String(k.id));const currentHouse=currentHomeId?houseById.get(currentHomeId):null;
        const checked=selectedKkIds.has(String(k.id));const elsewhere=currentHomeId&&currentHomeId!==String(existing?.id);
        return `<label class="iuran-check-row"><input type="checkbox" name="iuranHouseKkPick" value="${escHtml(k.id)}" ${checked?'checked':''}><span class="iuran-check-copy"><b>${escHtml(k.kepala_keluarga||'Kepala keluarga belum diisi')}</b><small>No. KK: ${escHtml(k.no_kk||'—')} · ${escHtml(k.alamat||'Alamat belum diisi')}${elsewhere?` <em>Sudah tertaut: ${escHtml(currentHouse?.kode_rumah||currentHouse?.nama_rumah||'rumah lain')}</em>`:''}</small></span></label>`;
      }).join('');
      const normName=value=>String(value||'').trim().toLocaleLowerCase('id-ID').replace(/^rumah\s+/i,'').replace(/\s+/g,' ');
      const normAddress=value=>String(value||'').trim().toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
      let selectedLabelWarga=null;
      if(existing){
        selectedLabelWarga=wargaList.find(w=>String(w.id)===String(existing.label_warga_id))||null;
        if(!selectedLabelWarga){
          const candidates=wargaList.filter(w=>normName(w.nama)===normName(existing.nama_rumah));
          const addressMatches=candidates.filter(w=>normAddress(w.alamat)===normAddress(existing.alamat));
          if(addressMatches.length===1)selectedLabelWarga=addressMatches[0];
          else if(candidates.length===1)selectedLabelWarga=candidates[0];
        }
      }
      const keepCurrentOption=existing&&!selectedLabelWarga
        ? `<option value="__keep_current__" selected>Gunakan label saat ini: ${escHtml(existing.nama_rumah||'Rumah yang sudah ada')}</option>`
        : '';
      const placeholderOption=!selectedLabelWarga&&!keepCurrentOption
        ? '<option value="" selected disabled>— Pilih nama warga dari Data Warga —</option>'
        : '';
      const wargaOptions=wargaList.map(w=>{
        const selected=selectedLabelWarga&&String(selectedLabelWarga.id)===String(w.id);
        const statusText=String(w.status||'aktif').toLowerCase()==='nonaktif'?' · Nonaktif':'';
        return `<option value="${escHtml(w.id)}" data-nama="${escHtml(w.nama||'')}" data-alamat="${escHtml(w.alamat||'')}" ${selected?'selected':''}>${escHtml(w.nama||'Tanpa nama')} — ${escHtml(w.alamat||'Alamat belum diisi')}${statusText}</option>`;
      }).join('');
      const regionOptions=d.regions.map(r=>`<option value="${escHtml(r.id)}" ${String(existing?.wilayah_id||defaultRegionId||'')===String(r.id)?'selected':''}>${escHtml(r.nama)}${r.aktif?'':' (Nonaktif)'}</option>`).join('');
      const initiallySelected=selectedKkIds.size;
      const body=`<div class="iuran-house-form"><div class="iuran-house-intro"><span class="iuran-house-intro-icon">⌂</span><div><b>Satu rumah, satu riwayat setoran</b><p>Nama utama rumah diambil dari menu Data Warga. Pilih warga yang menjadi penanda rumah; beberapa KK masih dapat menggunakan kotak iuran yang sama.</p></div></div><div class="iuran-house-fields"><label class="iuran-house-field">Nama / label rumah <em>Wajib</em><select id="iuranHouseName" required>${placeholderOption}${keepCurrentOption}${wargaOptions}</select><small>Daftar ini mengambil nama langsung dari Data Warga. Setelah memilih nama, label rumah akan dibuat otomatis.</small></label><label class="iuran-house-field">Alamat / penanda rumah <em>Wajib</em><input id="iuranHouseAddress" maxlength="250" required value="${escHtml(existing?.alamat||'Dusun Dawung')}" placeholder="Pilih nama warga untuk mengisi alamat otomatis"></label><label class="iuran-house-field">Wilayah penarikan <em>Wajib</em><select id="iuranHouseRegion" required>${regionOptions}</select></label><label class="iuran-house-field">Status rumah<select id="iuranHouseActive"><option value="true" ${existing?.aktif!==false?'selected':''}>Aktif</option><option value="false" ${existing?.aktif===false?'selected':''}>Nonaktif</option></select></label><label class="iuran-house-field iuran-field-full">Catatan lokasi <span>(opsional)</span><textarea id="iuranHouseNote" maxlength="300" rows="2" placeholder="Petunjuk lokasi agar mudah ditemukan petugas">${escHtml(existing?.catatan||'')}</textarea></label></div><section class="iuran-house-kk-section"><div class="iuran-house-section-head"><div><b>Tautkan Kartu Keluarga (opsional)</b><p>Bagian ini hanya untuk menghubungkan KK yang menggunakan kotak yang sama. Nama/label rumah tetap diambil dari Data Warga, dan rumah tetap dapat disimpan tanpa data KK.</p></div><span class="iuran-kk-total">${kks.length} KK tersedia</span></div><div class="iuran-house-kk-tools"><label class="iuran-house-search-label"><span>Cari keluarga</span><input id="iuranHouseKkSearch" placeholder="Nama kepala keluarga, No. KK, atau alamat"></label><span class="iuran-kk-selected-count" id="iuranHouseKkSelectedCount">${initiallySelected} dipilih</span></div><div class="iuran-check-list iuran-house-kk-list" id="iuranHouseKkList">${kkRows||'<div class="iuran-house-no-kk"><b>Data Kartu Keluarga belum tersedia</b><p>Tidak apa-apa. Rumah tetap bisa disimpan; penautan KK bersifat opsional dan bisa dilakukan nanti.</p></div>'}</div><div class="iuran-house-kk-footnote">Nama warga utama hanya digunakan sebagai label rumah. Tidak perlu memilih orang yang menyerahkan uang; seluruh setoran tetap dicatat atas satu rumah/kotak.</div></section></div>`;
      modal(existing?'Edit Rumah / Kotak Iuran':'Tambah Rumah / Kotak Iuran',body,async()=>{
        const selectedLabelValue=document.querySelector('#iuranHouseName').value;
        const selectedWarga=wargaList.find(w=>String(w.id)===String(selectedLabelValue));
        let nama_rumah='';
        let label_warga_id=null;
        if(selectedWarga){
          const namaWarga=String(selectedWarga.nama||'').trim();
          nama_rumah=/^rumah\s+/i.test(namaWarga)?namaWarga:`Rumah ${namaWarga}`;
          label_warga_id=selectedWarga.id;
        }else if(selectedLabelValue==='__keep_current__'&&existing){
          nama_rumah=existing.nama_rumah;
          label_warga_id=existing.label_warga_id||null;
        }
        const alamat=document.querySelector('#iuranHouseAddress').value.trim();const wilayah_id=document.querySelector('#iuranHouseRegion').value;const catatan=document.querySelector('#iuranHouseNote').value.trim()||null;const aktif=document.querySelector('#iuranHouseActive').value==='true';
        if(!nama_rumah||!alamat||!wilayah_id){toast('Pilih nama warga dari Data Warga, pastikan alamat terisi, dan pilih wilayah penarikan.');return;}
        const selected=[...document.querySelectorAll('input[name="iuranHouseKkPick"]:checked')].map(x=>x.value);
        const moving=selected.filter(id=>{const prev=currentByKk.get(String(id));return prev&&prev!==String(existing?.id)});
        if(moving.length){const ok=window.DawungConfirm?await window.DawungConfirm({title:'Pindahkan KK ke rumah ini?',entity:`${moving.length} KK akan dipindahkan`,message:'KK yang dipilih saat ini tertaut ke rumah/kotak lain. Jika diteruskan, tautannya akan dipindahkan ke rumah ini.',confirmText:'Ya, pindahkan',cancelText:'Batal',warningText:'Periksa kembali rumah tujuan sebelum melanjutkan.'}):window.confirm(`${moving.length} KK sudah ditautkan ke rumah/kotak lain. Jika diteruskan, KK tersebut akan dipindahkan ke rumah ini. Lanjutkan?`);if(!ok)return;}
        const btn=document.querySelector('#modalSave');if(btn){btn.disabled=true;btn.textContent='Menyimpan…';}
        try{
          const user=await currentUser();const payload={nama_rumah,label_warga_id,alamat,wilayah_id,catatan,aktif};
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
      document.querySelector('.modal')?.classList.add('iuran-house-modal-overlay');
      document.querySelector('.modal-box')?.classList.add('iuran-house-modal');
      document.querySelector('.modal-body')?.classList.add('iuran-house-modal-body');
      const residentSelect=document.querySelector('#iuranHouseName');
      const addressInput=document.querySelector('#iuranHouseAddress');
      let addressTouched=false;
      addressInput?.addEventListener('input',()=>{addressTouched=true;});
      residentSelect?.addEventListener('change',()=>{
        const person=wargaList.find(w=>String(w.id)===String(residentSelect.value));
        if(!person)return;
        const newAddress=String(person.alamat||'').trim();
        if(addressInput&&newAddress&&!addressTouched){addressInput.value=newAddress;}
      });
      const updateSelectedCount=()=>{const count=document.querySelectorAll('input[name="iuranHouseKkPick"]:checked').length;const output=document.querySelector('#iuranHouseKkSelectedCount');if(output)output.textContent=`${count} dipilih`;};
      document.querySelectorAll('input[name="iuranHouseKkPick"]').forEach(input=>input.addEventListener('change',updateSelectedCount));
      document.querySelector('#iuranHouseKkSearch')?.addEventListener('input',()=>{const search=document.querySelector('#iuranHouseKkSearch');const q=search.value.toLocaleLowerCase('id-ID');document.querySelectorAll('#iuranHouseKkList .iuran-check-row').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('id-ID').includes(q));});
    }catch(e){toast('Gagal membuka form rumah/kotak: '+(e.message||e));}
  }
  async function issueHouseCard(house,cardState){
    if(!house)return;
    if(!house.aktif){toast('Aktifkan rumah/kotak sebelum membuat kartu digital.');return;}
    const resetting=!!cardState?.akses_aktif;
    if(resetting){const ok=window.DawungConfirm?await window.DawungConfirm({title:'Reset kartu digital?',entity:house.nama_rumah||house.kode_rumah||'Kartu iuran rumah',message:'Reset akan membuat kode QR dan PIN baru. Kartu lama langsung tidak berlaku.',confirmText:'Ya, reset kartu',cancelText:'Batal',warningText:'Pastikan Anda sudah siap membagikan QR dan PIN baru kepada pemilik rumah.',icon:'refresh',eyebrow:'KONFIRMASI RESET KARTU'}):window.confirm('Reset kartu akan membuat kode QR dan PIN baru. Kartu lama langsung tidak berlaku. Lanjutkan?');if(!ok)return;}
    let issued=false;
    try{
      const btn=document.querySelector(`[data-house-card="${house.id}"]`);if(btn){btn.disabled=true;btn.textContent='Membuat…';}
      const {data,error}=await sb().rpc('admin_issue_iuran_kartu',{p_rumah_id:house.id});
      if(error)throw error;
      if(!data?.ok||!data.kode_akses||!data.pin)throw new Error('Respons penerbitan kartu tidak lengkap.');
      issued=true;
      await showHouseCardIssued(data);
      await window.renderIuranWilayah();
    }catch(e){console.error('[Kartu iuran]',e);toast('Gagal membuat kartu: '+(e.message||e)+'. Pastikan SQL 08-iuran-kartu-rumah.sql sudah dijalankan.');}
    finally{const current=document.querySelector(`[data-house-card="${house.id}"]`);if(current){current.disabled=false;current.textContent=issued||resetting?'Reset Kartu':'Buat Kartu';}}
  }
  async function reprintHouseCard(house){
    if(!house)return;
    if(!house.aktif){toast('Aktifkan rumah/kotak sebelum mencetak kartu.');return;}
    const button=document.querySelector(`[data-house-reprint="${house.id}"]`);
    try{
      if(button){button.disabled=true;button.textContent='Memuat…';}
      const {data,error}=await sb().rpc('admin_get_iuran_kartu_qr',{p_rumah_id:house.id});
      if(error)throw error;
      if(!data?.ok||!data.kode_akses)throw new Error(data?.message||'Data kartu aktif tidak ditemukan.');
      await showHouseCardIssued(data,{reprint:true});
    }catch(e){console.error('[Cetak ulang kartu]',e);toast('Gagal memuat kartu lama: '+(e.message||e)+'. Pastikan SQL 09-iuran-kartu-cetak-ulang.sql sudah dijalankan.');}
    finally{if(button?.isConnected){button.disabled=false;button.textContent='Cetak Ulang';}}
  }
  function ensureQrLibrary(){
    if(window.DawungQR?.toDataURL)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let existing=document.querySelector('script[data-iuran-qrcode-local]');
      if(existing?.dataset.state==='error'){existing.remove();existing=null;}
      if(existing){
        if(existing.dataset.state==='loaded'&&window.DawungQR?.toDataURL){resolve();return;}
        existing.addEventListener('load',()=>window.DawungQR?.toDataURL?resolve():reject(new Error('Library QR lokal tidak tersedia.')),{once:true});
        existing.addEventListener('error',()=>reject(new Error('File QR lokal gagal dimuat.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      const src=new URL('./qr-local.js',ADMIN_IURAN_SCRIPT_URL);
      src.searchParams.set('v','20261016-qr-local-card-v2');
      script.src=src.href;script.dataset.iuranQrcodeLocal='1';script.dataset.state='loading';
      script.onload=()=>{script.dataset.state='loaded';window.DawungQR?.toDataURL?resolve():reject(new Error('Library QR lokal tidak tersedia.'));};
      script.onerror=()=>{script.dataset.state='error';reject(new Error('File QR lokal gagal dimuat.'));};
      document.head.appendChild(script);
    });
  }
  async function showHouseCardIssued(data, options={}){
    const isReprint=options.reprint===true;
    const publicUrl=new URL('/iuran-saya.html?k='+encodeURIComponent(data.kode_akses),window.location.origin).href;
    let qrDataUrl='';
    let qrError='';
    try{await ensureQrLibrary();qrDataUrl=window.DawungQR.toDataURL(publicUrl,512);}catch(e){qrError=e?.message||'QR belum dapat dibuat';console.warn('[Kartu iuran] QR lokal gagal dibuat:',e);}
    const qrMarkup=qrDataUrl
      ?`<img id="iuranResidentQr" src="${qrDataUrl}" alt="QR kartu iuran rumah">`
      :`<div class="iuran-qr-unavailable" id="iuranQrFallback"><b>QR belum tersedia</b><span>${escHtml(qrError||'Tekan coba lagi untuk membuat QR.')}</span><button type="button" id="iuranRetryQr">Coba buat QR lagi</button></div>`;
    const noteMarkup=isReprint?`<div class="iuran-issued-note iuran-issued-note-info"><b>Cetak ulang tanpa mereset kartu</b><p>Kode QR dan PIN lama tetap aktif. PIN tidak ditampilkan lagi; gunakan slip PIN yang sudah diberikan. Jika PIN hilang, barulah gunakan Reset Kartu.</p></div>`:`<div class="iuran-issued-note"><b>PIN hanya ditampilkan sekarang</b><p>Catat dan serahkan PIN secara pribadi. PIN tidak dicetak di kartu. Jika PIN hilang, admin perlu mereset kartu dan membuat PIN baru.</p></div>`;
    const pinMarkup=data.pin?`<div class="iuran-issued-pin"><span>PIN pribadi keluarga · berikan secara terpisah</span><b>${escHtml(data.pin)}</b></div>`:`<div class="iuran-issued-pin iuran-issued-pin-info"><span>PIN pribadi tidak ditampilkan ulang demi keamanan.</span><small>Gunakan slip PIN yang telah disimpan keluarga.</small></div>`;
    const body=`<div class="iuran-issued-card">
      ${noteMarkup}
      <div class="iuran-issued-preview">
        <div class="iuran-issued-layout">
          <div class="iuran-issued-main">
            <div class="iuran-issued-brand"><span class="iuran-issued-mark">DW</span><span><b>DUSUN DAWUNG</b><small>RT.04 / RW.01</small></span></div>
            <div class="iuran-issued-kicker">KARTU IURAN DIGITAL</div>
            <b class="iuran-issued-house-name">${escHtml(data.nama_rumah||'Rumah/Kotak Iuran')}</b>
            <span class="iuran-issued-house-address">${escHtml(data.alamat||'Dusun Dawung')}</span>
            <div class="iuran-issued-meta"><div><span>KODE RUMAH</span><b>${escHtml(data.kode_rumah||'—')}</b></div><div><span>KODE KARTU</span><b class="iuran-mono-code">${escHtml(data.kode_akses||'')}</b></div></div>
            <p class="iuran-issued-card-tip">Pindai QR, lalu masukkan PIN terpisah.</p>
          </div>
          <div class="iuran-issued-qr"><div class="iuran-issued-qr-frame" id="iuranResidentQrHost">${qrMarkup}</div><small>AKSES RIWAYAT IURAN</small><span>PIN tidak dicetak di kartu</span></div>
        </div>
      </div>
      ${pinMarkup}
      <p class="iuran-issued-url">Alamat halaman: <a href="${escHtml(publicUrl)}" target="_blank" rel="noopener">${escHtml(publicUrl)}</a></p>
      <div class="iuran-issued-actions">${data.pin?'<button type="button" id="iuranPrintPin" class="iuran-issued-secondary">Cetak slip PIN terpisah</button>':''}<button type="button" id="iuranCopyLink" class="iuran-issued-secondary">Salin tautan</button></div>
    </div>`;
    modal('Kartu Iuran Digital — '+(data.nama_rumah||data.kode_rumah),body,()=>printResidentCard(data,publicUrl,qrDataUrl));
    const overlay=document.querySelector('.modal');overlay?.classList.add('iuran-house-modal-overlay');document.querySelector('.modal-box')?.classList.add('iuran-house-modal');document.querySelector('.modal-body')?.classList.add('iuran-house-modal-body');
    const save=document.querySelector('#modalSave');if(save){save.textContent='Cetak Kartu';save.disabled=!qrDataUrl;save.title=qrDataUrl?'Cetak kartu ringkas tanpa PIN':'Tunggu hingga QR berhasil dibuat';}
    const cancel=document.querySelector('#modalCancel');if(cancel)cancel.textContent='Tutup';
    document.querySelector('#iuranRetryQr')?.addEventListener('click',async()=>{
      const retry=document.querySelector('#iuranRetryQr');if(retry){retry.disabled=true;retry.textContent='Membuat QR…';}
      try{
        await ensureQrLibrary();qrDataUrl=window.DawungQR.toDataURL(publicUrl,512);
        const host=document.querySelector('#iuranResidentQrHost');if(host)host.innerHTML=`<img id="iuranResidentQr" src="${qrDataUrl}" alt="QR kartu iuran rumah">`;
        if(save){save.disabled=false;save.title='Cetak kartu ringkas tanpa PIN';}
      }catch(e){if(retry){retry.disabled=false;retry.textContent='Coba buat QR lagi';}const fallback=document.querySelector('#iuranQrFallback span');if(fallback)fallback.textContent='Gagal membuat QR lokal. Muat ulang halaman lalu coba lagi.';console.warn(e);}
    });
    document.querySelector('#iuranPrintPin')?.addEventListener('click',()=>printPinSlip(data));
    document.querySelector('#iuranCopyLink')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(publicUrl);toast('Tautan halaman iuran berhasil disalin.');}catch(e){const ta=document.createElement('textarea');ta.value=publicUrl;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?'Tautan berhasil disalin.':'Salin tautan secara manual dari alamat yang ditampilkan.');}});
  }
  function printDocument(title,contents){
    const win=window.open('','_blank','width=760,height=900');
    if(!win){toast('Popup cetak diblokir browser. Izinkan popup untuk mencetak kartu.');return;}
    win.document.open();win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escHtml(title)}</title><style>
      @page{size:90mm 56mm;margin:0}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      html,body{width:90mm;height:56mm;margin:0;padding:0;background:#fff;color:#233044;font-family:Inter,"Segoe UI",Arial,sans-serif}
      body{overflow:hidden}
      .card{position:relative;width:90mm;height:56mm;margin:0;padding:4mm 4mm 4mm 3.5mm;border:.25mm solid #d8e2ea;border-left:2mm solid #3d765b;border-radius:3mm;overflow:hidden;background:linear-gradient(132deg,#fff 0%,#f7fafc 100%);color:#223149}
      .resident-card{display:flex;gap:3mm;text-align:left}
      .card-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;height:100%}
      .brandline{display:flex;align-items:center;gap:1.6mm;color:#2d4c3a;font-size:6.3pt;letter-spacing:.3mm;font-weight:800;line-height:1.1}
      .brand-mark{width:7mm;height:7mm;display:grid;place-items:center;border-radius:1.7mm;background:#e7f0e8;border:.2mm solid #d2e4d5;color:#33734b;font-size:6pt;letter-spacing:0;flex:0 0 7mm}
      .brand-copy{display:flex;flex-direction:column;gap:.6mm}
      .brand-copy small{font-size:5.7pt;letter-spacing:.2mm;color:#728174;font-weight:650}
      .card-eyebrow{margin-top:2.1mm;font-size:5.5pt;font-weight:800;letter-spacing:.55mm;color:#6574a6}
      .card-house-name{display:block;margin-top:1mm;font-size:11pt;line-height:1.12;font-weight:800;color:#1e2f49;max-height:12mm;overflow:hidden;overflow-wrap:anywhere}
      .card-address{display:block;margin-top:1mm;font-size:6.8pt;line-height:1.25;color:#68758a;max-height:6mm;overflow:hidden;overflow-wrap:anywhere}
      .card-details{display:grid;gap:1mm;margin-top:auto;padding-top:1.4mm}
      .card-detail-label{display:block;color:#7b8798;font-size:5pt;line-height:1.2;letter-spacing:.2mm;font-weight:750}
      .card-detail-value{display:block;margin-top:.4mm;color:#273854;font-size:6.8pt;line-height:1.15;font-weight:800;overflow-wrap:anywhere}
      .card-code{font-family:ui-monospace,Consolas,monospace;font-size:6.5pt;letter-spacing:.35mm}
      .card-tip{margin:1.3mm 0 0;padding-top:1.1mm;border-top:.2mm solid #e2e9ef;font-size:5.6pt;line-height:1.2;color:#68758a}
      .qr-col{align-self:center;display:flex;flex:0 0 25mm;width:25mm;flex-direction:column;align-items:center;justify-content:center;gap:1.2mm;min-width:0;padding-left:2mm;border-left:.25mm solid #dce5e9}
      .qr-frame{width:25mm;height:25mm;display:grid;place-items:center;padding:1mm;border:.25mm solid #e0e8ed;border-radius:2mm;background:#fff;box-shadow:0 1mm 2mm rgba(31,55,75,.06)}
      .qr{display:block;width:22.5mm;height:22.5mm;object-fit:contain;image-rendering:pixelated}
      .qr-unavailable{width:22.5mm;height:22.5mm;display:grid;place-items:center;padding:1mm;text-align:center;color:#854747;font-size:6pt;border:.3mm dashed #ddb4b4;background:#fffafa}
      .qr-note{font-size:5.1pt;line-height:1.2;font-weight:800;letter-spacing:.25mm;text-align:center;color:#46634f}
      .qr-subnote{font-size:4.8pt;line-height:1.15;text-align:center;color:#7e8993}
      .pin-slip{display:flex;flex-direction:column;justify-content:center;text-align:center;padding:5mm 7mm;background:linear-gradient(135deg,#fafbff,#f4f7ff);border-color:#dce3f4}
      .pin-slip .brandline{justify-content:center;font-size:6pt;color:#5b69b0}
      .pin-slip .card-house-name{font-size:10pt;max-height:7mm}
      .pin-slip .card-address{font-size:6.5pt;max-height:4mm}
      .pin-slip .pin-label{margin-top:3mm;font-size:5.6pt;font-weight:800;letter-spacing:.4mm;color:#6877b4}
      .pin-slip .pin-value{margin:1mm 0;font-size:20pt;line-height:1.05;letter-spacing:2.2mm;font-weight:850;color:#4558b3}
      .pin-slip .pin-caption{font-size:6pt;line-height:1.25;color:#626f89}
      .pin-slip .warning{margin-top:2mm;font-size:5.5pt;line-height:1.25;color:#895f20;background:#fff3d7;border:.2mm solid #f1dfb4;border-radius:1.5mm;padding:1.5mm}
      @media screen{body{margin:20px auto;overflow:visible}.card{box-shadow:0 6px 30px rgba(25,45,70,.12)}}
    </style></head><body>${contents}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);win.document.close();
  }
  function printResidentCard(data,publicUrl,qrDataUrl){
    if(!qrDataUrl&&window.DawungQR?.toDataURL){try{qrDataUrl=window.DawungQR.toDataURL(publicUrl,512);}catch(e){console.warn('[Cetak kartu] QR gagal dibuat:',e);}}
    const qrMarkup=qrDataUrl?`<img class="qr" src="${escHtml(qrDataUrl)}" alt="QR kartu iuran">`:`<div class="qr-unavailable">QR belum tersedia.<br>Jangan bagikan kartu ini.</div>`;
    printDocument('Kartu Iuran Digital',`<article class="card resident-card"><section class="card-main"><div class="brandline"><span class="brand-mark">DW</span><span class="brand-copy"><b>DUSUN DAWUNG</b><small>RT.04 / RW.01</small></span></div><div class="card-eyebrow">KARTU IURAN DIGITAL</div><b class="card-house-name">${escHtml(data.nama_rumah||'Rumah/Kotak Iuran')}</b><span class="card-address">${escHtml(data.alamat||'Dusun Dawung')}</span><div class="card-details"><div><span class="card-detail-label">KODE RUMAH</span><b class="card-detail-value">${escHtml(data.kode_rumah||'—')}</b></div><div><span class="card-detail-label">KODE KARTU</span><b class="card-detail-value card-code">${escHtml(data.kode_akses||'')}</b></div></div><p class="card-tip">Pindai QR, lalu masukkan PIN pribadi yang disimpan terpisah.</p></section><aside class="qr-col"><div class="qr-frame">${qrMarkup}</div><b class="qr-note">PIN TERPISAH</b><span class="qr-subnote">Jangan cetak PIN di kartu QR</span></aside></article>`);
  }
  function printPinSlip(data){
    printDocument('Slip PIN Iuran',`<article class="card pin-slip"><div class="brandline"><span class="brand-mark">DW</span><span class="brand-copy"><b>SLIP PIN PRIBADI</b><small>DUSUN DAWUNG RT.04 / RW.01</small></span></div><b class="card-house-name">${escHtml(data.nama_rumah||'Rumah/Kotak Iuran')}</b><span class="card-address">${escHtml(data.alamat||'Dusun Dawung')}</span><div class="pin-label">PIN PRIBADI KELUARGA</div><div class="pin-value">${escHtml(data.pin||'')}</div><div class="pin-caption">Gunakan PIN ini setelah memindai QR pada Kartu Iuran Digital.</div><div class="warning">Simpan secara pribadi. Jangan bagikan foto slip PIN ke grup umum.</div></article>`);
  }
  async function toggleHouse(house){if(!house)return;try{const {error}=await sb().from('iuran_rumah').update({aktif:!house.aktif}).eq('id',house.id);if(error)throw error;toast(house.aktif?'Rumah/kotak dinonaktifkan.':'Rumah/kotak diaktifkan.');await window.renderIuranWilayah();}catch(e){toast('Gagal mengubah status rumah: '+(e.message||e));}}
})();
