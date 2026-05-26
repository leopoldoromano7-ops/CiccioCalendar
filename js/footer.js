/**
 * Centralized Footer Component for CiccioSheets
 */

function renderFooter() {
    const footerContainer = document.getElementById('footer-container');
    if (!footerContainer) return;

    const footerHtml = `
    <footer class="w-full py-xl bg-surface-container-low border-t border-outline-variant">
        <div class="flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto px-margin-desktop gap-md">
            <div class="flex flex-col items-center md:items-start gap-xs">
                <div class="flex items-center gap-xs mb-xs">
                    <img alt="CiccioSheets Logo" class="w-8 h-8 opacity-70" src="favicon.svg">
                    <span class="font-headline-md text-headline-md font-bold text-primary">CiccioSheets</span>
                </div>
                <p class="font-label-md text-label-md text-secondary max-w-[300px] text-center md:text-left">© 2024 CiccioSheets. All rights reserved. Built for modern teams.</p>
            </div>
            <div class="flex flex-wrap justify-center gap-md">
                <a class="font-label-md text-label-md text-secondary hover:text-primary underline transition-all" href="#">Privacy Policy</a>
                <a class="font-label-md text-label-md text-secondary hover:text-primary underline transition-all" href="#">Terms of Service</a>
                <a class="font-label-md text-label-md text-secondary hover:text-primary underline transition-all" href="#">Cookie Policy</a>
                <a class="font-label-md text-label-md text-secondary hover:text-primary underline transition-all" href="#">Support</a>
                <a class="font-label-md text-label-md text-secondary hover:text-primary underline transition-all" href="#">Contact</a>
            </div>
        </div>
    </footer>
    `;

    footerContainer.innerHTML = footerHtml;
}

document.addEventListener('DOMContentLoaded', renderFooter);
