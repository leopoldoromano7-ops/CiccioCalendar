document.addEventListener('DOMContentLoaded', () => {
    const introOverlay = document.createElement('div');
    introOverlay.id = 'intro-overlay';
    introOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #fff8f5;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 1s ease-out;
    `;

    introOverlay.innerHTML = `
        <div style="text-align: center;">
            <img src="favicon.svg" id="intro-logo" style="width: 120px; height: 120px; transform: scale(0); transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <h2 style="margin-top: 20px; font-family: 'Hanken Grotesk', sans-serif; font-size: 24px; color: #282625; opacity: 0; transition: opacity 0.5s ease-in;">CiccioSheets</h2>
        </div>
    `;

    document.body.appendChild(introOverlay);

    setTimeout(() => {
        document.getElementById('intro-logo').style.transform = 'scale(1)';
    }, 100);

    setTimeout(() => {
        introOverlay.querySelector('h2').style.opacity = '1';
    }, 600);

    setTimeout(() => {
        introOverlay.style.opacity = '0';
        setTimeout(() => introOverlay.remove(), 1000);
    }, 2000);
});
