(function(){
  'use strict';
  const dialog=document.getElementById('galleryLightbox');
  const largeImage=document.getElementById('galleryLightboxImage');
  const caption=document.getElementById('galleryLightboxCaption');
  if(!dialog||!largeImage||!caption)return;
  const closeButton=dialog.querySelector('.gallery-lightbox-close');
  let lastTrigger=null;
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
  document.querySelectorAll('[data-gallery-src]').forEach(button=>button.addEventListener('click',()=>open(button)));
  closeButton?.addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  document.addEventListener('keydown',event=>{if(dialog.hidden)return;if(event.key==='Escape'){event.preventDefault();close();}});
})();
