(function(){
  'use strict';

  const list = document.querySelector('#publicAnnouncements');
  if(!list) return;

  const sb = window.DAWUNG_SUPABASE;

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function formatDate(value){
    if(!value) return '';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return esc(value);
    return d.toLocaleDateString('id-ID', {
      day:'2-digit', month:'short', year:'numeric'
    });
  }

  function render(items){
    if(!items || !items.length){
      list.innerHTML = '<li><b>Belum ada pengumuman</b><small>Belum ada informasi terbaru.</small></li>';
      return;
    }

    list.innerHTML = items.map(item => {
      const title = esc(item.judul);
      const date = formatDate(item.published_at);
      const isi = esc(item.isi);
      return `<li class="public-announcement-item">
        <b>${title}</b>
        <small>${date}</small>
        <span>${isi}</span>
      </li>`;
    }).join('');
  }

  async function load(){
    if(!sb){
      console.warn('[Public Pengumuman] Supabase belum tersedia.');
      return;
    }

    const {data, error} = await sb
      .from('pengumuman')
      .select('id, judul, isi, published_at')
      .order('published_at', {ascending:false})
      .limit(3);

    if(error){
      console.warn('[Public Pengumuman]', error);
      return;
    }

    render(data || []);
  }

  load();
})();
