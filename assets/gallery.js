(function(){
  'use strict';
  const grid=document.querySelector('.gallery-grid');
  const dialog=document.getElementById('galleryLightbox');
  const largeImage=document.getElementById('galleryLightboxImage');
  const caption=document.getElementById('galleryLightboxCaption');
  const disclaimer=document.querySelector('.gallery-disclaimer');
  if(!grid||!dialog||!largeImage||!caption)return;
  const closeButton=dialog.querySelector('.gallery-lightbox-close');
  let lastTrigger=null;
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function renderItems(items){
    grid.innerHTML=items.length?items.map(item=>{
      const title=String(item.title||'Foto kegiatan warga');
      const description=String(item.description||'Momen kegiatan warga Dusun Dawung');
      const source=String(item.image_url||'');
      const alt=String(item.alt_text||title);
      return `<button class="gallery-item" type="button" data-gallery-src="${esc(source)}" data-gallery-alt="${esc(alt)}" data-gallery-title="${esc(title)}" aria-label="Perbesar foto ${esc(title)}"><img src="${esc(source)}" alt="${esc(alt)}" loading="lazy"><span class="gallery-overlay"><strong>${esc(title)}</strong><small>${esc(description)}</small><i aria-hidden="true">↗</i></span></button>`;
    }).join(''):'<div class="gallery-empty-public">Belum ada foto kegiatan yang ditampilkan. Silakan kunjungi kembali nanti.</div>';
    if(disclaimer){
      const hasSamples=items.some(item=>item.is_sample===true);
      disclaimer.hidden=!hasSamples;
      if(hasSamples)disclaimer.innerHTML='<span aria-hidden="true">ⓘ</span> Foto yang masih berlabel ilustrasi merupakan contoh tampilan. Ganti dengan dokumentasi asli melalui halaman Admin → Galeri Warga.';
    }
  }
  async function loadManagedGallery(){
    const sb=window.DAWUNG_SUPABASE;
    if(!sb)return;
    try{
      const {data,error}=await sb.from('gallery_items').select('id,title,description,image_url,alt_text,is_sample,sort_order,created_at').eq('is_published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false});
      if(error){console.warn('[Public gallery] Galeri dinamis belum tersedia:',error.message);return;}
      renderItems(data||[]);
    }catch(error){console.warn('[Public gallery]',error);}
  }
  function open(trigger){
    lastTrigger=trigger;
    const image=trigger.dataset.gallerySrc;
    const title=trigger.dataset.galleryTitle||trigger.dataset.galleryAlt||'Foto kegiatan warga';
    largeImage.src=image;largeImage.alt=trigger.dataset.galleryAlt||title;caption.textContent=title;
    dialog.hidden=false;document.body.classList.add('gallery-open');closeButton?.focus();
  }
  function close(){
    dialog.hidden=true;largeImage.removeAttribute('src');document.body.classList.remove('gallery-open');
    if(lastTrigger&&document.contains(lastTrigger))lastTrigger.focus();
  }
  grid.addEventListener('click',event=>{const trigger=event.target.closest('[data-gallery-src]');if(trigger&&grid.contains(trigger))open(trigger);});
  closeButton?.addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  document.addEventListener('keydown',event=>{if(dialog.hidden)return;if(event.key==='Escape'){event.preventDefault();close();}});
  loadManagedGallery();
})();
