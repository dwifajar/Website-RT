(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  const $=s=>document.querySelector(s);
  const bell=$('#notificationBell');
  const badge=$('#notificationBadge');
  const panel=$('#notificationPanel');
  const list=$('#notificationList');
  if(!bell||!badge||!panel||!list) return;

  let open=false;
  let lastCounts={surat:0,aspirasi:0,unread:0,total:0};

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function showCount(total){
    badge.textContent=String(total);
    badge.hidden=total<=0;
  }
  function renderPanel(c){
    const items=[];
    if(c.surat>0) items.push(`<a class="admin-notify-item" href="./pengajuan.html"><span class="admin-notify-icon">▣</span><span><strong>${c.surat} pengajuan surat</strong><small>Masih menunggu atau diproses</small></span></a>`);
    if(c.aspirasi>0) items.push(`<a class="admin-notify-item" href="./?page=aspirasi"><span class="admin-notify-icon">♡</span><span><strong>${c.aspirasi} aspirasi/laporan baru</strong><small>Perlu ditindaklanjuti</small></span></a>`);
    if(c.unread>0) items.push(`<div class="admin-notify-item admin-notify-static"><span class="admin-notify-icon">•</span><span><strong>${c.unread} notifikasi sistem</strong><small>Belum dibaca</small></span></div>`);
    list.innerHTML=items.length?items.join(''):'<div class="admin-notify-empty">Tidak ada notifikasi baru.</div>';
  }
  async function countTable(name, filterFn){
    if(!sb) return 0;
    let q=sb.from(name).select('id',{count:'exact',head:true});
    q=filterFn(q);
    const {count,error}=await q;
    if(error){console.warn('[Admin Notification]',name,error);return 0;}
    return Number(count||0);
  }
  async function refresh(){
    let surat=0,aspirasi=0,unread=0;
    try{
      [surat,aspirasi]=await Promise.all([
        countTable('surat_pengajuan',q=>q.in('status',['menunggu','diproses'])),
        countTable('aspirasi',q=>q.eq('status','baru'))
      ]);
      unread=await countTable('notifikasi',q=>q.eq('dibaca',false));
    }catch(e){console.warn('[Admin Notification]',e);}
    // Fallback for systems where notifications table is empty or restricted.
    const total=surat+aspirasi+unread;
    lastCounts={surat,aspirasi,unread,total};
    showCount(total);
    renderPanel(lastCounts);
    return lastCounts;
  }
  function setOpen(v){
    open=!!v;
    panel.hidden=!open;
    bell.setAttribute('aria-expanded',open?'true':'false');
  }
  bell.addEventListener('click',e=>{e.stopPropagation();setOpen(!open);});
  $('#notificationClose')?.addEventListener('click',()=>setOpen(false));
  document.addEventListener('click',e=>{
    if(open && !e.target.closest('.admin-notify-wrap')) setOpen(false);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  window.updateAdminNotificationBell=refresh;
  refresh();
  setInterval(refresh,30000);
})();
