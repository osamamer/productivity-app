import { useEffect, useRef } from 'react';

/** The still spiral behind the roads, redrawn when the panel changes size. */
export function VortexBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const panel = canvas?.parentElement;
        if (!canvas || !panel) return undefined;
        const draw = () => paintVortex(canvas, panel.getBoundingClientRect());
        draw();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(draw);
        observer.observe(panel);
        return () => observer.disconnect();
    }, []);

    return (
        <canvas ref={canvasRef} aria-hidden="true"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: -1 }} />
    );
}

function paintVortex(canvas: HTMLCanvasElement, box: DOMRect): void {
    const context = canvas.getContext('2d');
    if (!context || box.width === 0 || box.height === 0) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = box.width * ratio;
    canvas.height = box.height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const centerX = box.width / 2;
    const gradient = context.createRadialGradient(centerX, 30, 10, centerX, 30, Math.max(box.width, box.height) * 0.9);
    gradient.addColorStop(0, '#191530');
    gradient.addColorStop(0.35, '#0a0912');
    gradient.addColorStop(1, '#030304');
    context.fillStyle = gradient;
    context.fillRect(0, 0, box.width, box.height);
    const arms = 9;
    for (let arm = 0; arm < arms; arm++) {
        context.beginPath();
        for (let theta = 0; theta < 5.2 * Math.PI; theta += 0.04) {
            const radius = 14 * Math.exp(0.2 * theta);
            const angle = theta + arm * (2 * Math.PI / arms);
            const x = centerX + radius * Math.cos(angle) * 1.5;
            const y = -60 + radius * Math.sin(angle) * 0.9;
            if (theta === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.strokeStyle = 'rgba(163,149,242,0.045)';
        context.lineWidth = 1.2;
        context.stroke();
    }
}
