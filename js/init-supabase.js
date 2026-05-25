// Supabase initialization
(function() {
    const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || 'https://qchanzqobszujliilsrc.supabase.co';
    const SUPABASE_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || 'sb_publishable_VJJ8Rp526rflBFh1T5sLcw_WStUGcbK';

    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Supabase library not loaded!');
    }
})();
