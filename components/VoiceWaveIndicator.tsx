// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use client";

import { useRef, useEffect, useMemo } from "react";

interface VoiceWaveIndicatorProps {
    active: boolean;
    color?: string;
    barCount?: number;
    size?: "sm" | "md" | "lg";
    stream?: MediaStream | null;
}

export default function VoiceWaveIndicator({
    active,
    color = "#3b82f6",
    barCount = 7,
    size = "sm",
    stream = null,
}: VoiceWaveIndicatorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef(0);
    const phaseRef = useRef(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    const dims = useMemo(() => (
        size === "lg" ? { w: 200, h: 60 } : size === "md" ? { w: 100, h: 36 } : { w: 60, h: 28 }
    ), [size]);

    // Connect Web Audio API analyser when stream is available
    useEffect(() => {
        if (!stream || !active) {
            // Disconnect if exists
            if (sourceRef.current) {
                try { sourceRef.current.disconnect(); } catch { /* ignore */ }
                sourceRef.current = null;
            }
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => { });
                audioCtxRef.current = null;
            }
            analyserRef.current = null;
            dataArrayRef.current = null;
            return;
        }

        try {
            const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            audioCtxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.75;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            dataArrayRef.current = dataArray;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;
        } catch {
            // Web Audio API not available or stream error — fallback to fake animation
        }

        return () => {
            if (sourceRef.current) {
                try { sourceRef.current.disconnect(); } catch { /* ignore */ }
                sourceRef.current = null;
            }
            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => { });
                audioCtxRef.current = null;
            }
            analyserRef.current = null;
            dataArrayRef.current = null;
        };
    }, [stream, active]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const { w, h } = dims;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        const draw = () => {
            ctx.clearRect(0, 0, w, h);
            phaseRef.current += 0.12;

            const useDpr = dpr; // captured in closure
            void useDpr;

            const barW = size === "lg" ? 6 : size === "md" ? 5 : 4;
            const gap = (w - barCount * barW) / (barCount + 1);

            for (let i = 0; i < barCount; i++) {
                const x = gap + i * (barW + gap);

                let amplitude: number;

                if (active && analyserRef.current && dataArrayRef.current) {
                    // Real audio data
                    // @ts-expect-error - Web Audio API expects Uint8Array, TS type might mismatch ArrayBufferLike
                    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                    const dataLen = dataArrayRef.current.length;
                    const binIdx = Math.floor((i / barCount) * dataLen);
                    const rawVal = dataArrayRef.current[binIdx] / 255;
                    // Add slight wave animation to smooth out very quiet moments
                    const sineBoost = 0.1 * Math.abs(Math.sin(phaseRef.current + i * 0.5));
                    amplitude = Math.max(0.08, Math.min(1, rawVal * 1.2 + sineBoost));
                } else if (active) {
                    // Fallback animated wave
                    amplitude = 0.3 + 0.65 * Math.abs(Math.sin(phaseRef.current + i * 0.9));
                } else {
                    // Idle — tiny flat bars
                    amplitude = 0.08 + 0.04 * Math.abs(Math.sin(phaseRef.current * 0.3 + i));
                }

                const barH = h * amplitude;
                const y = (h - barH) / 2;

                // Gradient fill per bar
                const grad = ctx.createLinearGradient(x, y, x, y + barH);
                const alpha = active ? 1 : 0.25;
                grad.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
                grad.addColorStop(1, `${color}55`);

                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(x, y, barW, barH, barW / 2);
                } else {
                    ctx.rect(x, y, barW, barH);
                }
                ctx.fillStyle = grad;
                ctx.fill();

                if (active) {
                    ctx.shadowBlur = amplitude > 0.5 ? 10 : 4;
                    ctx.shadowColor = color;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }

            animRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animRef.current);
    }, [active, color, barCount, size, dims]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: dims.w, height: dims.h }}
            className="inline-block"
        />
    );
}
