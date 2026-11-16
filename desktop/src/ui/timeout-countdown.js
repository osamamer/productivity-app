// The main process owns the timing (it resets while this window is not focused); this page only
// draws the state it sends.
const params = new URLSearchParams(location.search);
const name = params.get('name') || 'this app';
const total = Math.max(0, Number(params.get('seconds')) || 0);
const autoOpen = params.get('auto') === '1';

const progress = document.getElementById('progress');
const number = document.getElementById('number');
const caption = document.getElementById('caption');
const openButton = document.getElementById('open');
const circumference = 2 * Math.PI * 52;

document.title = `A moment before ${name}`;
document.getElementById('eyebrow').textContent = `A moment before ${name}`;
document.getElementById('message').textContent = params.get('message') || 'Take a breath.';
openButton.textContent = `Open ${name}`;
openButton.hidden = autoOpen;
progress.style.strokeDasharray = String(circumference);

function render({ remaining, focused, ready }) {
    number.textContent = String(remaining);
    const fraction = total ? remaining / total : 0;
    progress.style.strokeDashoffset = String(circumference * (1 - fraction));
    openButton.disabled = !ready;
    caption.classList.toggle('paused', !focused);
    if (!focused) caption.textContent = 'Countdown reset. Focus this window to start again.';
    else if (ready) caption.textContent = 'Ready when you are. Keep this window focused.';
    else if (autoOpen) caption.textContent = `Opening ${name} after the countdown. Keep this window focused.`;
    else caption.textContent = `Wait, then choose whether to open ${name}. Keep this window focused.`;
}

render({ remaining: total, focused: true, ready: false });
window.timeoutWindow.onState(render);
openButton.addEventListener('click', () => window.timeoutWindow.open());
document.getElementById('cancel').addEventListener('click', () => window.timeoutWindow.cancel());
document.getElementById('close').addEventListener('click', () => window.timeoutWindow.cancel());
document.getElementById('cancel').focus();
window.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.timeoutWindow.cancel();
});
