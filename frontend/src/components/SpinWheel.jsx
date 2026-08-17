import { useEffect, useRef, useCallback } from 'react';

const TOP_PAD = 80; // px above wheel arc for ticker + rim glow

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function drawWheel(canvas, slices, rotation) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const cx = width / 2;
    const cy = height;              // center at very bottom — upper half is visible
    const outerR = height - TOP_PAD;
    const innerR = Math.max(22, outerR * 0.065);
    const n = slices.length;
    const sliceAngle = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, width, height);

    // Draw all slices — canvas auto-clips the lower half since cy === canvas.height
    slices.forEach((slice, i) => {
        const start = i * sliceAngle - rotation - Math.PI / 2;
        const end = start + sliceAngle;
        const mid = start + sliceAngle / 2;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, start, end);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Only label slices whose text midpoint falls clearly in the visible upper half
        const textR = outerR * 0.73;
        const labelY = cy + textR * Math.sin(mid);
        if (labelY < cy - innerR * 2.5) {
            ctx.save();
            ctx.translate(cx + textR * Math.cos(mid), labelY);
            ctx.rotate(mid); // radial: text reads from center outward
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(13, Math.min(26, Math.floor(outerR * 0.038)))}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 4;
            ctx.fillText(slice.label, 0, 0);
            ctx.restore();
        }
    });

    // Gold rim — upper arc only (CCW from left/π to right/0 passes through top)
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, Math.PI, 0, true);
    ctx.strokeStyle = 'rgba(255,215,0,0.9)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Center hub (full circle; lower half auto-clipped by canvas bounds)
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
    hubGrad.addColorStop(0, '#2a2a4a');
    hubGrad.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Decorative gold base bar along the bottom edge
    const baseGrad = ctx.createLinearGradient(0, height - 12, 0, height);
    baseGrad.addColorStop(0, 'rgba(255,215,0,0.15)');
    baseGrad.addColorStop(1, 'rgba(255,215,0,0.55)');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, height - 12, width, 12);
}

export default function SpinWheel({ wheelLayout, targetPrizeId, onSpinComplete }) {
    const canvasRef = useRef(null);
    const tickerRef = useRef(null);
    const rotationRef = useRef(0);
    const rafRef = useRef(null);
    const lastSliceRef = useRef(-1);

    const triggerTick = useCallback((angularVelocity) => {
        const ticker = tickerRef.current;
        if (!ticker) return;
        ticker.classList.remove('tick-normal', 'tick-slow', 'tick-heavy');
        void ticker.offsetHeight;
        if (angularVelocity > 0.025) ticker.classList.add('tick-normal');
        else if (angularVelocity > 0.008) ticker.classList.add('tick-slow');
        else ticker.classList.add('tick-heavy');
    }, []);

    useEffect(() => {
        if (!wheelLayout.length || targetPrizeId == null) return;

        const canvas = canvasRef.current;
        drawWheel(canvas, wheelLayout, rotationRef.current);

        const n = wheelLayout.length;
        const sliceAngle = (2 * Math.PI) / n;

        const candidates = wheelLayout
            .map((s, i) => ({ ...s, index: i }))
            .filter((s) => s.prize_id === targetPrizeId);

        if (!candidates.length) { onSpinComplete(); return; }

        const target = candidates[Math.floor(Math.random() * candidates.length)];

        const rng = Math.random();
        let nearMiss = null;
        if (rng < 0.15) nearMiss = 'left';
        else if (rng < 0.30) nearMiss = 'right';

        let fraction;
        if (nearMiss === 'left') fraction = 0.10 + Math.random() * 0.06;
        else if (nearMiss === 'right') fraction = 0.84 + Math.random() * 0.06;
        else fraction = 0.30 + Math.random() * 0.40;

        const fullRotations = 5 + Math.floor(Math.random() * 3);
        const startRotation = rotationRef.current;
        const targetRotation =
            startRotation +
            fullRotations * 2 * Math.PI +
            (target.index + fraction) * sliceAngle;

        const duration = 7000 + Math.random() * 2000;
        const oscillationDuration = nearMiss ? 900 : 0;
        const oscillationAmplitude = nearMiss ? sliceAngle * 0.08 : 0;
        const totalDuration = duration + oscillationDuration;
        const startTime = performance.now();
        let lastFrameTime = startTime;

        function animate(now) {
            const elapsed = now - startTime;
            let currentRotation;

            if (elapsed <= duration) {
                currentRotation = startRotation + (targetRotation - startRotation) * easeOutCubic(elapsed / duration);
            } else if (oscillationDuration > 0 && elapsed <= totalDuration) {
                const t2 = (elapsed - duration) / oscillationDuration;
                currentRotation = targetRotation + oscillationAmplitude * (1 - t2) * Math.sin(t2 * 2.5 * 2 * Math.PI);
            } else {
                currentRotation = targetRotation;
            }

            const delta = Math.abs(currentRotation - rotationRef.current);
            const angularVelocity = delta / Math.max(now - lastFrameTime, 1);
            rotationRef.current = currentRotation;
            lastFrameTime = now;

            const sliceAtPointer = Math.floor(currentRotation / sliceAngle) % n;
            if (sliceAtPointer !== lastSliceRef.current) {
                triggerTick(angularVelocity);
                lastSliceRef.current = sliceAtPointer;
            }

            drawWheel(canvas, wheelLayout, currentRotation);

            if (elapsed < totalDuration) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                rotationRef.current = targetRotation;
                drawWheel(canvas, wheelLayout, targetRotation);
                onSpinComplete();
            }
        }

        rafRef.current = requestAnimationFrame(animate);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [wheelLayout, targetPrizeId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fill edge-to-edge; height constrained to the space below the ~58px header
    const availH = window.innerHeight - 62;
    const radius = Math.min(
        Math.floor(window.innerWidth / 2) - 4,
        availH - TOP_PAD
    );
    const canvasW = radius * 2 + 8; // 4px gap each side
    const canvasH = radius + TOP_PAD;

    return (
        <div className="wheel-page">
            <div className="wheel-wrapper" style={{ width: canvasW, position: 'relative' }}>
                <div
                    ref={tickerRef}
                    className="ticker"
                    style={{ top: TOP_PAD - 16 }}
                />
                <canvas
                    ref={canvasRef}
                    className="wheel-canvas"
                    width={canvasW}
                    height={canvasH}
                />
            </div>
        </div>
    );
}
