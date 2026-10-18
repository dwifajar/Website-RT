(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  if(!sb)return;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
  const dateFmt=v=>{if(!v)return '';const d=new Date(String(v).slice(0,10)+'T00:00:00');return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});};
  async function loadCash(){
    const {data,error}=await sb.from('transaksi_keuangan').select('id,tanggal,jenis,kategori,nominal,keterangan,created_at').order('tanggal',{ascending:false}).order('created_at',{ascending:false});
    if(error){console.warn('[Public Sync] Kas RT belum dapat dimuat:',error.message);return;}
    const rows=data||[];let income=0,out=0;
    rows.forEach(x=>{const n=Number(x.nominal)||0;if(String(x.jenis).toLowerCase()==='pemasukan')income+=n;else out+=n;});
    const saldo=income-out, cash=$('#publicCash');
    if(cash)cash.innerHTML=`<small>Saldo Terakhir</small><strong>${money(saldo)}</strong><div><span>Pemasukan <b>${money(income)}</b></span><em style="width:${income+out?Math.round(income/(income+out)*100):0}%"></em></div><div><span>Pengeluaran <b>${money(out)}</b></span><em class="out" style="width:${income+out?Math.round(out/(income+out)*100):0}%"></em></div><div><span>Saldo <b>${money(saldo)}</b></span><em style="width:${income?Math.max(0,Math.min(100,Math.round(saldo/income*100))):0}%"></em></div>`;
    const stat=$('#publicStats');if(stat){const amount=stat.querySelector('.stat-amount');if(amount)amount.textContent=money(saldo);}
  }
  async function loadAgenda(){
    const {data,error}=await sb.from('agenda').select('id,judul,tanggal,jam,lokasi,deskripsi').order('tanggal',{ascending:true});
    if(error){console.warn('[Public Sync] Agenda belum dapat dimuat:',error.message);return;}
    const rows=data||[], list=$('#publicAgendaList'), featured=$('#publicAgenda');
    if(list)list.innerHTML=rows.length?rows.map(x=>{const d=dateFmt(x.tanggal).split(' ');return `<article><span>${esc(d[0]||'')}<small>${esc((d[1]||'').replace('.','').toUpperCase())}</small></span><div><b>${esc(x.judul)}</b><small>${esc(x.jam||'')}${x.jam&&x.lokasi?' · ':''}${esc(x.lokasi||'')}</small></div></article>`}).join(''):'<article><div><b>Belum ada agenda</b><small>Agenda terbaru akan ditampilkan di sini.</small></div></article>';
    if(featured){const x=rows[0];featured.innerHTML=x?`<div class="event-feature"><div class="fake-photo">🌱</div><div><h3>${esc(x.judul)}</h3><p>◷ ${esc(dateFmt(x.tanggal))}</p><p>◉ ${esc(x.jam||'Waktu menyusul')}</p><p>⌖ ${esc(x.lokasi||'Lokasi menyusul')}</p><label>Agenda</label></div></div>`:'<p>Belum ada agenda kegiatan.</p>';}
  }
  async function loadStats(){
    const stat=$('#publicStats');if(!stat)return;
    // Use a database-side aggregate so the public page never needs direct read access
    // to personal rows in warga, kartu_keluarga, or surat_pengajuan.
    const {data,error}=await sb.rpc('get_public_home_stats');
    if(error){
      console.warn('[Public Sync] Statistik beranda belum dapat dimuat:',error.message);
      return;
    }
    const result=Array.isArray(data)?data[0]:data;
    if(!result)return;
    const cards=stat.querySelectorAll('.stat-copy b');
    if(cards[0])cards[0].textContent=String(Number(result.kk_count)||0);
    if(cards[1])cards[1].textContent=String(Number(result.warga_count)||0);
    if(cards[2])cards[2].textContent=String(Number(result.surat_dalam_proses)||0);
    if(cards[3])cards[3].textContent=money(result.saldo_kas);
    const amount=stat.querySelector('.stat-amount');if(amount)amount.textContent=money(result.saldo_kas);
  }
  Promise.allSettled([loadCash(),loadAgenda(),loadStats()]);
})();
