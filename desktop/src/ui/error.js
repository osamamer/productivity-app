const params = new URLSearchParams(window.location.search);
document.getElementById('message').textContent = params.get('message') || 'Unknown error.';
document.getElementById('log').textContent = params.get('log') || 'the logs folder';
