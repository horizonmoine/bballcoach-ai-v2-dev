"use client";

import React, { useRef, useEffect } from "react";

interface RadarChartProps {
    labels: string[];
    data: number[]; // 0-100
    color?: string;
    size?: number;
}

export default function RadarChart({
    labels,
    data,
    color = "#f97316",
    size = 220,
}: RadarChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animProgress = useRef(0);
    const animFrame = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);

        const cx = size / 2;
        const cy = size / 2;
        const maxR = size * 0.38;
        const n = labels.length;
        const angleStep = (Math.PI * 2) / n;

        const draw = (progress: number) => {
            ctx.clearRect(0, 0, size, size);

            // Grid rings
            for (let ring = 1; ring <= 4; ring++) {
                const r = maxR * (ring / 4);
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255,255,255,${ring === 4 ? 0.15 : 0.06})`;
                ctx.lineWidth = 1;
                for (let i = 0; i <= n; i++) {
                    const angle = i * angleStep - Math.PI / 2;
                    const x = cx + Math.cos(angle) * r;
                    const y = cy + Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
            }

            // Axis lines
            for (let i = 0; i < n; i++) {
                const angle = i * angleStep - Math.PI / 2;
                ctx.beginPath();
                ctx.strokeStyle = "rgba(255,255,255,0.08)";
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
                ctx.stroke();
            }

            // Data polygon
            const eased = easeOutCubic(Math.min(1, progress));
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const idx = i % n;
                const angle = idx * angleStep - Math.PI / 2;
                const val = (data[idx] / 100) * maxR * eased;
                const x = cx + Math.cos(angle) * val;
                const y = cy + Math.sin(angle) * val;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();

            // Fill
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
            gradient.addColorStop(0, hexToRgba(color, 0.35));
            gradient.addColorStop(1, hexToRgba(color, 0.08));
            ctx.fillStyle = gradient;
            ctx.fill();

            // Stroke
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 12;
            ctx.shadowColor = color;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Data points
            for (let i = 0; i < n; i++) {
                const angle = i * angleStep - Math.PI / 2;
                const val = (data[i] / 100) * maxR * eased;
                const x = cx + Math.cos(angle) * val;
                const y = cy + Math.sin(angle) * val;
                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.fillStyle = "#000";
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Labels
            ctx.font = "bold 10px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (let i = 0; i < n; i++) {
                const angle = i * angleStep - Math.PI / 2;
                const labelR = maxR + 18;
                const x = cx + Math.cos(angle) * labelR;
                const y = cy + Math.sin(angle) * labelR;
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.fillText(labels[i], x, y);
                // Value below label
                ctx.fillStyle = color;
                ctx.font = "bold 9px Inter, system-ui, sans-serif";
                ctx.fillText(`${Math.round(data[i] * eased)}`, x, y + 12);
                ctx.font = "bold 10px Inter, system-ui, sans-serif";
            }
        };

        animProgress.current = 0;
        const animate = () => {
            animProgress.current += 0.035;
            draw(animProgress.current);
            if (animProgress.current < 1) {
                animFrame.current = requestAnimationFrame(animate);
            }
        };
        animate();

        return () => cancelAnimationFrame(animFrame.current);
    }, [labels, data, color, size]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: size, height: size }}
            className="mx-auto"
        />
    );
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
