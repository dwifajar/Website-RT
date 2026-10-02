(function(){
  function bind(){
    document.querySelectorAll('.admin-side nav a').forEach(a=>a.addEventListener('click',async e=>{
      const href=a.getAttribute('href')||'';
      if(href.startsWith('#')){
        e.preventDefault();
        document.querySelectorAll('.admin-side nav a').forEach(x=>x.classList.toggle('active',x===a));
        const key=href.slice(1);
        if(key==='surat'&&window.renderPelayananWarga) await window.renderPelayananWarga();
        else if(key==='beranda'&&window.renderW) window.renderW();
        else if(key==='agenda') location.href='../index.html#kegiatan';
        else if(key==='profil') alert('Profil warga akan dikembangkan pada modul berikutnya.');
        document.querySelector('.admin-side').classList.remove('open');
      }
    }));
  }
  window.bindWargaPelayanan=bind;
})();
