"use client";

import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Layers, Loader2, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

const PRO_VIDEOS = [
    { name: "Steph Curry — Tir 3pts", id: "curry_3pt" },
    { name: "LeBron James — Drive", id: "lebron_drive" },
    { name: "Kevin Durant — Mid-Range", id: "kd_midrange" },
];

export default function ComparePage() {
    const [userVideo, setUserVideo] = useState<string | null>(null);
    const [proVideo, setProVideo] = useState<string | null>(null);
    const [userFile, setUserFile] = useState<File | null>(null);
    const [opacity, setOpacity] = useState(50);
    const [isOverlay, setIsOverlay] = useState(false);
    const [analysisResult, setAnalysisResult] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(true);
    const userVideoRef = useRef<HTMLVideoElement>(null);
    const proVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleUserUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setUserFile(e.target.files[0]);
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
        <div className="min-h-full bg-neutral-950 text-white px-4 pt-6 pb-4">
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
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <label className="block text-sm font-bold mb-2">Ta vidéo</label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={handleUserUpload}
                        className="block w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-neutral-800 file:text-white active:file:bg-neutral-700"
                    />
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
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
                    className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 rounded-xl border border-neutral-800 text-sm font-bold whitespace-nowrap active:bg-neutral-800"
                >
                    <Layers className="w-4 h-4" />
                    {isOverlay ? "Superposition" : "Côte à Côte"}
                </button>

                {isOverlay && (
                    <div className="flex items-center gap-3 bg-neutral-900 px-4 py-2 rounded-xl border border-neutral-800">
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
                className={`relative w-full bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden mb-4 ${isOverlay ? "aspect-video" : ""
                    }`}
            >
                {!userVideo && !proVideo && (
                    <div className="flex items-center justify-center w-full h-48 text-neutral-600 font-medium text-sm">
                        Charge deux vidéos pour comparer
                    </div>
                )}

                {isOverlay ? (
                    <>
                        {userVideo && (
                            <video
                                ref={userVideoRef}
                                src={userVideo}
                                controls
                                playsInline
                                className="absolute top-0 left-0 w-full h-full object-contain"
                            />
                        )}
                        {proVideo && (
                            <video
                                ref={proVideoRef}
                                src={proVideo}
                                controls
                                playsInline
                                className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"
                                style={{ opacity: opacity / 100 }}
                            />
                        )}
                    </>
                ) : (
                    <div className="flex flex-col">
                        {userVideo && (
                            <video
                                ref={userVideoRef}
                                src={userVideo}
                                controls
                                playsInline
                                className="w-full border-b border-neutral-800"
                            />
                        )}
                        {proVideo && (
                            <video
                                ref={proVideoRef}
                                src={proVideo}
                                controls
                                playsInline
                                className="w-full"
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Compare button */}
            {userVideo && proVideo && (
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
                    className="bg-neutral-900 border border-blue-500/30 rounded-2xl overflow-hidden mb-4"
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
