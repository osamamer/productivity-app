const form = document.getElementById('chooser');
const errorText = document.getElementById('error');
const continueButton = document.getElementById('continue');

function selectedMode() {
    return form.querySelector('input[name=mode]:checked').value;
}

async function loadState() {
    const state = await window.storageChooser.getState();
    document.getElementById('local-path').textContent = `Stored in ${state.localDataDir}`;
    if (state.currentMode) {
        form.querySelector(`input[value=${state.currentMode}]`).checked = true;
        document.getElementById('current').textContent =
            `Currently using ${state.currentMode === 'local' ? 'this computer' : 'the cloud'}. Changing restarts the app.`;
    }
}

form.addEventListener('change', () => {
    errorText.textContent = '';
});

form.addEventListener('submit', async event => {
    event.preventDefault();
    errorText.textContent = '';
    continueButton.disabled = true;
    try {
        const result = await window.storageChooser.choose({ mode: selectedMode() });
        if (!result.ok) errorText.textContent = result.error;
    } catch (error) {
        console.error('Could not save the storage mode:', error);
        errorText.textContent = 'Could not save your choice. Please try again.';
    } finally {
        continueButton.disabled = false;
    }
});

void loadState().catch(error => {
    console.error('Could not load the current storage mode:', error);
});
