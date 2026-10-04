(function(){
  'use strict';
  async function load(){
    const el=document.querySelector('#publicAnnouncements');
    const sb=window.DAWUNG_SUPABASE;
    if(!el || !sb) return;
    try{
      const {data,error}=await sb
        .from('pengumuman')
        .select('id,judul,isi,published_at,created_at')
        .order('published_at',{ascending:false})
        .limit(3);
      if(error) throw error;
      if(Array.isArray(data) && data.length){
        el.innerHTML=data.map(x=>{
          const dt=new Date(x.published_at||x.created_at);
          const tanggal=isNaN(dt.getTime())?'':dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
          return `<li><b>${esc(x.judul)}</b><small>${esc(tanggal)}</small></li>`;
        }).join('');
      }
    }catch(e){
      console.warn('[Public Pengumuman]',e);
    }
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
  setInterval(load,60000);
})();
