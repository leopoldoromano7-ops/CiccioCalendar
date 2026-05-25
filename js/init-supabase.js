// Supabase initialization
(function() {
    const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || 'https://your-project.supabase.co';
    const SUPABASE_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || 'your-anon-key';

    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Supabase library not loaded!');
    }
})();
