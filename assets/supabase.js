(function(){
  if(!window.supabase || !window.DAWUNG_CONFIG) return;
  window.DAWUNG_SUPABASE = window.supabase.createClient(
    window.DAWUNG_CONFIG.SUPABASE_URL,
    window.DAWUNG_CONFIG.SUPABASE_ANON_KEY
  );
})();
