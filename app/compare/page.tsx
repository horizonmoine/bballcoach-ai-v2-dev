"use client";

import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Layers, Loader2, CheckCircle, ChevronDown, ChevronUp, Pause, Play, Settings2 } from "lucide-react";

const PRO_VIDEOS = [
    { name: "Steph Curry — Tir 3pts", id: "curry_3pt" },
    { name: "LeBron James — Drive", id: "lebron_drive" },
    { name: "Kevin Durant — Mid-Range", id: "kd_midrange" },
];

export default function ComparePage() {
    const [userVideo, setUserVideo] = useState<string | null>(null);
    const [proVideo, setProVideo] = useState<string | null>(null);

    const [opacity, setOpacity] = useState(50);
    const [isOverlay, setIsOverlay] = useState(false);
    const [analysisResult, setAnalysisResult] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(true);

    // --- V14: Timeline Scrubber State ---
    const [unifiedProgress, setUnifiedProgress] = useState(0);
    const [syncOffset, setSyncOffset] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const userVideoRef = useRef<HTMLVideoElement>(null);
    const proVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Synchronized playback
    React.useEffect(() => {
        let animationFrame: number;

        const updateProgress = () => {
            if (userVideoRef.current && proVideoRef.current && isPlaying) {
                const uDur = userVideoRef.current.duration || 1;
                const pDur = proVideoRef.current.duration || 1;
                const percent = (userVideoRef.current.currentTime / uDur) * 100;
                setUnifiedProgress(percent);

                // Enforce sync
                let expectedProTime = userVideoRef.current.currentTime + syncOffset;
                expectedProTime = Math.max(0, Math.min(expectedProTime, pDur));

                if (Math.abs(proVideoRef.current.currentTime - expectedProTime) > 0.1) {
                    proVideoRef.current.currentTime = expectedProTime;
                }
            }
            animationFrame = requestAnimationFrame(updateProgress);
        };

        if (isPlaying) {
            updateProgress();
        }
        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, syncOffset]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        setUnifiedProgress(val);
        if (userVideoRef.current) {
            const uDur = userVideoRef.current.duration || 1;
            const targetTime = (val / 100) * uDur;
            userVideoRef.current.currentTime = targetTime;

            if (proVideoRef.current) {
                const pDur = proVideoRef.current.duration || 1;
                let proTime = targetTime + syncOffset;
                proTime = Math.max(0, Math.min(proTime, pDur));
                proVideoRef.current.currentTime = proTime;
            }
        }
    };

    const togglePlay = () => {
        if (!userVideoRef.current || !proVideoRef.current) return;
        if (isPlaying) {
            userVideoRef.current.pause();
            proVideoRef.current.pause();
            setIsPlaying(false);
        } else {
            userVideoRef.current.play();
            proVideoRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleUserUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setUserVideo(URL.createObjectURL(e.target.files[0]));
        }
    };

    const handleProUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0])
            setProVideo(URL.createObjectURL(e.target.files[0]));
    };

    const extractFramesFromVideo = async (
        videoEl: HTMLVideoElement,
    ): Promise<string[]> => {
        const canvas = canvasRef.current;
        if (!canvas) return [];
        const ctx = canvas.getContext("2d");
        if (!ctx) return [];
        const frames: string[] = [];

        return new Promise((resolve) => {
            const dur = videoEl.duration;
            if (!dur || !isFinite(dur)) { resolve([]); return; }

            let i = 0;
            const times = Array.from({ length: 6 }, (_, idx) => (dur / 6) * (idx + 1));

            const seekNext = () => {
                if (i >= times.length) { resolve(frames); return; }
                videoEl.currentTime = times[i];
            };

            videoEl.onseeked = () => {
                ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL("image/jpeg", 0.6));
                i++;
                seekNext();
            };
            seekNext();
        });
    };

    const runComparison = async () => {
        if (!userVideoRef.current || !proVideoRef.current) return;
        setAnalyzing(true);
        setAnalysisResult("");

        try {
            const [userFrames, proFrames] = await Promise.all([
                extractFramesFromVideo(userVideoRef.current),
                extractFramesFromVideo(proVideoRef.current),
            ]);

            const allFrames = [...userFrames, ...proFrames];
            if (allFrames.length === 0) throw new Error("Extraction échouée");

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Non authentifié");

            const res = await fetch("/api/coach", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    prompt: `Compare la mécanique de tir entre ces deux vidéos. Les ${userFrames.length} premières images sont celles du joueur, les ${proFrames.length} suivantes le modèle pro. Identifie les différences clés en termes de: base/appuis, alignement coude-épaule, point de release, follow-through, et transfert d'énergie. Fournis des corrections concrètes.`,
                    frames: allFrames,
                }),
            });

            const data = await res.json();
            if (data.reply) setAnalysisResult(data.reply);
            else setAnalysisResult(data.error || "Erreur d'analyse.");
        } catch (err) {
            console.error(err);
            setAnalysisResult("Erreur lors de la comparaison.");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="min-h-full bg-background text-white px-4 pt-6 pb-4">
            <canvas ref={canvasRef} width={640} height={360} className="hidden" />

            <h1 className="text-2xl font-black mb-1 text-blue-500">Comparaison</h1>
            <p className="text-sm text-neutral-400 mb-6">
                Compare ta mécanique avec les pros
            </p>

            {/* Upload zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 mb-6"
            >
                <div className="glass-panel p-4">
                    <label className="block text-sm font-bold mb-2">Ta vidéo</label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleUserUpload}
                        className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-neutral-800 file:text-white active:file:bg-neutral-700"
                    />
                </div>
                <div className="glass-panel p-4">
                    <label className="block text-sm font-bold mb-2">Vidéo Pro</label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleProUpload}
                        className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white active:file:bg-blue-700"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                        {PRO_VIDEOS.map((v) => (
                            <button
                                key={v.id}
                                className="text-xs bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-neutral-300 active:bg-neutral-700"
                                onClick={() => {
                                    /* TODO: load from CDN */
                                }}
                            >
                                {v.name}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* View controls */}
            <div className="flex items-center gap-3 mb-4 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setIsOverlay(!isOverlay)}
                    className="flex items-center gap-2 px-4 py-2.5 glass-panel text-sm font-bold whitespace-nowrap active:bg-white/5"
                >
                    <Layers className="w-4 h-4" />
                    {isOverlay ? "Superposition" : "Côte à Côte"}
                </button>

                {isOverlay && (
                    <div className="flex items-center gap-3 glass-panel px-4 py-2">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={opacity}
                            onChange={(e) => setOpacity(Number(e.target.value))}
                            className="w-24 accent-blue-500"
                        />
                        <span className="text-xs text-neutral-400 w-8">
                            {opacity}%
                        </span>
                    </div>
                )}
            </div>

            {/* Video display */}
            <div
                className={`relative w-full glass-panel overflow-hidden mb-4 ${isOverlay ? "aspect-video" : ""}`}
            >
                {!userVideo && !proVideo && (
                    <div className="flex items-center justify-center w-full h-48 text-neutral-600 font-medium text-sm">
                        Charge deux vidéos pour comparer
                    </div>
                )}

                {isOverlay ? (
                    <>
                        {userVideo && (
                            <div className="absolute inset-0">
                                <video
                                    ref={userVideoRef}
                                    src={userVideo}
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        )}
                        {proVideo && (
                            <div className="absolute inset-0 z-10 pointer-events-none" style={{ opacity: opacity / 100 }}>
                                <video
                                    ref={proVideoRef}
                                    src={proVideo}
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col">
                        {userVideo && (
                            <video
                                ref={userVideoRef}
                                src={userVideo}
                                playsInline
                                muted
                                className="w-full border-b border-neutral-800"
                            />
                        )}
                        {proVideo && (
                            <video
                                ref={proVideoRef}
                                src={proVideo}
                                playsInline
                                muted
                                className="w-full"
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Timeline Scrubber */}
            {(userVideo && proVideo) && (
                <div className="glass-panel p-4 mb-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between text-xs text-neutral-400 font-bold uppercase tracking-wider mb-2">
                        <span>Timeline Master</span>
                        <span>{Math.round(unifiedProgress)}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="p-3 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 transition">
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={0.1}
                            value={unifiedProgress}
                            onChange={handleSeek}
                            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <Settings2 className="w-4 h-4" />
                            <span>Décalage Pro (Sync)</span>
                        </div>
                        <input
                            type="range"
                            min={-2}
                            max={2}
                            step={0.05}
                            value={syncOffset}
                            onChange={(e) => setSyncOffset(Number(e.target.value))}
                            className="w-24 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="text-xs font-mono text-orange-400 w-8 text-right">{syncOffset > 0 ? "+" : ""}{syncOffset.toFixed(2)}s</span>
                    </div>
                </div>
            )}

            {/* Compare button */}
            {(userVideo && proVideo) && (
                <button
                    onClick={runComparison}
                    disabled={analyzing}
                    className="w-full py-3.5 bg-blue-600 active:bg-blue-700 text-white rounded-xl font-black transition disabled:opacity-50 flex items-center justify-center gap-2 mb-4 glow-blue"
                >
                    {analyzing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Comparaison IA…
                        </>
                    ) : (
                        "🤖 Lancer la comparaison IA"
                    )}
                </button>
            )}

            {/* Analysis result */}
            {analysisResult && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel border-blue-500/30 overflow-hidden mb-4"
                >
                    <button
                        onClick={() => setShowAnalysis(!showAnalysis)}
                        className="w-full flex items-center justify-between p-4 text-blue-500"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold text-sm">Rapport IA</span>
                        </div>
                        {showAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showAnalysis && (
                        <div className="px-4 pb-4">
                            <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                                {analysisResult}
                            </p>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
