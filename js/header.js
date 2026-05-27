/**
 * Centralized Header Component for CiccioSheets
 */

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

window.showToast = function(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-2xl transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2 font-label-md ${
        type === 'success' ? 'bg-primary text-on-primary' : 'bg-error text-on-error'
    }`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-[20px]">${type === 'success' ? 'check_circle' : 'error'}</span>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

async function renderHeader() {
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    let profile = null;

    if (session) {
        const { data } = await window.supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', session.user.id)
            .single();
        profile = data;
    }

    const isLoggedIn = !!session;
    const fullName = escapeHTML(profile?.full_name || 'Utente');
    const email = escapeHTML(session?.user?.email || '');
    const firstLetter = fullName.charAt(0).toUpperCase();

    const headerHtml = `
    <header class="w-full top-0 sticky z-50 bg-surface h-20 shadow-none border-b border-surface-variant/30">
        <div class="flex justify-between items-center max-w-7xl mx-auto px-4 md:px-margin-desktop h-full">
            <div class="flex items-center gap-4">
                ${isLoggedIn ? `
                <button id="mobile-menu-btn" class="md:hidden p-2 text-primary hover:bg-surface-container rounded-lg transition-colors">
                    <span class="material-symbols-outlined">menu</span>
                </button>
                ` : ''}
                <a href="index.html" class="flex items-center gap-sm">
                    <img alt="CiccioSheets Logo" class="w-10 h-10 object-contain" src="favicon.svg">
                    <span class="font-headline-md text-headline-md font-bold text-primary">CiccioSheets</span>
                </a>
            </div>

            <!-- Desktop Nav -->
            <nav class="hidden md:flex items-center gap-lg">
                <a class="font-body-md text-body-md text-primary hover:text-secondary transition-colors" href="index.html">CALENDAR</a>
                <a class="font-body-md text-body-md text-primary hover:text-secondary transition-colors" href="report.html">REPORT</a>
                <a class="font-body-md text-body-md text-primary hover:text-secondary transition-colors" href="timbratura.html">TIMBRA</a>
            </nav>

            <!-- Auth Buttons -->
            <div class="flex items-center gap-2 md:gap-md">
                ${isLoggedIn ? `
                    <span class="hidden md:block font-body-md text-primary mr-2">${fullName}</span>
                    <button onclick="window.logout()" class="hidden md:block bg-secondary text-on-secondary px-md py-sm rounded-lg font-label-md text-label-md active:scale-95 duration-200 transition-all">Logout</button>
                ` : `
                    <a href="login.html" class="font-label-md text-label-md text-primary hover:underline transition-all px-2">Log In</a>
                    <a href="register.html" class="hidden md:block bg-primary text-on-primary px-3 md:px-xl py-sm rounded-lg font-label-md text-label-md hover:opacity-90 active:scale-95 duration-200 whitespace-nowrap">
                        Get Started
                    </a>
                `}
            </div>
        </div>

        <!-- Mobile Sidebar -->
        ${isLoggedIn ? `
        <div id="mobile-sidebar" class="fixed inset-0 z-[60] hidden">
            <!-- Overlay -->
            <div id="sidebar-overlay" class="absolute inset-0 bg-primary/20 backdrop-blur-sm opacity-0 transition-opacity duration-300"></div>

            <!-- Menu -->
            <div id="sidebar-content" class="absolute inset-y-0 left-0 w-64 bg-surface shadow-2xl transform -translate-x-full transition-transform duration-300 flex flex-col">
                <div class="p-4 border-b border-surface-variant flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <img src="favicon.svg" class="w-8 h-8" alt="Logo">
                        <span class="font-bold text-primary">CiccioSheets</span>
                    </div>
                    <button id="close-sidebar" class="p-2 hover:bg-surface-container rounded-lg">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div class="p-4 flex-grow overflow-y-auto">
                    <div class="mb-6">
                        <p class="text-xs font-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Menu</p>
                        <nav class="flex flex-col gap-2">
                            <a href="report.html" class="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container text-primary transition-colors">
                                <span class="material-symbols-outlined">analytics</span>
                                <span class="font-label-md">Report</span>
                            </a>
                            <a href="index.html" class="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container text-primary transition-colors">
                                <span class="material-symbols-outlined">calendar_month</span>
                                <span class="font-label-md">Calendar</span>
                            </a>
                            <a href="timbratura.html" class="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container text-primary transition-colors">
                                <span class="material-symbols-outlined">timer</span>
                                <span class="font-label-md">Timbrature</span>
                            </a>
                        </nav>
                    </div>
                </div>

                <div class="p-4 border-t border-surface-variant">
                    <div class="flex items-center gap-3 mb-4 px-3">
                        <div class="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center font-bold text-secondary">
                            ${firstLetter}
                        </div>
                        <div class="overflow-hidden">
                            <p class="font-label-md text-primary truncate">${fullName}</p>
                            <p class="text-xs text-on-surface-variant truncate">${email}</p>
                        </div>
                    </div>
                    <button onclick="window.logout()" class="w-full flex items-center gap-3 p-4 rounded-xl text-white bg-error hover:opacity-90 transition-all shadow-lg shadow-error/20 active:scale-[0.98]">
                        <span class="material-symbols-outlined">logout</span>
                        <span class="font-bold">Logout</span>
                    </button>
                </div>
            </div>
        </div>
        ` : ''}
    </header>
    `;

    headerContainer.innerHTML = headerHtml;

    // Sidebar Logic
    if (isLoggedIn) {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const closeSidebarBtn = document.getElementById('close-sidebar');
        const sidebar = document.getElementById('mobile-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const content = document.getElementById('sidebar-content');

        const openSidebar = () => {
            sidebar.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
                content.classList.remove('-translate-x-full');
                content.classList.add('translate-x-0');
            }, 10);
        };

        const closeSidebar = () => {
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            content.classList.remove('translate-x-0');
            content.classList.add('-translate-x-full');
            setTimeout(() => {
                sidebar.classList.add('hidden');
            }, 300);
        };

        mobileMenuBtn?.addEventListener('click', openSidebar);
        closeSidebarBtn?.addEventListener('click', closeSidebar);
        overlay?.addEventListener('click', closeSidebar);

        // Close on link click
        content.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', closeSidebar);
        });
    }
}

document.addEventListener('DOMContentLoaded', renderHeader);
