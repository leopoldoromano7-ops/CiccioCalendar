document.addEventListener('DOMContentLoaded', async () => {
    const authButtons = document.getElementById('auth-buttons');
    if (!authButtons) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (session) {
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', session.user.id)
            .single();

        authButtons.innerHTML = `
            <span class="font-body-md text-primary mr-2">${profile?.full_name || 'Utente'}</span>
            <button onclick="window.logout()" class="bg-secondary text-on-secondary px-md py-sm rounded-lg font-label-md text-label-md active:scale-95 duration-200 transition-all">Logout</button>
        `;
    }
});
