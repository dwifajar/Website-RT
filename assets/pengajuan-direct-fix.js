/* Direct fallback for Admin > Pengajuan Surat.
   This intentionally bypasses the generic page router so the menu works even
   when its data-page value does not match the router's switch/case. */
(function(){
  function loadPelayananThenRun(){
    const run=()=>{
      if(typeof window.renderPelayananAdmin==='function'){
        Promise.resolve(window.renderPelayananAdmin()).catch(err=>{
          console.error('[Pengajuan Surat]',err);
          const app=document.querySelector('#app,[data-admin-app]');
          if(app) app.innerHTML='<div class="admin-card wide"><div class="card-head"><div><b>Pengajuan Surat gagal dibuka</b><small>'+String(err?.message||err).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))+'</small></div></div></div>';
        });
        return;
      }
      const s=document.createElement('script');
      s.src='../assets/pelayanan.js?v='+Date.now();
      s.onload=()=>setTimeout(run,0);
      s.onerror=()=>alert('Modul Pengajuan Surat gagal dimuat. Pastikan assets/pelayanan.js sudah ada di GitHub.');
      document.body.appendChild(s);
    };
    run();
  }

  function bind(){
    const links=document.querySelectorAll('.admin-side nav a, #adminNav a, nav a');
    links.forEach(a=>{
      const label=(a.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(!label.includes('pengajuan surat')) return;
      a.addEventListener('click',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        links.forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        loadPelayananThenRun();
      },true);
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();
