const menu = window.appMenu;
const panel = document.getElementById('panel');
let buttons = [];
let activeIndex = -1;

function setActive(index) {
    activeIndex = index;
    buttons.forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === index));
}

function render(items) {
    panel.replaceChildren();
    buttons = [];
    for (const item of items) {
        if (item.separator) {
            const separator = document.createElement('div');
            separator.className = 'separator';
            separator.setAttribute('role', 'separator');
            panel.append(separator);
            continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = item.id === 'quit' ? 'item danger' : 'item';
        button.setAttribute('role', 'menuitem');
        button.tabIndex = -1;
        const label = document.createElement('span');
        label.textContent = item.label;
        button.append(label);
        if (item.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = 'shortcut';
            shortcut.textContent = item.shortcut;
            button.append(shortcut);
        }
        const index = buttons.length;
        button.addEventListener('mouseenter', () => setActive(index));
        button.addEventListener('mouseleave', () => setActive(-1));
        button.addEventListener('click', () => menu.select(item.id));
        buttons.push(button);
        panel.append(button);
    }
    const bounds = panel.getBoundingClientRect();
    menu.reportSize({ width: bounds.width, height: bounds.height });
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        menu.close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const start = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex;
        setActive((start + step + buttons.length) % buttons.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && activeIndex !== -1) {
        event.preventDefault();
        buttons[activeIndex].click();
    }
});

menu.onItems(render);
menu.onTheme(({ background }) => applyPageTheme(background));
menu.onOpened(() => {
    setActive(-1);
    document.body.classList.remove('opening');
    void document.body.offsetWidth;
    document.body.classList.add('opening');
    panel.focus();
});
