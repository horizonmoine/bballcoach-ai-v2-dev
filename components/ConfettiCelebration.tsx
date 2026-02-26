"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface Confetti {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
    rot: number;
    rotV: number;
    color: string;
    life: number;
}

const PALETTE = [
    "#f97316", "#fb923c", "#fbbf24", "#facc15", // oranges/yellows
    "#3b82f6", "#60a5fa",                        // blues
    "#a855f7", "#c084fc",                        // purples
    "#22c55e", "#4ade80",                        // greens
    "#ef4444", "#f87171",                        // reds
    "#ffffff",                                    // white
];

export default function ConfettiCelebration({ trigger }: { trigger: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const confettiRef = useRef<Confetti[]>([]);
    const rafRef = useRef<number>(0);
    const [active, setActive] = useState(false);

    const burst = useCallback(() => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const cx = rect.width / 2;

        const particles: Confetti[] = [];
        for (let i = 0; i < 80; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = Math.random() * 12 + 4;
            particles.push({
                x: cx + (Math.random() - 0.5) * 60,
                y: -10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 8,
                w: Math.random() * 8 + 4,
                h: Math.random() * 4 + 2,
                rot: Math.random() * Math.PI * 2,
                rotV: (Math.random() - 0.5) * 0.3,
                color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
                life: 1,
            });
        }
        confettiRef.current = particles;
        setActive(true);
    }, []);

    // Trigger burst when trigger prop changes
    useEffect(() => {
        if (trigger > 0) {
            setTimeout(burst, 0);
        }
    }, [trigger, burst]);

    useEffect(() => {
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio, 2);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.scale(dpr, dpr);
        };
        resize();

        const animate = () => {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            confettiRef.current = confettiRef.current.filter((c) => c.life > 0);
            if (confettiRef.current.length === 0) {
                setActive(false);
                return;
            }

            for (const c of confettiRef.current) {
                c.x += c.vx;
                c.vy += 0.25; // gravity
                c.y += c.vy;
                c.vx *= 0.99; // air resistance
                c.rot += c.rotV;
                c.life -= 0.008;

                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.rot);
                ctx.globalAlpha = Math.max(0, c.life);
                ctx.fillStyle = c.color;
                ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                ctx.restore();
            }

            rafRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => cancelAnimationFrame(rafRef.current);
    }, [active]);

    if (!active) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[200] pointer-events-none"
            style={{ width: "100vw", height: "100vh" }}
        />
    );
}
