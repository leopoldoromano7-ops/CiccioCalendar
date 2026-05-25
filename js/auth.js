async function checkAuth() {
    if (!window.supabaseClient) return null;
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const isPrivatePage = window.location.pathname.includes('crud.html') || window.location.pathname.includes('timbratura.html');

    if (isPrivatePage && !session) {
        window.location.href = 'login.html';
    }

    return session;
}

// Global logout function
window.logout = async () => {
    await window.supabaseClient.auth.signOut();
    window.location.href = 'index.html';
};

// Check auth on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
