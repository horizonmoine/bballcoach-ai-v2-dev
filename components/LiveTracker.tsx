"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Square, Circle, RefreshCcw, Activity, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toastStore";
import { motion } from "framer-motion";
import {
    getPostureFeedback,
    getPoseScore,
    getShotPhase,
    getStabilityScore,
    type ShotPhase,
    type Landmark
} from "@/lib/biomechanics";

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export default function LiveTracker() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const poseLandmarkerRef = useRef<any>(null);
    const poseConnectionsRef = useRef<any>(null);
    const drawingUtilsRef = useRef<any>(null);
    const requestRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastSpeechTimeRef = useRef<number>(0);
    const { addToast } = useToastStore();

    const [isRecording, setIsRecording] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
    const [aiResponse, setAiResponse] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [jumpCount, setJumpCount] = useState(0);
    const [madeShots, setMadeShots] = useState(0);
    const [poseScore, setPoseScore] = useState(0);
    const [autoFeedback, setAutoFeedback] = useState(true);
    const [userTranscript, setUserTranscript] = useState("");
    const [ghostMode, setGhostMode] = useState(false);
    const [currentPhase, setCurrentPhase] = useState<ShotPhase>("IDLE");
    const [stabilityScore, setStabilityScore] = useState(100);
    const [errorHistory, setErrorHistory] = useState<string[]>([]);
    const particlesRef = useRef<Particle[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<BlobPart[]>([]);
    const frameBuffer = useRef<string[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const isDippingRef = useRef(false);
    const jumpCountRef = useRef(0);
    const facingModeRef = useRef(facingMode);
    const recordStartTimeRef = useRef<number>(0);
    const autoFeedbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        facingModeRef.current = facingMode;
    }, [facingMode]);

    /* ─── Camera helpers ─── */
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    }, []);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current)
            return;

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const video = videoRef.current;

        if (canvasRef.current.width !== video.videoWidth) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
        }

        const startTimeMs = performance.now();

        if (lastVideoTimeRef.current !== video.currentTime) {
            lastVideoTimeRef.current = video.currentTime;

            const result = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);

            ctx.save();
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);

            if (result.landmarks && result.landmarks.length > 0) {
                const lm = result.landmarks[0];

                if (drawingUtilsRef.current && poseConnectionsRef.current) {
                    const ctx = canvasRef.current!.getContext("2d")!;

                    // --- Neon Glow Style ---
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = "#00FF88";

                    drawingUtilsRef.current.drawLandmarks(lm, {
                        radius: 3,
                        color: "#FF6B35",
                    });
                    drawingUtilsRef.current.drawConnectors(
                        lm,
                        poseConnectionsRef.current,
                        { color: "#00FF88", lineWidth: 3 },
                    );

                    // Reset shadow for performance
                    ctx.shadowBlur = 0;

                    /* Ghost Mode - Reference Skeleton Overlay */
                    if (ghostMode) {
                        // We shift the reference points slightly or draw them in a fixed "ideal" position
                        // For a real "ideal" reference, we'd need a recorded professional sequence, 
                        // but here we'll draw a slightly transparent "perfection" overlay based on user scale.
                        const ghostLm = lm.map((p: any) => ({
                            ...p,
                            x: p.x + 0.02, // Offset slightly to see the difference
                            y: p.y - 0.05, // Slightly higher/straighter
                        }));
                        drawingUtilsRef.current.drawConnectors(
                            ghostLm,
                            poseConnectionsRef.current,
                            { color: "rgba(255, 255, 255, 0.3)", lineWidth: 2 },
                        );
                    }
                }

                /* Biomechanics updates */
                const phase = getShotPhase(lm as Landmark[]);
                const stability = getStabilityScore(lm as Landmark[]);
                setCurrentPhase(phase);
                setStabilityScore(stability);

                /* Jump/shot counter */
                const avgHipY = (lm[23].y + lm[24].y) / 2;
                if (avgHipY > 0.75 && !isDippingRef.current) {
                    isDippingRef.current = true;
                } else if (avgHipY < 0.65 && isDippingRef.current) {
                    jumpCountRef.current += 1;
                    setJumpCount(jumpCountRef.current);
                    isDippingRef.current = false;
                }

                const score = getPoseScore(lm as Landmark[]);
                setPoseScore(score);

                /* Edge posture feedback — instant spoken alerts */
                const feedback = getPostureFeedback(lm as Landmark[]);
                if (feedback && autoFeedback) {
                    triggerEdgeAudio(feedback);

                    // --- Proactive Coaching Logic ---
                    setErrorHistory((prev) => {
                        const newHistory = [...prev, feedback].slice(-5);
                        const sameErrorCount = newHistory.filter((e) => e === feedback).length;
                        if (sameErrorCount >= 3) {
                            triggerEdgeAudio(`Coach: Attention, ton erreur de "${feedback.toLowerCase()}" se répète. Reste concentré sur ce mouvement.`);
                            return []; // Reset after intervention
                        }
                        return newHistory;
                    });
                }
            }

            // --- Particle System Animation ---
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext("2d")!;
                particlesRef.current = particlesRef.current.filter(p => p.life > 0);
                particlesRef.current.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.1; // gravity
                    p.life -= 0.02;
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.life;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        }

        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [ghostMode, autoFeedback]); // ghostMode & autoFeedback needed for loop updates

    const startCamera = useCallback(async () => {
        stopCamera();
        try {
            const constraints = {
                video: {
                    facingMode: facingModeRef.current,
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 360 },
                },
                audio: false, // Audio for voice is handled separately via SpeechRecognition API
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Explicitly call play() — essential for Safari mobile
                try {
                    await videoRef.current.play();
                } catch (e) {
                    console.warn("Autoplay blocked, waiting for interaction", e);
                }
            }
        } catch (err) {
            console.error("Camera access error:", err);
            addToast("Impossible d'accéder à la caméra. Vérifie les permissions.", "error");
        }
    }, [stopCamera, addToast]);

    /* ─── Buffer capture (1 fps) ─── */
    const captureFrameToBuffer = useCallback(() => {
        if (!canvasRef.current) return;
        const frame = canvasRef.current.toDataURL("image/jpeg", 0.5);
        frameBuffer.current.push(frame);
        if (frameBuffer.current.length > 10) frameBuffer.current.shift();
    }, []);

    /* ─── Particles ─── */
    const triggerParticles = () => {
        if (!canvasRef.current) return;
        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        for (let i = 0; i < 40; i++) {
            particlesRef.current.push({
                x: w / 2,
                y: h / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1,
                color: i % 2 === 0 ? "#FFD700" : "#FFA500" // Gold & Orange
            });
        }
    };

    /* ─── Edge audio ─── */
    const triggerEdgeAudio = (message: string) => {
        const now = Date.now();
        if (now - lastSpeechTimeRef.current < 5000) return;
        lastSpeechTimeRef.current = now;
        if (typeof window !== "undefined" && window.speechSynthesis?.speaking) return;
        const u = new SpeechSynthesisUtterance(message);
        u.lang = "fr-FR";
        u.rate = 1.15;
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
    };

    /* ─── Auto AI feedback every 30s ─── */
    const startAutoFeedback = useCallback(() => {
        if (autoFeedbackTimerRef.current) clearInterval(autoFeedbackTimerRef.current);
        autoFeedbackTimerRef.current = setInterval(async () => {
            if (frameBuffer.current.length < 3) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const res = await fetch("/api/coach", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        prompt: "Donne un conseil technique rapide (1-2 phrases max) basé sur ces frames. Sois direct et précis.",
                        frames: frameBuffer.current.slice(-4),
                    }),
                });
                const data = await res.json();
                if (data.reply) {
                    setAiResponse(data.reply);
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(data.reply);
                    u.lang = "fr-FR";
                    u.rate = 1.1;
                    window.speechSynthesis.speak(u);
                    // Auto-dismiss after 8s
                    setTimeout(() => setAiResponse(""), 8000);
                }
            } catch {
                // Silent fail for auto feedback
            }
        }, 30000);
    }, []);

    const stopAutoFeedback = useCallback(() => {
        if (autoFeedbackTimerRef.current) {
            clearInterval(autoFeedbackTimerRef.current);
            autoFeedbackTimerRef.current = null;
        }
    }, []);

    /* ─── Init MediaPipe ─── */
    useEffect(() => {
        let active = true;
        let wakeLock: any = null;

        const requestWakeLock = async () => {
            try {
                if ("wakeLock" in navigator)
                    wakeLock = await (navigator as any).wakeLock.request("screen");
            } catch { /* not supported */ }
        };
        requestWakeLock();

        const initMP = async () => {
            try {
                const mp = await import("@mediapipe/tasks-vision");
                const { PoseLandmarker, FilesetResolver, DrawingUtils } = mp;

                poseConnectionsRef.current = PoseLandmarker.POSE_CONNECTIONS;

                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
                );
                const pl = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.5,
                    minPosePresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                if (active) {
                    poseLandmarkerRef.current = pl;
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext("2d");
                        if (ctx) drawingUtilsRef.current = new DrawingUtils(ctx);
                    }
                    setIsReady(true);
                    startCamera();
                }
            } catch (err) {
                console.error("MediaPipe init error:", err);
                addToast("Erreur d'initialisation MediaPipe.", "error");
            }
        };
        initMP();

        const bufferInterval = setInterval(captureFrameToBuffer, 1000);

        return () => {
            active = false;
            clearInterval(bufferInterval);
            stopCamera();
            stopAutoFeedback();
            cancelAnimationFrame(requestRef.current);
            poseLandmarkerRef.current?.close();
            if (wakeLock) wakeLock.release().catch(() => { });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facingMode]);

    // Manage auto feedback based on toggle
    useEffect(() => {
        if (autoFeedback && isReady) startAutoFeedback();
        else stopAutoFeedback();
        return () => stopAutoFeedback();
    }, [autoFeedback, isReady, startAutoFeedback, stopAutoFeedback]);

    /* ─── Camera flip ─── */
    const toggleCamera = () =>
        setFacingMode((p) => (p === "user" ? "environment" : "user"));

    /* ─── Recording ─── */
    const startRecording = () => {
        if (!streamRef.current) return;
        recordedChunks.current = [];
        recordStartTimeRef.current = Date.now();
        try {
            mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
                mimeType: "video/webm;codecs=vp9,opus",
            });
        } catch {
            mediaRecorderRef.current = new MediaRecorder(streamRef.current);
        }
        mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.current.push(e.data);
        };
        mediaRecorderRef.current.onstop = saveSession;
        mediaRecorderRef.current.start();
        setIsRecording(true);
        addToast("Enregistrement démarré.", "info");
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const saveSession = async () => {
        addToast("Sauvegarde en cours…", "info");
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        const fileName = `session_${Date.now()}.webm`;
        const durationSeconds = Math.round((Date.now() - recordStartTimeRef.current) / 1000);

        const { error: uploadError } = await supabase.storage
            .from("sessions_videos")
            .upload(fileName, blob);
        if (uploadError) {
            addToast("Échec upload vidéo.", "error");
            return;
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("sessions_videos").getPublicUrl(fileName);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user) {
            const { error: dbError } = await supabase.from("sessions").insert({
                user_id: user.id,
                video_url: publicUrl,
                duration_seconds: durationSeconds,
            });
            if (dbError) addToast("Erreur sauvegarde session.", "error");
            else addToast(`Session enregistrée ! (${Math.floor(durationSeconds / 60)}m${durationSeconds % 60}s)`, "success");
        }
        recordedChunks.current = [];
    };

    /* ─── Voice command ─── */
    const activateVoice = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            addToast("Reconnaissance vocale non supportée.", "error");
            return;
        }
        const rec = new SR();
        rec.lang = "fr-FR";
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onstart = () => setIsListening(true);
        rec.onresult = async (e: any) => {
            const transcript = e.results[0][0].transcript.toLowerCase();
            setIsListening(false);
            setUserTranscript(transcript);

            // Check for success commands
            if (transcript.includes("panier") || transcript.includes("swish") || transcript.includes("dedans")) {
                setMadeShots(m => m + 1);
                addToast("Panier enregistré ! 🏀", "success");
                triggerParticles();
                // Clear transcript after 3s
                setTimeout(() => setUserTranscript(""), 3000);
            } else {
                await sendToGemini(transcript);
            }
        };
        rec.onerror = (e: any) => {
            setIsListening(false);
            addToast(`Erreur micro: ${e.error}`, "error");
        };
        rec.onend = () => setIsListening(false);
        rec.start();
    };

    const sendToGemini = async (question: string) => {
        setIsAnalyzing(true);
        setAiResponse("");
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) throw new Error("Non authentifié");

            const res = await fetch("/api/coach", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    prompt: question,
                    frames: frameBuffer.current,
                }),
            });
            const data = await res.json();
            if (data.reply) {
                setAiResponse(data.reply);
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(data.reply);
                u.lang = "fr-FR";
                window.speechSynthesis.speak(u);
            } else {
                addToast(data.error || "Pas de réponse IA.", "error");
            }
        } catch {
            addToast("Erreur communication IA.", "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    /* ─── Score color ─── */
    const scoreColor =
        poseScore >= 80
            ? "text-green-500"
            : poseScore >= 50
                ? "text-yellow-500"
                : "text-red-500";

    /* ─── Render ─── */
    return (
        <div className="relative w-full h-[100dvh] bg-black overflow-hidden flex flex-col items-center justify-center">
            {!isReady && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black gap-4">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-white font-bold text-base">
                        Initialisation moteur 3D…
                    </p>
                </div>
            )}

            <video
                ref={videoRef}
                className="hidden"
                playsInline
                autoPlay
                muted
                onLoadedMetadata={() => {
                    // Start detection once metadata (size) is known
                    predictWebcam();
                }}
            />
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-contain bg-black"
            />

            {/* HUD Top - Score + Jump Counter */}
            <div className="absolute top-4 left-4 right-4 flex justify-between z-10">
                <div className="glass border border-neutral-700 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <Zap className={`w-5 h-5 ${scoreColor}`} />
                    <div>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                            Score
                        </span>
                        <span className={`text-xl font-black leading-none ${scoreColor}`}>
                            {poseScore}
                        </span>
                    </div>
                </div>

                <div className="glass border border-neutral-700 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <Activity className="text-orange-500 w-5 h-5" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-neutral-400 font-bold uppercase block">
                            Stats
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-white leading-none">
                                {madeShots}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-bold">
                                /{jumpCount}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Shot Phase Badge (Elite Feature) */}
            <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                <motion.div
                    animate={{ scale: currentPhase !== "IDLE" ? 1.1 : 1 }}
                    className={`px-4 py-1.5 rounded-full text-xs font-black tracking-tighter border transition-all ${currentPhase === "RELEASE" ? "bg-red-600 border-red-400 text-white shadow-lg shadow-red-500/50" :
                        currentPhase === "SET" ? "bg-orange-600 border-orange-400 text-white" :
                            currentPhase === "DIP" ? "bg-blue-600 border-blue-400 text-white" :
                                "bg-black/40 border-white/10 text-neutral-400"
                        }`}>
                    {currentPhase === "IDLE" ? "PHASE : ATTENTE" : `PHASE : ${currentPhase}`}
                </motion.div>

                {/* Stability Meter */}
                <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden mt-1 backdrop-blur-sm border border-white/5">
                    <motion.div
                        animate={{ width: `${stabilityScore}%`, backgroundColor: stabilityScore > 80 ? "#22c55e" : stabilityScore > 50 ? "#eab308" : "#ef4444" }}
                        className="h-full transition-all duration-300"
                    />
                </div>
                <span className="text-[8px] text-white/40 font-bold tracking-widest uppercase">Stability {stabilityScore}%</span>
            </div>

            {/* Ghost Mode & Auto-feedback Toggles */}
            <div className="absolute top-20 right-4 z-10 flex flex-col gap-2 items-end">
                <button
                    onClick={() => setAutoFeedback(!autoFeedback)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${autoFeedback
                        ? "bg-orange-600/80 text-white"
                        : "glass text-neutral-400 border border-neutral-700"
                        }`}
                >
                    Auto IA {autoFeedback ? "ON" : "OFF"}
                </button>
                <button
                    onClick={() => setGhostMode(!ghostMode)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${ghostMode
                        ? "bg-purple-600/80 text-white shadow-lg shadow-purple-500/30"
                        : "glass text-neutral-400 border border-neutral-700"
                        }`}
                >
                    Ghost Mode {ghostMode ? "ON" : "OFF"}
                </button>
            </div>

            {/* Visual Transcript */}
            {userTranscript && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 text-white text-center"
                    >
                        <p className="text-xs text-neutral-400 uppercase font-black tracking-widest mb-1">Tu as dit</p>
                        <p className="text-lg font-bold">&quot;{userTranscript}&quot;</p>
                    </motion.div>
                </div>
            )}

            {/* AI response overlay */}
            {aiResponse && (
                <div
                    className="absolute top-28 mx-4 glass text-white p-4 rounded-2xl border border-orange-500/50 z-10 max-h-40 overflow-y-auto"
                    onClick={() => setAiResponse("")}
                >
                    <h3 className="text-orange-500 font-black uppercase text-[10px] tracking-wider mb-2">
                        Coach Gemini
                    </h3>
                    <p className="text-sm font-medium leading-relaxed">
                        {aiResponse}
                    </p>
                </div>
            )}

            {/* Listening indicator */}
            {isListening && (
                <div className="absolute top-28 glass text-white px-5 py-2.5 rounded-full z-10 animate-pulse font-bold text-sm flex items-center border border-blue-500/50">
                    <Mic className="w-4 h-4 mr-2 animate-bounce text-blue-500" />
                    Écoute…
                </div>
            )}

            {/* Analyzing indicator */}
            {isAnalyzing && (
                <div className="absolute top-28 glass text-white px-5 py-2.5 rounded-full z-10 animate-pulse font-bold text-sm border border-orange-500/50">
                    Analyse IA…
                </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 glass px-3 py-1.5 rounded-full border border-red-500/50">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-red-400">REC</span>
                </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-10 flex items-center gap-5 z-10">
                <button
                    onClick={toggleCamera}
                    className="p-4 glass border border-neutral-700 rounded-full text-white active:bg-neutral-700 transition"
                >
                    <RefreshCcw size={24} />
                </button>

                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        className="p-5 bg-orange-600 rounded-full text-white active:bg-orange-700 transition glow-orange"
                    >
                        <Circle size={28} className="fill-current" />
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="p-5 bg-red-600 rounded-full text-white active:bg-red-700 transition glow-red animate-pulse"
                    >
                        <Square size={28} className="fill-current" />
                    </button>
                )}

                <button
                    onClick={activateVoice}
                    className="p-4 bg-blue-600 rounded-full text-white active:bg-blue-700 transition glow-blue"
                >
                    <Mic size={24} />
                </button>
            </div>
        </div>
    );
}
