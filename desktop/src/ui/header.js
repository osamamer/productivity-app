const header = window.appHeader;
const mode = new URLSearchParams(window.location.search).get('mode');

const modeBadge = document.getElementById('mode');
if (mode === 'local' || mode === 'cloud') {
    modeBadge.classList.add(mode);
    document.getElementById('mode-label').textContent = mode === 'local' ? 'On this computer' : 'Cloud';
    modeBadge.title = mode === 'local'
        ? 'Your data stays on this computer. The app does not contact the cloud.'
        : 'Your data is stored on claritard.com.';
    modeBadge.title += ' Click to change where it is stored.';
    modeBadge.addEventListener('click', () => header.changeMode());
} else {
    modeBadge.remove();
}

document.getElementById('minimize').addEventListener('click', () => header.minimize());
document.getElementById('maximize').addEventListener('click', () => header.toggleMaximize());
document.getElementById('close').addEventListener('click', () => header.close());
document.getElementById('menu').addEventListener('click', event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    header.toggleMenu({ right: Math.round(bounds.right), bottom: Math.round(bounds.bottom) });
});

header.onWindowState(({ maximized }) => {
    document.body.classList.toggle('maximized', maximized);
    document.getElementById('maximize').setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
    document.getElementById('maximize').title = maximized ? 'Restore' : 'Maximize';
});

const update = document.getElementById('update');
header.onUpdateDownload(download => {
    update.hidden = !download;
    if (!download) return;
    document.getElementById('update-label').textContent = download.label;
    document.getElementById('update-fill').style.width = `${download.fraction * 100}%`;
    update.title = download.detail;
});

header.onTheme(({ background }) => applyPageTheme(background));
