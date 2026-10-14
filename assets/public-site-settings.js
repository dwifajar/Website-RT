(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  if(!sb) return;
  const setText=(id,value)=>{const el=document.getElementById(id);if(el && value!==null && value!==undefined && String(value).trim())el.textContent=String(value);};
  const setRow=(rowId,textId,value,href)=>{
    const row=document.getElementById(rowId),text=document.getElementById(textId);
    const content=String(value||'').trim();
    if(!row||!text)return;
    if(!content){row.hidden=true;return;}
    text.textContent=content;
    if(href){row.href=href;row.hidden=false;}
    else {row.removeAttribute('href');row.hidden=false;}
  };
  async function load(){
    try{
      const {data,error}=await sb.from('site_settings').select('site_name,rt,rw,footer_title,footer_description,footer_address,footer_contact,footer_phone,footer_email').eq('id',1).maybeSingle();
      if(error){console.warn('[Public footer] Pengaturan belum termuat:',error.message);return;}
      if(!data)return;
      const area=[data.rt?`RT ${data.rt}`:'',data.rw?`RW ${data.rw}`:''].filter(Boolean).join(' / ');
      setText('footerTitle',data.footer_title);
      setText('footerDescription',data.footer_description);
      setText('footerContact',data.footer_contact);
      setText('footerArea',area);
      const phone=String(data.footer_phone||'').trim();
      const phoneDigits=phone.replace(/[^+\d]/g,'');
      const phoneHref=phoneDigits.replace(/\D/g,'') ? `tel:${phoneDigits}` : '';
      setRow('footerPhoneRow','footerPhone',phone,phoneHref);
      const email=String(data.footer_email||'').trim();
      const emailHref=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '';
      setRow('footerEmailRow','footerEmail',email,emailHref);
      setRow('footerAddressRow','footerAddress',data.footer_address,'');
    }catch(err){console.warn('[Public footer]',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
