(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  if(!sb) return;
  const setText=(id,value)=>{const el=document.getElementById(id);if(el && value!==null && value!==undefined && String(value).trim())el.textContent=String(value);};
  async function load(){
    try{
      const {data,error}=await sb.from('site_settings').select('site_name,rt,rw,slogan,footer_title,footer_description,footer_address,footer_contact,footer_copyright').eq('id',1).maybeSingle();
      if(error){console.warn('[Public footer] Pengaturan belum termuat:',error.message);return;}
      if(!data)return;
      const area=[data.rt?`RT ${data.rt}`:'',data.rw?`RW ${data.rw}`:''].filter(Boolean).join(' / ');
      setText('footerTitle',data.footer_title);
      setText('footerDescription',data.footer_description);
      setText('footerAddress',data.footer_address);
      setText('footerContact',data.footer_contact);
      setText('footerSlogan',data.slogan?`“${data.slogan}”`:null);
      setText('footerArea',area);
      setText('footerCopyright',data.footer_copyright);
    }catch(err){console.warn('[Public footer]',err);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
