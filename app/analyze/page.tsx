"use client";

import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import {
    UploadCloud,
    CheckCircle,
    Loader2,
    Clock,
    Trash2,
    Image as ImageIcon,
    Video,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface UploadRecord {
    id: string;
    media_url: string;
    media_type: string;
    ai_analysis: string | null;
    created_at: string;
}

export default function AnalyzePage() {
    const { user } = useAuthStore();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState("");
    const [uploads, setUploads] = useState<UploadRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!user) return;
        const fetchUploads = async () => {
            const { data } = await supabase
                .from("uploads")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });
            if (data) setUploads(data);
            setLoadingHistory(false);
        };
        fetchUploads();
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setFile(e.target.files[0]);
    };

    const extractFramesFromVideo = async (url: string): Promise<string[]> => {
        return new Promise((resolve) => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) { resolve([]); return; }
            const frames: string[] = [];
            const ctx = canvas.getContext("2d");
            video.crossOrigin = "anonymous";
            video.src = url;
            video.onloadeddata = async () => {
                const dur = video.duration;
                if (!dur || !isFinite(dur)) { resolve([]); return; }
                for (let i = 1; i <= 8; i++) {
                    video.currentTime = (dur / 8) * i;
                    await new Promise<void>((r) => { video.onseeked = () => r(); });
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frames.push(canvas.toDataURL("image/jpeg", 0.6));
                    }
                }
                resolve(frames);
            };
        });
    };

    const processUpload = async () => {
        if (!file) return;
        setUploading(true);
        setAnalysisResult("");

        try {
            const fileName = `${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from("user_uploads")
                .upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("user_uploads")
                .getPublicUrl(fileName);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Non authentifié");

            let frames: string[];
            let prompt: string;

            if (file.type.startsWith("video/")) {
                frames = await extractFramesFromVideo(publicUrl);
                prompt = "Analyse biomécanique complète de cette vidéo. Examine la base, le transfert d'énergie, le release point et le suivi.";
            } else {
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                frames = [base64];
                prompt = "Analyse biomécanique de cette posture statique.";
            }

            const res = await fetch("/api/coach", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ prompt, frames }),
            });
            const data = await res.json();
            if (data.reply) {
                setAnalysisResult(data.reply);
                if (user) {
                    const { data: insertData } = await supabase.from("uploads").insert({
                        user_id: user.id,
                        media_url: publicUrl,
                        media_type: file.type.startsWith("video/") ? "video" : "image",
                        ai_analysis: data.reply,
                    }).select().single();
                    if (insertData) setUploads((prev) => [insertData, ...prev]);
                }
            } else {
                setAnalysisResult(data.error || "Erreur d'analyse.");
            }
        } catch (err) {
            console.error(err);
            setAnalysisResult("Erreur lors du traitement du fichier.");
        } finally {
            setUploading(false);
            setFile(null);
        }
    };

    const deleteUpload = async (id: string) => {
        const { error } = await supabase.from("uploads").delete().eq("id", id);
        if (!error) setUploads((prev) => prev.filter((u) => u.id !== id));
    };

    return (
        <div className="min-h-full bg-background text-white px-4 pt-6 pb-4">
            <video ref={videoRef} className="hidden" crossOrigin="anonymous" />
            <canvas ref={canvasRef} width={640} height={360} className="hidden" />

            <h1 className="text-2xl font-black text-green-500 mb-1">Analyse</h1>
            <p className="text-sm text-neutral-400 mb-6">
                Upload une vidéo ou image pour un rapport IA
            </p>

            {/* Upload zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-5 mb-6"
            >
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer active:bg-neutral-800 transition">
                    <UploadCloud className="w-10 h-10 text-neutral-400 mb-3" />
                    <p className="text-sm text-neutral-400">
                        <span className="font-bold">Touche pour uploader</span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                        MP4, WEBM, JPG, PNG (max 50 MB)
                    </p>
                    <input
                        type="file"
                        className="hidden"
                        accept="video/*,image/*"
                        onChange={handleFileChange}
                    />
                </label>

                {file && (
                    <div className="mt-4 flex items-center justify-between bg-neutral-800 p-3 rounded-xl">
                        <span className="text-sm font-medium truncate max-w-[180px]">
                            {file.name}
                        </span>
                        <button
                            onClick={processUpload}
                            disabled={uploading}
                            className="flex items-center gap-2 bg-green-600 active:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analyse…
                                </>
                            ) : (
                                "Analyser"
                            )}
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Current analysis result */}
            {analysisResult && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-5 border border-green-500/30 bg-green-500/5 rounded-2xl"
                >
                    <div className="flex items-center mb-3 text-green-500">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <h3 className="font-bold text-sm">Rapport IA</h3>
                    </div>
                    <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                        {analysisResult}
                    </p>
                </motion.div>
            )}

            {/* Upload history */}
            <div>
                <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4 px-1">
                    Historique ({uploads.length})
                </h2>

                {loadingHistory ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="skeleton h-20 rounded-2xl" />
                        ))}
                    </div>
                ) : uploads.length === 0 ? (
                    <div className="glass-panel p-8 text-center">
                        <UploadCloud className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                        <p className="text-sm text-neutral-500">
                            Aucune analyse encore. Upload ta première vidéo !
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {uploads.map((upload) => (
                            <motion.div
                                key={upload.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-panel overflow-hidden"
                            >
                                <button
                                    onClick={() =>
                                        setExpandedId(
                                            expandedId === upload.id
                                                ? null
                                                : upload.id,
                                        )
                                    }
                                    className="w-full flex items-center justify-between p-4"
                                >
                                    <div className="flex items-center gap-3">
                                        {upload.media_type === "video" ? (
                                            <Video className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <ImageIcon className="w-5 h-5 text-green-500" />
                                        )}
                                        <div className="text-left">
                                            <p className="text-sm font-bold">
                                                {upload.media_type === "video"
                                                    ? "Vidéo"
                                                    : "Image"}
                                            </p>
                                            <div className="flex items-center gap-1 text-xs text-neutral-400">
                                                <Clock className="w-3 h-3" />
                                                {new Date(
                                                    upload.created_at,
                                                ).toLocaleDateString("fr-FR", {
                                                    day: "numeric",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteUpload(upload.id);
                                            }}
                                            className="p-2 text-neutral-500 active:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {expandedId === upload.id ? (
                                            <ChevronUp className="w-4 h-4 text-neutral-400" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                                        )}
                                    </div>
                                </button>

                                {expandedId === upload.id && (
                                    <div className="px-4 pb-4 border-t border-neutral-800 pt-3">
                                        {upload.ai_analysis ? (
                                            <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                                {upload.ai_analysis}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-neutral-500 italic">
                                                Pas d&apos;analyse disponible.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
