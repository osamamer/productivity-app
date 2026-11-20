// Where the pomodoro was on the page just before total focus took the screen, so the card can glide
// there from its list position. Read once, when the stage mounts.
let origin: DOMRect | null = null;

export function rememberFocusOrigin(rect: DOMRect | null): void {
    origin = rect;
}

export function takeFocusOrigin(): DOMRect | null {
    const taken = origin;
    origin = null;
    return taken;
}
