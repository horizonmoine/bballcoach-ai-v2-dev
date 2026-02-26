"use client";

import { useEffect, useRef } from "react";

interface Star {
    x: number;
    y: number;
    z: number;
    ox: number;
    oy: number;
    size: number;
    alpha: number;
    color: string;
}

const COLORS = [
    "249,115,22",   // orange
    "59,130,246",   // blue
    "168,85,247",   // purple
    "255,255,255",  // white
];

export default function ParticleBackground({ count = 60 }: { count?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const starsRef = useRef<Star[]>([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio, 2);
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener("resize", resize);

        // Initialize stars
        const rect = canvas.getBoundingClientRect();
        starsRef.current = Array.from({ length: count }, () => {
            const x = Math.random() * rect.width;
            const y = Math.random() * rect.height;
            return {
                x, y,
                z: Math.random() * 2 + 0.5,
                ox: x, oy: y,
                size: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.6 + 0.1,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
            };
        });

        const handlePointer = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        canvas.addEventListener("pointermove", handlePointer);

        let time = 0;
        const animate = () => {
            const r = canvas.getBoundingClientRect();
            const w = r.width;
            const h = r.height;
            ctx.clearRect(0, 0, w, h);
            time += 0.003;

            for (const star of starsRef.current) {
                // Gentle floating drift
                star.x = star.ox + Math.sin(time * star.z + star.oy) * 12;
                star.y = star.oy + Math.cos(time * star.z * 0.7 + star.ox) * 8;

                // Mouse repulsion (subtle)
                const dx = star.x - mouseRef.current.x;
                const dy = star.y - mouseRef.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const force = (120 - dist) / 120;
                    star.x += (dx / dist) * force * 15;
                    star.y += (dy / dist) * force * 15;
                }

                // Twinkle
                const twinkle = 0.5 + 0.5 * Math.sin(time * 3 + star.ox * 0.01);
                const alpha = star.alpha * twinkle;

                // Draw star with glow
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${star.color},${alpha})`;
                ctx.fill();

                // Subtle glow for larger stars
                if (star.size > 1.2) {
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${star.color},${alpha * 0.15})`;
                    ctx.fill();
                }
            }

            // Draw faint connection lines between close stars
            for (let i = 0; i < starsRef.current.length; i++) {
                for (let j = i + 1; j < starsRef.current.length; j++) {
                    const a = starsRef.current[i];
                    const b = starsRef.current[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < 80) {
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = `rgba(255,255,255,${0.04 * (1 - d / 80)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            rafRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener("resize", resize);
            canvas.removeEventListener("pointermove", handlePointer);
        };
    }, [count]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-auto"
            style={{ opacity: 0.7 }}
        />
    );
}
