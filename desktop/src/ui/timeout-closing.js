// Counts down to a fixed deadline (epoch ms) on its own; the main process closes the window.
const params = new URLSearchParams(location.search);
const appName = params.get('name') || 'App';
const deadline = Number(params.get('deadline')) || Date.now();
const total = Math.max(1, Number(params.get('total')) || 1);
const verb = params.get('action') === 'minimize' ? 'minimizes' : 'closes';
const URGENT_SECONDS = 60;

const container = document.getElementById('closing');
const time = document.getElementById('time');
const fill = document.getElementById('fill');
document.getElementById('name').textContent = `${appName} ${verb} in`;
document.title = `${appName} ${verb} soon`;

function tick() {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = String(remaining % 60).padStart(2, '0');
    time.textContent = hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
    fill.style.width = `${Math.min(100, (remaining / total) * 100)}%`;
    container.classList.toggle('urgent', remaining <= URGENT_SECONDS);
}

tick();
setInterval(tick, 250);
