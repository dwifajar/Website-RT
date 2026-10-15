(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const fmt=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value)||0);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dateFormat=value=>{if(!value)return '—';const parts=String(value).slice(0,10).split('-');if(parts.length!==3)return esc(value);return new Date(Number(parts[0]),Number(parts[1])-1,Number(parts[2])).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});};
  let client=null;
  function showMessage(text,kind=''){const e=$('iuranAccessMessage');e.textContent=text;e.className='form-message'+(kind?' '+kind:'');}
  function showResult(data){
    const home=data.rumah||{},summary=data.ringkasan||{},transactions=Array.isArray(data.transaksi)?data.transaksi:[];
    $('resultHouseName').textContent=home.nama_rumah||'Rumah/Kotak Iuran';
    $('resultHouseAddress').textContent=home.alamat||'';
    $('resultHouseCode').textContent=home.kode_rumah||'';
    $('totalAll').textContent=fmt(summary.total_semua);
    $('totalMonth').textContent=fmt(summary.total_bulan_ini);
    $('totalYear').textContent=fmt(summary.total_tahun_ini);
    $('totalCount').textContent=String(Number(summary.jumlah_transaksi)||0);
    const now=new Date();$('currentMonthLabel').textContent=now.toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'});$('currentYearLabel').textContent=now.toLocaleDateString('id-ID',{year:'numeric',timeZone:'Asia/Jakarta'});
    $('iuranTransactions').innerHTML=transactions.length?transactions.map(t=>`<tr><td>${dateFormat(t.tanggal)}</td><td>${esc(t.dicatat_oleh||'Petugas/Admin')}</td><td>${esc(t.catatan||'—')}</td><td class="amount-cell">${fmt(t.nominal)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">Belum ada transaksi iuran yang tercatat untuk rumah ini.</td></tr>';
    const limitNote=$('historyLimitNote');
    if(Number(summary.jumlah_transaksi)>transactions.length){limitNote.hidden=false;limitNote.textContent=`Ditampilkan ${transactions.length} transaksi terbaru dari ${summary.jumlah_transaksi} transaksi. Total pada ringkasan tetap menghitung seluruh riwayat.`;}else{limitNote.hidden=true;limitNote.textContent='';}
    $('iuranResult').hidden=false;
    $('iuranResult').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function boot(){
    const cfg=window.DAWUNG_CONFIG;
    if(!window.supabase||!cfg?.SUPABASE_URL||!cfg?.SUPABASE_ANON_KEY){showMessage('Halaman belum bisa terhubung. Muat ulang beberapa saat lagi.');return;}
    client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const params=new URLSearchParams(window.location.search);const cardCode=params.get('k')||'';
    if(cardCode)$('iuranAccessCode').value=cardCode.toUpperCase();
  }
  $('togglePin').addEventListener('click',()=>{const input=$('iuranAccessPin');const show=input.type==='password';input.type=show?'text':'password';$('togglePin').textContent=show?'Sembunyikan':'Lihat';$('togglePin').setAttribute('aria-label',show?'Sembunyikan PIN':'Tampilkan PIN');});
  $('hideResult').addEventListener('click',()=>{$('iuranResult').hidden=true;showMessage('Riwayat ditutup. PIN tidak disimpan di browser.','success');$('iuranAccessPin').value='';$('iuranAccessForm').scrollIntoView({behavior:'smooth',block:'center'});});
  $('iuranAccessForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!client){showMessage('Halaman belum terhubung ke database. Muat ulang halaman.');return;}
    const code=$('iuranAccessCode').value.trim().toUpperCase();const pin=$('iuranAccessPin').value.trim();
    if(code.length<16){showMessage('Periksa kode kartu. Anda dapat memindai ulang QR pada kartu.');return;}
    if(!/^\d{8}$/.test(pin)){showMessage('PIN harus terdiri dari 8 angka.');return;}
    const button=$('iuranAccessSubmit');button.disabled=true;button.innerHTML='Memeriksa akses…';showMessage('Memeriksa kartu dan mengambil riwayat iuran…');$('iuranResult').hidden=true;
    try{
      const {data,error}=await client.rpc('lihat_iuran_rumah',{p_kode_akses:code,p_pin:pin});
      if(error)throw error;
      if(!data||data.ok!==true){showMessage(data?.message||'Kode kartu atau PIN tidak cocok. Periksa kembali data pada kartu.');$('iuranAccessPin').value='';return;}
      showMessage('Akses berhasil. Berikut riwayat iuran rumah Anda.','success');showResult(data);$('iuranAccessPin').value='';
    }catch(error){console.error('[Iuran Saya]',error);showMessage('Belum bisa mengambil data. Periksa koneksi internet dan coba lagi. Jika terus terjadi, hubungi admin RT.');}
    finally{button.disabled=false;button.innerHTML='<span aria-hidden="true">⌕</span> Lihat Iuran Saya';}
  });
  boot();
})();
