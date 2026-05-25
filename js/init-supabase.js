// Supabase initialization
(function() {
    const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || 'https://qchanzqobszujliilsrc.supabase.co';
    const SUPABASE_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjaGFuenFvYnN6dWpsaWlsc3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzEzMDcsImV4cCI6MjA5NTMwNzMwN30.5j1B-mNpfC1bF69iBLUhlMGRsNHeZTrJTwoWbzSMtSg';

    if (typeof supabase !== 'undefined') {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error('Supabase library not loaded!');
    }
})();
