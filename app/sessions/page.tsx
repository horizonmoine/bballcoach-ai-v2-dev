"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toastStore";
import { motion } from "framer-motion";
import {
    Calendar,
    Clock,
    Activity,
    Loader2,
    Video,
    Trash2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface Session {
    id: string;
    video_url: string;
    duration_seconds: number;
    ai_feedback_summary: string | null;
    created_at: string;
}

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
};

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { addToast } = useToastStore();
    const hiddenVideoRef = useRef<HTMLVideoElement>(null);
    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("sessions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        if (data) setSessions(data);
        setLoading(false);
    };

    const deleteSession = async (session: Session) => {
        // Extract filename from URL for storage deletion
        const urlParts = session.video_url.split("/");
        const fileName = urlParts[urlParts.length - 1];

        const { error: dbError } = await supabase
            .from("sessions")
            .delete()
            .eq("id", session.id);

        if (dbError) {
            addToast("Erreur suppression session.", "error");
            return;
        }

        // Try delete from storage (non-blocking)
        supabase.storage.from("sessions_videos").remove([fileName]);

        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        addToast("Session supprimée.", "success");
    };

    const extractFrames = async (videoUrl: string): Promise<string[]> => {
        return new Promise((resolve) => {
            const video = hiddenVideoRef.current;
            const canvas = hiddenCanvasRef.current;
            if (!video || !canvas) {
                resolve([]);
                return;
            }
            const frames: string[] = [];
            const ctx = canvas.getContext("2d");
            video.crossOrigin = "anonymous";
            video.src = videoUrl;
            video.onloadeddata = async () => {
                const duration = video.duration;
                if (!duration || !isFinite(duration)) {
                    resolve([]);
                    return;
                }
                for (let i = 1; i <= 8; i++) {
                    video.currentTime = (duration / 8) * i;
                    await new Promise<void>((r) => {
                        video.onseeked = () => r();
                    });
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frames.push(canvas.toDataURL("image/jpeg", 0.6));
                    }
                }
                resolve(frames);
            };
        });
    };

    const analyzeSession = async (session: Session) => {
        if (analyzingId) return;
        setAnalyzingId(session.id);
        try {
            const frames = await extractFrames(session.video_url);
            if (frames.length === 0) throw new Error("Extraction échouée");

            const {
                data: { session: authSession },
            } = await supabase.auth.getSession();
            if (!authSession) throw new Error("Non authentifié");

            const res = await fetch("/api/coach", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authSession.access_token}`,
                },
                body: JSON.stringify({
                    prompt:
                        "Analyse complète de la mécanique de cette session. Identifie les défauts chroniques de posture, de transfert de poids et d'alignement du bras de tir. Fournis des corrections précises.",
                    frames,
                }),
            });
            const data = await res.json();
            if (data.reply) {
                await supabase
                    .from("sessions")
                    .update({ ai_feedback_summary: data.reply })
                    .eq("id", session.id);
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === session.id
                            ? { ...s, ai_feedback_summary: data.reply }
                            : s,
                    ),
                );
                addToast("Analyse terminée !", "success");
            }
        } catch (err) {
            console.error(err);
            addToast("Erreur lors de l'analyse.", "error");
        } finally {
            setAnalyzingId(null);
        }
    };

    const formatDuration = (s: number) => {
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    return (
        <div className="min-h-full bg-background text-white px-4 pt-6 pb-4">
            <video ref={hiddenVideoRef} className="hidden" muted playsInline />
            <canvas
                ref={hiddenCanvasRef}
                width={640}
                height={360}
                className="hidden"
            />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-orange-500 mb-1">
                        Historique
                    </h1>
                    <p className="text-sm text-neutral-400">
                        Tes sessions live enregistrées
                    </p>
                </div>
                <div className="glass-panel px-3 py-1.5 rounded-xl">
                    <span className="text-xs text-neutral-400 font-bold">
                        {sessions.length} session{sessions.length !== 1 && "s"}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton h-24 rounded-2xl" />
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <div className="glass-panel p-10 text-center">
                    <Video className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-neutral-300 mb-1">
                        Aucune session
                    </h2>
                    <p className="text-sm text-neutral-500">
                        Lance un entraînement live pour enregistrer ta première session.
                    </p>
                </div>
            ) : (
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-3"
                >
                    {sessions.map((session) => (
                        <motion.div
                            key={session.id}
                            variants={item}
                            className="glass-panel overflow-hidden"
                        >
                            {/* Video */}
                            <video
                                src={session.video_url}
                                className="w-full aspect-video object-cover bg-black"
                                controls
                                playsInline
                            />

                            {/* Session info bar */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                                <div className="flex items-center gap-3 text-xs text-neutral-400">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(session.created_at).toLocaleDateString(
                                            "fr-FR",
                                            { day: "numeric", month: "short" },
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 bg-neutral-800 px-2 py-0.5 rounded">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(session.duration_seconds)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteSession(session)}
                                    className="p-2 text-neutral-500 active:text-red-500 transition"
                                    title="Supprimer"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* AI analysis accordion */}
                            <button
                                onClick={() =>
                                    setExpandedId(
                                        expandedId === session.id ? null : session.id,
                                    )
                                }
                                className="w-full flex items-center justify-between px-4 py-3 text-left"
                            >
                                <div className="flex items-center gap-2">
                                    <Activity
                                        className={`w-4 h-4 ${session.ai_feedback_summary
                                            ? "text-orange-500"
                                            : "text-neutral-600"
                                            }`}
                                    />
                                    <span className="text-sm font-bold">
                                        {session.ai_feedback_summary
                                            ? "Diagnostic IA"
                                            : "Pas encore analysée"}
                                    </span>
                                </div>
                                {expandedId === session.id ? (
                                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                                )}
                            </button>

                            {expandedId === session.id && (
                                <div className="px-4 pb-4">
                                    {session.ai_feedback_summary ? (
                                        <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed glass-panel p-4 max-h-60 overflow-y-auto">
                                            {session.ai_feedback_summary}
                                        </p>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-sm text-neutral-500 mb-3">
                                                Lance l&apos;analyse IA pour obtenir un diagnostic.
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => analyzeSession(session)}
                                        disabled={analyzingId !== null}
                                        className="w-full mt-3 py-3 bg-neutral-800 active:bg-orange-600 text-white rounded-xl font-bold text-sm transition disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {analyzingId === session.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Analyse en cours…
                                            </>
                                        ) : (
                                            <>
                                                <Activity className="w-4 h-4" />
                                                {session.ai_feedback_summary
                                                    ? "Re-analyser"
                                                    : "Analyser"}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
