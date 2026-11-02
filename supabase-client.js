// ============================================================
// supabase-client.js — Shared Supabase client for ORDIZ
// ============================================================
// يتطلب: تحميل مكتبة supabase-js قبل هذا الملف
// الاستخدام: <script src="/supabase-client.js"></script>
// ============================================================

(function() {
  const SUPABASE_URL = "https://qfpmbbntxyrderjlejql.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_O3vqQ2MqwpZYhFRNfFBqFQ_IROe0g_m";

  // Expose globally
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  // Create client once
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('❌ supabase-client.js: supabase-js library not loaded before this file');
  }
})();
