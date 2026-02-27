"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToastStore } from "@/store/toastStore";
import { motion, AnimatePresence } from "framer-motion";
import {
    type ShotSnapshot,
    type HandednessResult,
    createShotSnapshot,
    getShotConsistencyScore,
    updateHandednessVote,
    getFollowThroughScore,
    isFollowThroughHeld,
    detectBallInHand,
} from "@/lib/biomechanics";
import {
    getStabilityScore,
    calculateAngle,
    calculateJumpHeight,
    getPoseScore,
    getShotPhase,
    getJointVelocity,
    type ShotPhase,
    type Landmark
} from "@/lib/biomechanics";
import { Mic, Square, Circle, RefreshCcw, Bot, Flame, Activity, Gauge, Zap, Target, Crosshair } from "lucide-react";
import VoiceWaveIndicator from "./VoiceWaveIndicator";
import VoiceAssistantModal, { type VoiceStatus } from "./VoiceAssistantModal";
import * as THREE from "three";
import RadarChart from "./RadarChart";
import { vibrate } from "@/lib/utils";


class Particle {
    x: number; y: number; vx: number; vy: number; life: number; color: string;
    constructor(x: number, y: number, color: string, vx?: number, vy?: number) {
        this.x = x; this.y = y;
        this.vx = vx ?? (Math.random() - 0.5) * 12;
        this.vy = vy ?? (Math.random() - 0.5) * 14 - 4;
        this.life = 1.0;
        this.color = color;
    }
}

const ScoreRing = ({ value, color, label }: { value: number, color: string, label: string }) => {
    const radius = 18;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-11 h-11 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                    <circle cx="22" cy="22" r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
                    <motion.circle
                        cx="22" cy="22" r={radius} stroke={color} strokeWidth="3" fill="none"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        style={{ filter: `drop-shadow(0 0 5px ${color}80)` }}
                    />
                </svg>
                <span className="absolute text-[10px] font-black tabular-nums">{value}%</span>
            </div>
            <span className="text-[7px] text-white/40 font-black uppercase tracking-tighter">{label}</span>
        </div>
    );
};

const MetricGauge = ({ label, value, color }: { label: string, value: number, color: "blue" | "orange" }) => {
    const barColor = color === "blue" ? "bg-blue-500" : "bg-orange-500";
    const shadowColor = color === "blue" ? "shadow-blue-500/50" : "shadow-orange-500/50";
    return (
        <div className="flex flex-col gap-1 w-20">
            <div className="flex justify-between items-end">
                <span className="text-[7px] text-white/40 font-black uppercase">{label}</span>
                <span className="text-[9px] font-black tabular-nums">{value}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                    className={`h-full ${barColor} shadow-[0_0_8px] ${shadowColor}`}
                />
            </div>
        </div>
    );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// --- V11: Elite Three.js Ghost Component with V13 Fog ---
const ThreeGhost = ({ landmarks, visible }: { landmarks: Landmark[] | null, visible: boolean }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, lines: THREE.LineSegments } | null>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000005);
        // V13: Depth fog for 3D perception
        scene.fog = new THREE.FogExp2(0x000010, 0.3);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(120, 160);
        mount.appendChild(renderer.domElement);

        // V13: Neon glow material — High-intensity emission
        const material = new THREE.LineBasicMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending, // Better glow superposition
        });
        const geometry = new THREE.BufferGeometry();
        const lines = new THREE.LineSegments(geometry, material);
        scene.add(lines);

        // Multiple lights for bloom mimicry
        const mainLight = new THREE.PointLight(0x00f2ff, 2, 5);
        mainLight.position.set(0, 0, 1.5);
        scene.add(mainLight);

        const fillLight = new THREE.PointLight(0x3b82f6, 1, 3);
        fillLight.position.set(1, 1, 1);
        scene.add(fillLight);

        const camera = new THREE.PerspectiveCamera(50, 120 / 160, 0.1, 100);
        camera.position.z = 2;
        sceneRef.current = { scene, camera, renderer, lines };

        const animate = () => {
            if (!sceneRef.current) return;
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (mount && renderer.domElement) {
                mount.removeChild(renderer.domElement);
            }
            renderer.dispose();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!sceneRef.current || !landmarks || landmarks.length < 33) return;
        const { lines } = sceneRef.current;
        const positions: number[] = [];

        // Manual connections for a cleaner look
        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper
            [11, 23], [12, 24], [23, 24], // Torso
            [23, 25], [25, 27], [24, 26], [26, 28] // Lower
        ];

        connections.forEach(([i1, i2]) => {
            const p1 = landmarks[i1];
            const p2 = landmarks[i2];
            // Normalize & Center (MediaPipe 0,0 is top-left, 3D 0,0 is center)
            positions.push((p1.x - 0.5) * 2, -(p1.y - 0.5) * 2, (p1.z || 0) * 2);
            positions.push((p2.x - 0.5) * 2, -(p2.y - 0.5) * 2, (p2.z || 0) * 2);
        });

        lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        lines.geometry.attributes.position.needsUpdate = true;
    }, [landmarks]);

    if (!visible) return null;

    return (
        <div className="absolute top-24 right-4 z-20 pointer-events-none">
            <div className="glass-modern border border-blue-500/20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <div className="bg-blue-600/10 px-2 py-1 flex items-center justify-between border-b border-blue-500/10">
                    <span className="text-[7px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1">
                        <Activity size={8} className="animate-pulse" /> 3D Analysis
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                </div>
                <div ref={mountRef} className="w-[120px] h-[160px]" />
            </div>
        </div>
    );
};


export default function LiveTracker() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const poseLandmarkerRef = useRef<any>(null);
    const objectDetectorRef = useRef<any>(null);
    const poseConnectionsRef = useRef<any>(null);
    const drawingUtilsRef = useRef<any>(null);
    const requestRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastSpeechTimeRef = useRef<number>(0);
    const { addToast } = useToastStore();

    const [isRecording, setIsRecording] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
    const [aiResponse, setAiResponse] = useState("");
    const [isReady, setIsReady] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [shotCount, setShotCount] = useState(0);
    const [madeShots, setMadeShots] = useState(0);
    const [poseScore, setPoseScore] = useState(0);
    const [autoFeedback] = useState(true);
    const [userTranscript, setUserTranscript] = useState("");
    const [ghostMode, setGhostMode] = useState(true); // Default to true for Elite
    const [currentPhase, setCurrentPhase] = useState<ShotPhase>("IDLE");
    const [stabilityScore, setStabilityScore] = useState(100);
    const [streak, setStreak] = useState(0);
    const [maxJump, setMaxJump] = useState(0);
    const [airtime, setAirtime] = useState(0);
    const [explosivity, setExplosivity] = useState(0);
    const [coachPersona, setCoachPersona] = useState<"supportive" | "sergeant" | "mamba">("supportive");
    const [coachLanguage, setCoachLanguage] = useState<"fr" | "en">("fr");
    // --- V9: Apex-Vision State ---
    const [releaseAngle, setReleaseAngle] = useState(0);
    const [kneeBendDepth, setKneeBendDepth] = useState(0);
    const [symmetryScore] = useState(100);
    const [isVoiceContinuous] = useState(false);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [voiceConfidence, setVoiceConfidence] = useState(0);
    const [fpsDisplay, setFpsDisplay] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentLandmarks, setCurrentLandmarks] = useState<Landmark[] | null>(null);
    // --- V13: New Feature States ---
    const [followThroughScore, setFollowThroughScore] = useState(0);
    const [handedness, setHandedness] = useState<HandednessResult>({ hand: "right", confidence: 0, votes: [] });
    const [consistencyScore, setConsistencyScore] = useState(0);
    const [showRadar, setShowRadar] = useState(false);
    const [ballDetected, setBallDetected] = useState(false);
    const [compactHUD, setCompactHUD] = useState(false);
    const [phasePopup, setPhasePopup] = useState<string | null>(null);
    const [edgeFlash, setEdgeFlash] = useState(false);

    // --- Elite Refs ---
    const trailPointsRef = useRef<{ x: number, y: number, life: number }[]>([]);
    const peakHipYRef = useRef<number>(1);

    // --- Phase 2: Make/Miss & Gamification refs ---
    const lastShotTimeRef = useRef<number>(0);
    const hoopTargetRef = useRef<{ x: number, y: number, radius: number }>({ x: 0.5, y: 0.2, radius: 0.1 });
    const [shotPositions, setShotPositions] = useState<{ x: number, y: number, made: boolean }[]>([]);
    const [hoopMode, setHoopModeState] = useState(false);
    const hoopModeRef = useRef(false);
    const setHoopMode = (val: boolean) => {
        hoopModeRef.current = val;
        setHoopModeState(val);
    };
    const [drillActive, setDrillActive] = useState(false);
    const drillActiveRef = useRef(false);
    const drillTargetRef = useRef<{ x: number, y: number }>({ x: 0.2, y: 0.3 });
    const [drillScore, setDrillScore] = useState(0);
    const setDrillState = (val: boolean) => {
        drillActiveRef.current = val;
        setDrillActive(val);
        if (val) {
            setDrillScore(0);
            drillTargetRef.current = { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.2 };
        }
    };
    const [swishAnim, setSwishAnim] = useState(false);

    // --- Omniscience Refs ---
    const particlesRef = useRef<Particle[]>([]);
    const prevLandmarksRef = useRef<Landmark[] | null>(null);
    const emaLandmarksRef = useRef<Landmark[] | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const airtimeStartRef = useRef<number | null>(null);
    const initialHipYRef = useRef<number | null>(null);

    // --- Quantum-Fusion Refs ---
    const dipStartTimeRef = useRef<number | null>(null);
    const pulsePhaseRef = useRef<number>(0);
    const lastShotDataRef = useRef<any>(null);
    const recognitionRef = useRef<any>(null);
    const isVoiceActiveRef = useRef(false);
    const lastWristRef = useRef<{ x: number, y: number } | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<BlobPart[]>([]);
    const frameBuffer = useRef<string[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const facingModeRef = useRef(facingMode);
    const recordStartTimeRef = useRef<number>(0);
    const autoFeedbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // --- V10: EMA smoothing refs ---
    const emaRef = useRef({ score: 0, stability: 100, explosivity: 0, symmetry: 100, jump: 0 });
    // --- V10: FPS counter ---
    const fpsFrameCountRef = useRef(0);
    const fpsLastSecRef = useRef(performance.now());
    const fpsDisplayRef = useRef(0);
    // --- V10: Audio stream for waveform ---
    const audioStreamRef = useRef<MediaStream | null>(null);
    // --- V11: Elite Native Audio Speech queue ---
    const speechQueueRef = useRef<{ text: string; audio?: string }[]>([]);
    const isSpeakingRef = useRef(false);
    const assistantAudioRef = useRef<HTMLAudioElement | null>(null);
    // --- V12: Conversational Memory ---
    const chatHistoryRef = useRef<{ role: "user" | "model"; text: string }[]>([]);
    // --- V12: Proactive Coaching Event Trackers ---
    const consecutiveBadShotsRef = useRef(0);
    const lastProactiveTriggerRef = useRef(0);
    // --- V13: Follow-Through frame counter ---
    const followThroughFramesRef = useRef(0);
    // --- V13: Shot snapshots for consistency ---
    const shotSnapshotsRef = useRef<ShotSnapshot[]>([]);
    // --- V13: Last phase for transition detection ---
    const lastPhaseRef = useRef<string>("IDLE");

    useEffect(() => {
        facingModeRef.current = facingMode;
    }, [facingMode]);

    /* ─── Camera helpers ─── */
    const toggleCamera = useCallback(() => {
        vibrate(20);
        setFacingMode((p) => (p === "user" ? "environment" : "user"));
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    }, []);

    /* ─── Particles ─── */
    const triggerParticles = useCallback(() => {
        if (!canvasRef.current) return;
        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        for (let i = 0; i < 40; i++) {
            particlesRef.current.push(new Particle(w / 2, h / 2, i % 2 === 0 ? "#FFD700" : "#FFA500"));
        }
    }, []);

    /* ─── Speech Queue (V11: Elite Native Audio) ─── */
    const processSpeechQueue = useCallback(async () => {
        if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
        const item = speechQueueRef.current.shift()!;
        isSpeakingRef.current = true;

        if (item.audio) {
            // Play Native Gemini Audio (Studio Quality)
            try {
                const mimeType = (item as any).mimeType || "audio/wav";
                const blob = await (await fetch(`data:${mimeType};base64,${item.audio}`)).blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                assistantAudioRef.current = audio;

                // Track playback for waveform (optional, but good for UI)
                audio.onended = () => {
                    isSpeakingRef.current = false;
                    URL.revokeObjectURL(url);
                    setTimeout(processSpeechQueue, 200);
                };
                audio.onerror = () => {
                    isSpeakingRef.current = false;
                    setTimeout(processSpeechQueue, 200);
                };
                audio.play();
            } catch (err) {
                console.error("Audio playback error:", err);
                isSpeakingRef.current = false;
                setTimeout(processSpeechQueue, 200);
            }
        } else {
            // Fallback to Browser Synthesis (Legacy)
            const u = new SpeechSynthesisUtterance(item.text);
            u.lang = coachLanguage === "fr" ? "fr-FR" : "en-US";
            u.rate = coachPersona === "sergeant" ? 1.3 : 1.1;
            u.volume = 0.9;
            const voices = window.speechSynthesis?.getVoices() || [];
            const preferred = voices.find(v =>
                (v.name.includes("Google") || v.name.includes("Microsoft")) &&
                v.lang.startsWith(coachLanguage === "fr" ? "fr" : "en")
            ) || voices.find(v => v.lang.startsWith(coachLanguage === "fr" ? "fr" : "en"));
            if (preferred) u.voice = preferred;
            u.onend = () => {
                isSpeakingRef.current = false;
                setTimeout(processSpeechQueue, 200);
            };
            u.onerror = () => {
                isSpeakingRef.current = false;
                setTimeout(processSpeechQueue, 200);
            };
            window.speechSynthesis.speak(u);
        }
    }, [coachLanguage, coachPersona]);

    /* ─── Edge audio ─── */
    const triggerEdgeAudio = useCallback((message: string) => {
        const now = Date.now();
        if (now - lastSpeechTimeRef.current < 4000) return;
        lastSpeechTimeRef.current = now;
        if (speechQueueRef.current.length >= 2) return; // Max 2 queued
        speechQueueRef.current.push({ text: message });
        processSpeechQueue();
    }, [processSpeechQueue]);

    /* ─── AI Coach Engine ─── */
    const sendToGemini = useCallback(async (question: string) => {
        setIsAnalyzing(true);
        setVoiceStatus("analyzing");
        setAiResponse("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Non authentifié");

            const res = await fetch("/api/coach", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    prompt: question,
                    frames: frameBuffer.current.slice(-5), // V13: limit to max 5 to reduce wait time
                    metrics: {
                        stabilityScore: Math.round(emaRef.current.stability),
                        explosivity: Math.round(emaRef.current.explosivity),
                        maxJump: Math.round(maxJump),
                        airtime: airtime,
                        releaseAngle: releaseAngle,
                        kneeBendDepth: kneeBendDepth,
                        shotCount: shotCount,
                        madeShots: madeShots,
                    },
                    history: chatHistoryRef.current.slice(-10),
                    coachPersona: coachPersona,
                }),
            });
            const data = await res.json();
            if (data.reply) {
                chatHistoryRef.current.push({ role: "user", text: question });
                chatHistoryRef.current.push({ role: "model", text: data.reply });
                if (chatHistoryRef.current.length > 10) chatHistoryRef.current = chatHistoryRef.current.slice(-10);

                setAiResponse(data.reply);
                speechQueueRef.current.push({ text: data.reply, audio: data.audio, mimeType: (data as any).mimeType } as any);
                processSpeechQueue();

                if (data.action) {
                    switch (data.action) {
                        case "TOGGLE_GHOST": setGhostMode(g => !g); break;
                        case "SET_SERGEANT": setCoachPersona("sergeant"); break;
                        case "SET_SUPPORTIVE": setCoachPersona("supportive"); break;
                        case "SUMMARY": triggerEdgeAudio(coachLanguage === "fr" ? `Bilan : ${shotCount} tirs.` : `Summary: ${shotCount} shots taken.`); break;
                        case "RECALL_LAST":
                            if (lastShotDataRef.current) {
                                triggerEdgeAudio(coachLanguage === "fr" ? "Voici tes dernières stats." : "Here are your latest stats.");
                            }
                            break;
                    }
                }
                setTimeout(() => { if (!isVoiceActiveRef.current) setVoiceStatus("idle"); }, 1500);
                setTimeout(() => setAiResponse(""), 10000);
            } else {
                addToast(data.error || "Pas de réponse IA.", "error");
                setVoiceStatus("idle");
            }
        } catch (error: any) {
            console.error("Gemini Error:", error);
            addToast("Erreur communication IA.", "error");
            setVoiceStatus("idle");
        } finally {
            setIsAnalyzing(false);
        }
    }, [coachLanguage, coachPersona, maxJump, airtime, releaseAngle, kneeBendDepth, shotCount, madeShots, processSpeechQueue, setGhostMode, setCoachPersona, triggerEdgeAudio, addToast]);

    // --- V12: Proactive Event-Triggered Coaching ---
    const triggerProactiveCoaching = useCallback((event: "bad_shot" | "record_jump" | "idle_too_long") => {
        const now = Date.now();
        if (now - lastProactiveTriggerRef.current < 15000) return; // 15s cooldown
        if (isSpeakingRef.current || isVoiceModalOpen) return;
        lastProactiveTriggerRef.current = now;

        const prompts: Record<string, string> = {
            bad_shot: coachLanguage === "fr"
                ? "3 tirs consécutifs sous 60% de forme. Analyse les frames et donne une correction technique précise."
                : "3 consecutive shots below 60% form. Analyze frames and give a precise technical correction.",
            record_jump: coachLanguage === "fr"
                ? "Record de détente battu ! Félicite brièvement et analyse la forme du dernier saut."
                : "Jump height record broken! Briefly congratulate and analyze the form of the last jump.",
            idle_too_long: coachLanguage === "fr"
                ? "Le joueur est immobile depuis plus d'une minute. Motive-le à reprendre le travail."
                : "Player has been idle for over a minute. Motivate them to get back to work.",
        };

        sendToGemini(prompts[event]);
    }, [coachLanguage, isVoiceModalOpen, sendToGemini]);


    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        // --- FPS calculation ---
        fpsFrameCountRef.current++;
        const nowMs = performance.now();
        if (nowMs - fpsLastSecRef.current >= 1000) {
            fpsDisplayRef.current = fpsFrameCountRef.current;
            setFpsDisplay(fpsFrameCountRef.current);
            fpsFrameCountRef.current = 0;
            fpsLastSecRef.current = nowMs;
        }

        if (lastVideoTimeRef.current !== video.currentTime) {
            lastVideoTimeRef.current = video.currentTime;
            const results = poseLandmarkerRef.current.detectForVideo(video, nowMs);

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (results.landmarks && results.landmarks.length > 0) {
                const rawLm = results.landmarks[0] as Landmark[];

                // Universal EMA Landmark Smoothing (V14)
                const SMOOTH_FACTOR = 0.5; // 50% new frame, 50% history = buttery smooth tracking
                if (emaLandmarksRef.current) {
                    emaLandmarksRef.current = rawLm.map((pt, i) => {
                        const prev = emaLandmarksRef.current![i];
                        return {
                            x: prev.x + (pt.x - prev.x) * SMOOTH_FACTOR,
                            y: prev.y + (pt.y - prev.y) * SMOOTH_FACTOR,
                            z: pt.z !== undefined && prev.z !== undefined ? prev.z + (pt.z - prev.z) * SMOOTH_FACTOR : pt.z,
                            visibility: pt.visibility
                        };
                    });
                } else {
                    emaLandmarksRef.current = [...rawLm];
                }
                const lm = emaLandmarksRef.current;

                const w = canvas.width;
                const h = canvas.height;
                const dt = nowMs - (lastFrameTimeRef.current || nowMs);
                lastFrameTimeRef.current = nowMs;

                // --- Neural Pulse Phase ---
                pulsePhaseRef.current = (pulsePhaseRef.current + 0.08) % (Math.PI * 2);

                // --- 1. Phase Detection & Biomechanics Logic ---
                const phase = getShotPhase(lm);

                // V13: Phase-Transition Animations
                if (phase !== lastPhaseRef.current) {
                    setCurrentPhase(phase);
                    // Edge flash on any phase transition
                    if (lastPhaseRef.current !== "IDLE" || phase !== "IDLE") {
                        setEdgeFlash(true);
                        setTimeout(() => setEdgeFlash(false), 300);
                    }
                    // Phase popup text
                    if (phase !== "IDLE") {
                        setPhasePopup(phase === "RELEASE" ? "RELEASE!" : phase === "SET" ? "SET!" : phase === "DIP" ? "DIP" : "");
                        setTimeout(() => setPhasePopup(null), 800);
                    }

                    // V13: Event-triggered frame capture (Frame Buffer Intelligence)
                    if (phase === "DIP" || phase === "SET" || phase === "RELEASE") {
                        // Rapid 3-frame burst capture during key transitions
                        if (canvasRef.current) {
                            const frame = canvasRef.current.toDataURL("image/jpeg", 0.5);
                            frameBuffer.current.push(frame);
                            if (frameBuffer.current.length > 15) frameBuffer.current = frameBuffer.current.slice(-15);
                        }
                    }

                    // Phase transitions logic
                    if (phase === "DIP" && !dipStartTimeRef.current) {
                        dipStartTimeRef.current = nowMs;
                        initialHipYRef.current = (lm[23].y + lm[24].y) / 2;
                        followThroughFramesRef.current = 0;
                    }
                    if (phase === "RELEASE") {
                        triggerParticles();
                        setShotCount(s => s + 1);

                        // Explosivity based on DIP duration
                        if (dipStartTimeRef.current) {
                            const dipDuration = nowMs - dipStartTimeRef.current;
                            const exp = Math.max(0, Math.min(100, 1000 - dipDuration) / 10);
                            setExplosivity(Math.round(exp));
                            dipStartTimeRef.current = null;
                        }

                        // Calculate metrics for the shot
                        const kneeAngle = calculateAngle(lm[23], lm[25], lm[27]);
                        setKneeBendDepth(Math.round(kneeAngle));

                        const elbowAngle = calculateAngle(lm[11], lm[13], lm[15]);
                        setReleaseAngle(Math.round(elbowAngle));

                        // V13: Shot Consistency Tracker — save snapshot
                        const snapshot = createShotSnapshot(lm);
                        shotSnapshotsRef.current.push(snapshot);
                        if (shotSnapshotsRef.current.length > 10) shotSnapshotsRef.current = shotSnapshotsRef.current.slice(-10);
                        setConsistencyScore(getShotConsistencyScore(shotSnapshotsRef.current));

                        // V12: Track consecutive bad shots for proactive coaching
                        const shotScore = getPoseScore(lm);
                        if (shotScore < 60) {
                            consecutiveBadShotsRef.current++;
                            if (consecutiveBadShotsRef.current >= 3) {
                                triggerProactiveCoaching("bad_shot");
                                consecutiveBadShotsRef.current = 0;
                            }
                        } else {
                            consecutiveBadShotsRef.current = 0;
                        }

                        if (autoFeedback) triggerEdgeAudio(shotScore > 85 ? "Excellent geste." : "Tir détecté.");

                        // V13: Show Radar for 5s
                        setShowRadar(true);
                        setTimeout(() => setShowRadar(false), 5000);

                        // Store shot data for recall
                        lastShotDataRef.current = { kneeAngle: Math.round(kneeAngle), elbowAngle: Math.round(elbowAngle), score: shotScore };
                        followThroughFramesRef.current = 0;
                    }
                    if (phase === "FOLLOW_THROUGH") {
                        if (nowMs - lastProactiveTriggerRef.current > 60000) {
                            triggerEdgeAudio(coachLanguage === "fr" ? "Besoin d'aide ? Pose une question." : "Need help? Ask a question.");
                            lastProactiveTriggerRef.current = nowMs;
                        }
                    }
                    lastPhaseRef.current = phase;
                }

                // V13: Follow-Through Persistence tracking (count frames)
                if (phase === "FOLLOW_THROUGH" || phase === "RELEASE") {
                    if (isFollowThroughHeld(lm)) {
                        followThroughFramesRef.current++;
                        setFollowThroughScore(getFollowThroughScore(followThroughFramesRef.current));
                    }
                }

                // V13: Handedness Auto-Detection (rolling vote)
                if (phase !== "IDLE") {
                    const result = updateHandednessVote(lm, handedness.votes);
                    if (result.confidence !== handedness.confidence || result.hand !== handedness.hand) {
                        setHandedness(result);
                    }
                }

                // V13: Ball Detection
                const hasBall = detectBallInHand(lm);
                if (hasBall !== ballDetected) setBallDetected(hasBall);

                // --- Phase 2: Make/Miss Detection ---
                if (objectDetectorRef.current && hoopModeRef.current) {
                    const objResults = objectDetectorRef.current.detectForVideo(video, nowMs);
                    if (objResults.detections.length > 0) {
                        const ball = objResults.detections[0].boundingBox;
                        const nx = (ball.originX + ball.width / 2) / video.videoWidth;
                        const ny = (ball.originY + ball.height / 2) / video.videoHeight;

                        const hoop = hoopTargetRef.current;
                        const dist = Math.sqrt(Math.pow(nx - hoop.x, 2) + Math.pow(ny - hoop.y, 2));

                        if (dist < hoop.radius && (nowMs - lastShotTimeRef.current > 2000)) {
                            setMadeShots(m => m + 1);
                            setStreak(s => s + 1);
                            setSwishAnim(true);
                            vibrate([50, 50, 100]);
                            setTimeout(() => setSwishAnim(false), 1500);
                            if (autoFeedback) triggerEdgeAudio(coachLanguage === "fr" ? "Boom ! Dans le mille !" : "Swish!");
                            setShotPositions(prev => [...prev, { x: nx, y: ny, made: true }]);
                            lastShotTimeRef.current = nowMs;
                        }
                    }
                    // Visual Hoop Target Overlay on canvas
                    const hx = hoopTargetRef.current.x * w;
                    const hy = hoopTargetRef.current.y * h;
                    const hr = hoopTargetRef.current.radius * Math.min(w, h);
                    ctx.beginPath();
                    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
                    ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
                    ctx.lineWidth = 3;
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // --- Phase 2: AR Agility Drill (Reaction) ---
                if (drillActiveRef.current) {
                    const rX = lm[16].x; const rY = lm[16].y; // Right wrist
                    const lX = lm[15].x; const lY = lm[15].y; // Left wrist
                    const target = drillTargetRef.current;
                    const targetR = 0.08; // Target size

                    const distR = Math.sqrt(Math.pow(rX - target.x, 2) + Math.pow(rY - target.y, 2));
                    const distL = Math.sqrt(Math.pow(lX - target.x, 2) + Math.pow(lY - target.y, 2));

                    if (distR < targetR || distL < targetR) {
                        setDrillScore(s => s + 1);
                        vibrate(40);
                        triggerEdgeAudio(coachLanguage === "fr" ? "Bien joué !" : "Got it!");
                        // Spawn new target
                        drillTargetRef.current = { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.2 };

                        // Particle explosion at target
                        const tx = target.x * w; const ty = target.y * h;
                        for (let i = 0; i < 8; i++) {
                            particlesRef.current.push(new Particle(tx, ty, "#f97316"));
                        }
                    }

                    // Draw the Drill Target
                    const tx = target.x * w;
                    const ty = target.y * h;
                    const tr = targetR * Math.min(w, h);
                    ctx.beginPath();
                    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(249, 115, 22, 0.4)";
                    ctx.fill();
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = "rgba(249, 115, 22, 1)";
                    ctx.stroke();
                }

                // Jump Height & Airtime logic
                const currentHipY = (lm[23].y + lm[24].y) / 2;
                if (phase === "RELEASE" || phase === "FOLLOW_THROUGH") {
                    if (!airtimeStartRef.current) airtimeStartRef.current = nowMs;
                    if (currentHipY < peakHipYRef.current) peakHipYRef.current = currentHipY;
                } else if (phase === "IDLE" || phase === "DIP") {
                    if (airtimeStartRef.current) {
                        const duration = (nowMs - airtimeStartRef.current) / 1000;
                        setAirtime(Number(duration.toFixed(2)));

                        // calculateJumpHeight(landmarks: Landmark[], initialHipY: number)
                        const jump = calculateJumpHeight(lm, initialHipYRef.current || currentHipY);
                        if (jump > maxJump) setMaxJump(Math.round(jump));

                        // Reset for next shot
                        airtimeStartRef.current = null;
                        peakHipYRef.current = 1;
                    }
                }

                // --- 2. Visual Overlays ---
                if (drawingUtilsRef.current && poseConnectionsRef.current) {
                    poseConnectionsRef.current.forEach(([i1, i2]: [number, number]) => {
                        const p1 = lm[i1]; const p2 = lm[i2];
                        const prevP1 = prevLandmarksRef.current?.[i1] || null;
                        const v = getJointVelocity(p1, prevP1, dt);
                        const heat = Math.min(1, v / 0.015);

                        ctx.beginPath();
                        ctx.strokeStyle = `rgb(${Math.floor(heat * 255)}, ${Math.floor((1 - heat) * 150 + 100)}, ${Math.floor((1 - heat) * 255)})`;
                        ctx.lineWidth = 3;
                        ctx.moveTo(p1.x * w, p1.y * h);
                        ctx.lineTo(p2.x * w, p2.y * h);
                        ctx.stroke();
                    });

                    // Premium Skeleton Joints
                    drawingUtilsRef.current.drawLandmarks(lm, {
                        color: "rgba(255, 255, 255, 0.9)",
                        fillColor: "rgba(59, 130, 246, 0.8)", // Blue inner dot
                        lineWidth: 2,
                        radius: 3
                    });

                    // V12: Color-Coded Angle Labels at Key Joints
                    const drawAngleLabel = (a: Landmark, b: Landmark, c: Landmark, idealMin: number, idealMax: number) => {
                        const angle = Math.round(calculateAngle(a, b, c));
                        const inRange = angle >= idealMin && angle <= idealMax;
                        const borderline = Math.abs(angle - idealMin) < 10 || Math.abs(angle - idealMax) < 10;
                        const color = inRange ? "#22c55e" : borderline ? "#eab308" : "#ef4444";
                        const px = b.x * w;
                        const py = b.y * h;

                        // Glow circle
                        ctx.beginPath();
                        ctx.arc(px, py, 14, 0, Math.PI * 2);
                        ctx.fillStyle = `${color}33`;
                        ctx.fill();
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();

                        // Angle text
                        ctx.font = "bold 10px monospace";
                        ctx.fillStyle = color;
                        ctx.textAlign = "center";
                        ctx.fillText(`${angle}°`, px, py + 3);
                    };

                    // Right elbow angle (ideal: 80-100° for shooting)
                    drawAngleLabel(lm[12], lm[14], lm[16], 80, 100);
                    // Left elbow angle
                    drawAngleLabel(lm[11], lm[13], lm[15], 80, 100);
                    // Right knee angle (ideal: 130-165° for stability)
                    drawAngleLabel(lm[24], lm[26], lm[28], 130, 165);
                    // Left knee angle
                    drawAngleLabel(lm[23], lm[25], lm[27], 130, 165);
                }

                // V13: Ball-in-hand glow effect
                if (ballDetected) {
                    [15, 16].forEach(idx => {
                        const hand = lm[idx];
                        if (hand.visibility && hand.visibility > 0.5) {
                            const glow = ctx.createRadialGradient(hand.x * w, hand.y * h, 0, hand.x * w, hand.y * h, 25);
                            glow.addColorStop(0, "rgba(249, 115, 22, 0.5)");
                            glow.addColorStop(1, "transparent");
                            ctx.fillStyle = glow;
                            ctx.beginPath(); ctx.arc(hand.x * w, hand.y * h, 25, 0, Math.PI * 2); ctx.fill();
                        }
                    });
                }

                // V13: Shot Arc Trajectory Prediction (during RELEASE)
                if (phase === "RELEASE" || phase === "SET") {
                    const wrist = lm[handedness.hand === "right" ? 16 : 15];
                    // Direction vector from previous frame for velocity
                    const dx = wrist.x - (lastWristRef.current?.x || wrist.x);
                    const dy = wrist.y - (lastWristRef.current?.y || wrist.y);
                    const vx = dx * 0.6;
                    const vy = dy * 0.6;
                    const speed = Math.sqrt(dx * dx + dy * dy);
                    const G = 0.12; // simulated gravity

                    // High-Fidelity Arc with Glow
                    ctx.setLineDash([8, 12]);
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = "rgba(59, 130, 246, 0.8)";
                    ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(wrist.x * w, wrist.y * h);
                    for (let t = 0; t < 60; t++) {
                        const px = wrist.x * w + vx * t * 0.15;
                        const py = wrist.y * h + vy * t * 0.15 + 0.5 * G * t * t;
                        ctx.lineTo(px, py);
                        if (py > h) break;
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.shadowBlur = 0;

                    // Target circle at apex
                    const apexT = Math.abs(vy / (G || 1));
                    const apexX = wrist.x * w + vx * apexT * 0.15;
                    const apexY = wrist.y * h + vy * apexT * 0.15 + 0.5 * G * apexT * apexT;
                    if (apexY > 0 && apexY < h && speed > 20) {
                        ctx.beginPath();
                        ctx.arc(apexX, apexY, 12, 0, Math.PI * 2);
                        ctx.strokeStyle = "#3b82f6";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        // Inner dot pulse
                        ctx.beginPath();
                        ctx.arc(apexX, apexY, 4, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(59, 130, 246, ${0.5 + 0.5 * Math.sin(Date.now() / 200)})`;
                        ctx.fill();
                    }
                }

                // High-velocity halos
                [14, 13, 16, 15].forEach(idx => {
                    const j = lm[idx];
                    const v = getJointVelocity(j, prevLandmarksRef.current?.[idx] || null, dt);
                    if (v > 0.015) {
                        const radius = 15 + (v * 500);
                        const glow = ctx.createRadialGradient(j.x * w, j.y * h, 0, j.x * w, j.y * h, radius);
                        glow.addColorStop(0, `hsla(${Math.max(0, 200 - v * 2000)}, 100%, 50%, 0.4)`);
                        glow.addColorStop(1, "transparent");
                        ctx.fillStyle = glow;
                        ctx.beginPath(); ctx.arc(j.x * w, j.y * h, radius, 0, Math.PI * 2); ctx.fill();
                    }
                });

                // Metric Smoothing
                const rawScore = getPoseScore(lm);
                const rawStability = getStabilityScore(lm);
                const EMA_ALPHA = 0.15;
                emaRef.current.score = emaRef.current.score * (1 - EMA_ALPHA) + rawScore * EMA_ALPHA;
                emaRef.current.stability = emaRef.current.stability * (1 - EMA_ALPHA) + rawStability * EMA_ALPHA;
                setPoseScore(Math.round(emaRef.current.score));
                setStabilityScore(Math.round(emaRef.current.stability));

                // --- Neural-Mastery: Ambient Proactive Tips ---
                if (rawScore > 90 && Math.random() > 0.98) {
                    triggerEdgeAudio(coachLanguage === "fr" ? "Forme parfaite." : "Perfect form.");
                }

                // --- V11: Elite Visual Data Sync ---
                setCurrentLandmarks(lm);

                // Update Hand Trail (Elite Arc)
                const rightWrist = lm[16];
                if (rightWrist && rightWrist.visibility && rightWrist.visibility > 0.5) {
                    trailPointsRef.current.push({ x: rightWrist.x * w, y: rightWrist.y * h, life: 1.0 });
                }
                if (trailPointsRef.current.length > 20) trailPointsRef.current.shift();

                prevLandmarksRef.current = [...lm];
            }
            ctx.restore();
        }

        // --- Elite Visual Layers (Always Draw) ---
        // 1. High-Fidelity Shooting Arc Trail
        if (trailPointsRef.current.length > 2) {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = "rgba(249, 115, 22, 0.5)";

            for (let i = 0; i < trailPointsRef.current.length - 1; i++) {
                const pt = trailPointsRef.current[i];
                const nextPt = trailPointsRef.current[i + 1];

                // Update life (decay over time)
                pt.life -= 0.02;
                if (pt.life <= 0) continue;

                const progress = i / trailPointsRef.current.length;
                ctx.beginPath();
                ctx.strokeStyle = `rgba(249, 115, 22, ${pt.life * progress * 0.8})`;
                ctx.lineWidth = 6 * progress;
                ctx.lineCap = "round";
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(nextPt.x, nextPt.y);
                ctx.stroke();
            }
            trailPointsRef.current = trailPointsRef.current.filter(p => p.life > 0);
            ctx.restore();
        }

        // Particles & FX
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        particlesRef.current.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.02;
            ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;

        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [autoFeedback, triggerEdgeAudio, triggerParticles, maxJump, coachLanguage, handedness, ballDetected, triggerProactiveCoaching, setDrillScore]);



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

    /* ─── Buffer capture (V13: Intelligent — mostly idle skip, event capture in phase transitions) ─── */
    const captureFrameToBuffer = useCallback(() => {
        if (!canvasRef.current) return;
        // V13: Skip capture during IDLE phase (Frame Buffer Intelligence)
        const currentPh = lastPhaseRef.current;
        if (currentPh === "IDLE") return; // Don't waste buffer on idle
        const frame = canvasRef.current.toDataURL("image/jpeg", 0.5);
        frameBuffer.current.push(frame);
        if (frameBuffer.current.length > 15) frameBuffer.current = frameBuffer.current.slice(-15);
    }, []);



    /* ─── Auto AI feedback every 30s ─── */
    const startAutoFeedback = useCallback(() => {
        if (autoFeedbackTimerRef.current) clearInterval(autoFeedbackTimerRef.current);
        autoFeedbackTimerRef.current = setInterval(async () => {
            if (!autoFeedback || isVoiceModalOpen || isSpeakingRef.current) return;
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
                        prompt: coachLanguage === "fr"
                            ? "Donne un conseil technique rapide (1-2 phrases max) basé sur ces frames. Sois direct et précis."
                            : "Give a quick technical tip (1-2 sentences max) based on these frames. Be direct and precise.",
                        frames: frameBuffer.current.slice(-4),
                        metrics: {
                            stabilityScore: Math.round(emaRef.current.stability),
                            explosivity: Math.round(emaRef.current.explosivity),
                            maxJump: Math.round(maxJump),
                            airtime: airtime,
                            releaseAngle: releaseAngle,
                            kneeBendDepth: kneeBendDepth,
                            shotCount: shotCount,
                            madeShots: madeShots,
                        },
                        coachPersona: coachPersona,
                    }),
                });
                const data = await res.json();
                if (data.reply) {
                    setAiResponse(data.reply);
                    speechQueueRef.current.push({ text: data.reply, audio: data.audio, mimeType: data.mimeType } as any);
                    processSpeechQueue();

                    // V13: Structured Action Handling
                    if (data.action) {
                        console.log("Coach Action:", data.action);
                        switch (data.action) {
                            case "TOGGLE_GHOST": setGhostMode(g => !g); break;
                            case "SET_SERGEANT": setCoachPersona("sergeant"); break;
                            case "SET_SUPPORTIVE": setCoachPersona("supportive"); break;
                            case "SUMMARY": triggerEdgeAudio(coachLanguage === "fr" ? `Bilan : ${shotCount} tirs.` : `Summary: ${shotCount} shots taken.`); break;
                            case "RECALL_LAST":
                                if (lastShotDataRef.current) {
                                    triggerEdgeAudio(coachLanguage === "fr" ? "Voici tes dernières stats." : "Here are your latest stats.");
                                }
                                break;
                        }
                    }

                    setTimeout(() => setAiResponse(""), 10000);
                }
            } catch {
                // Silent fail for auto feedback
            }
        }, 30000);
    }, [autoFeedback, isVoiceModalOpen, coachLanguage, coachPersona, maxJump, airtime, releaseAngle, kneeBendDepth, shotCount, madeShots, processSpeechQueue, triggerEdgeAudio]);

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
                const { PoseLandmarker, ObjectDetector, FilesetResolver, DrawingUtils } = mp;

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

                const od = await ObjectDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    scoreThreshold: 0.3,
                    categoryAllowlist: ["sports ball"]
                });

                if (active) {
                    poseLandmarkerRef.current = pl;
                    objectDetectorRef.current = od;
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
    }, [facingMode, captureFrameToBuffer]);

    // Manage auto feedback based on toggle
    useEffect(() => {
        if (autoFeedback && isReady) startAutoFeedback();
        else stopAutoFeedback();
        return () => stopAutoFeedback();
    }, [autoFeedback, isReady, startAutoFeedback, stopAutoFeedback]);

    /* ─── Voice V10: activateVoice with modal ─── */
    const activateVoice = useCallback(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            addToast("Reconnaissance vocale non supportée.", "error");
            return;
        }
        // Open modal
        setIsVoiceModalOpen(true);
        setInterimTranscript("");
        setVoiceConfidence(0);

        // Capture audio stream for waveform
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(s => { audioStreamRef.current = s; })
            .catch(() => { /* no mic stream for waveform, fallback fine */ });

        const rec = new SR();
        rec.lang = coachLanguage === "fr" ? "fr-FR" : "en-US";
        rec.interimResults = true;  // V10: real-time partial transcript
        rec.maxAlternatives = 1;
        rec.continuous = isVoiceContinuous;

        rec.onstart = () => {
            setIsListening(true);
            setVoiceStatus("listening");
            isVoiceActiveRef.current = true;
        };
        rec.onresult = async (e: any) => {
            // Interim results for live display
            let interim = "";
            let final = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) {
                    final += e.results[i][0].transcript;
                    setVoiceConfidence(e.results[i][0].confidence);
                } else {
                    interim += e.results[i][0].transcript;
                }
            }
            if (interim) setInterimTranscript(interim);
            if (!final) return;

            const transcript = final.toLowerCase().trim();
            setInterimTranscript("");
            setIsListening(!isVoiceContinuous);
            setUserTranscript(transcript);

            if (transcript.includes("anglais") || transcript.includes("english")) {
                setCoachLanguage("en"); triggerEdgeAudio("English coaching ON."); return;
            }
            if (transcript.includes("français") || transcript.includes("french")) {
                setCoachLanguage("fr"); triggerEdgeAudio("Mode français activé."); return;
            }
            if (transcript.includes("fantôme") || transcript.includes("ghost") || transcript.includes("mirror")) {
                setGhostMode(g => !g); triggerEdgeAudio(!ghostMode ? "Ghost ON" : "Ghost OFF"); return;
            }
            if (transcript.includes("debri") || transcript.includes("dernier") || transcript.includes("analyze last") || transcript.includes("recall")) {
                if (lastShotDataRef.current) {
                    const { jumpHeight, stability, explosivity: exp } = lastShotDataRef.current as any;
                    const msg = coachLanguage === "fr"
                        ? `Dernier saut : ${jumpHeight} cm. Équilibre : ${stability}%. Explosivité : ${exp}%.`
                        : `Last jump: ${jumpHeight} cm. Stability: ${stability}%. Explosivity: ${exp}%.`;
                    triggerEdgeAudio(msg);
                } else { triggerEdgeAudio(coachLanguage === "fr" ? "Pas de données de saut." : "No jump data yet."); }
                return;
            }
            if (transcript.includes("agressif") || transcript.includes("sergent") || transcript.includes("angry")) {
                setCoachPersona("sergeant");
                triggerEdgeAudio(coachLanguage === "fr" ? "MODE SERGENT ACTIVÉ. TRAVAILLE PLUS DUR !" : "DRILL SERGEANT ON. MOVE FASTER!");
                return;
            }
            if (transcript.includes("encourage") || transcript.includes("gentil") || transcript.includes("nice")) {
                setCoachPersona("supportive");
                triggerEdgeAudio(coachLanguage === "fr" ? "Mode encourageant activé. On progresse ensemble." : "Supportive mode on. Let's grow together.");
                return;
            }
            if (transcript.includes("résume") || transcript.includes("summary") || transcript.includes("bilan")) {
                const msg = coachLanguage === "fr"
                    ? `Bilan : ${shotCount} tirs tentés, ${madeShots} réussis. Détente max : ${maxJump} centimètres. On continue !`
                    : `Summary: ${shotCount} shots taken, ${madeShots} made. Max leap: ${maxJump} centimeters. Finish strong!`;
                triggerEdgeAudio(msg);
                return;
            }
            if (transcript.includes("panier") || transcript.includes("swish") || transcript.includes("dedans") || transcript.includes("made")) {
                setMadeShots(m => {
                    const next = m + 1;
                    setStreak(s => s + 1);
                    return next;
                });
                addToast("SCORE! 🏀", "success");
                triggerParticles(); setTimeout(() => setUserTranscript(""), 3000);
            } else {
                setStreak(0); // Miss reset streak? (Actually user says "made", hard to detect miss)
                await sendToGemini(transcript);
            }
        };
        rec.onerror = (e: any) => {
            setIsListening(false);
            setVoiceStatus("idle");
            if (e.error !== "aborted") addToast(`Erreur micro: ${e.error}`, "error");
            // Stop audio stream
            audioStreamRef.current?.getTracks().forEach(t => t.stop());
            audioStreamRef.current = null;
        };
        rec.onend = () => {
            setIsListening(false);
            isVoiceActiveRef.current = false;
            if (!isVoiceContinuous) {
                // V10: cooldown before idle
                setVoiceStatus("cooldown");
                setTimeout(() => setVoiceStatus("idle"), 1500);
                // Stop audio stream
                setTimeout(() => {
                    audioStreamRef.current?.getTracks().forEach(t => t.stop());
                    audioStreamRef.current = null;
                }, 1600);
            } else {
                setTimeout(() => { if (isVoiceContinuous) rec.start(); }, 500);
            }
        };
        recognitionRef.current = rec;
        rec.start();
        isVoiceActiveRef.current = true;
    }, [coachLanguage, ghostMode, lastShotDataRef, shotCount, madeShots, maxJump, addToast, triggerEdgeAudio, triggerParticles, sendToGemini, isVoiceContinuous, setCoachPersona]);

    /* ─── Score color ─── */
    const scoreColorVal =
        poseScore >= 80
            ? "#22c55e"
            : poseScore >= 50
                ? "#eab308"
                : "#ef4444";

    /* ─── Recording ─── */
    const saveSession = async () => {
        addToast(coachLanguage === "fr" ? "Sauvegarde en cours…" : "Saving session...", "info");
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        const fileName = `session_${Date.now()}.webm`;
        const durationSeconds = Math.round((Date.now() - recordStartTimeRef.current) / 1000);

        try {
            const { error: uploadError } = await supabase.storage
                .from("sessions_videos")
                .upload(fileName, blob);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from("sessions_videos").getPublicUrl(fileName);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error: dbError } = await supabase.from("sessions").insert({
                    user_id: user.id,
                    video_url: publicUrl,
                    duration_seconds: durationSeconds,
                });
                if (dbError) throw dbError;
                addToast(coachLanguage === "fr" ? `Session enregistrée ! (${Math.floor(durationSeconds / 60)}m${durationSeconds % 60}s)` : `Session saved!`, "success");
            }
        } catch (err) {
            console.error("Save error:", err);
            addToast("Erreur sauvegarde.", "error");
        }
        recordedChunks.current = [];
    };

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
        addToast(coachLanguage === "fr" ? "Enregistrement démarré." : "Recording started.", "info");
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleCanvasClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!hoopModeRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        hoopTargetRef.current = { x, y, radius: 0.1 };
        vibrate(10);
        addToast(coachLanguage === "fr" ? "Arceau ciblé !" : "Hoop Target Set!", "success");
    };

    /* ─── Render ─── */
    return (
        <div className="relative w-full h-full overflow-hidden bg-black font-sans text-white">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" autoPlay playsInline muted onLoadedData={predictWebcam} />
            <canvas ref={canvasRef} onPointerDown={handleCanvasClick} className="absolute inset-0 w-full h-full object-cover" />

            {/* --- V11 Elite: 3D Analytical Ghost --- */}
            <ThreeGhost landmarks={currentLandmarks} visible={ghostMode} />

            {/* V13: Edge Flash on Phase Transition */}
            <AnimatePresence>
                {edgeFlash && (
                    <motion.div
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 pointer-events-none z-40 border-4 border-orange-500 rounded-none"
                        style={{ boxShadow: "inset 0 0 40px rgba(249,115,22,0.4)" }}
                    />
                )}
            </AnimatePresence>

            {/* V13: Phase Popup Text */}
            <AnimatePresence>
                {phasePopup && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.3 }}
                        transition={{ duration: 0.4, type: "spring" }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                        <span className="text-5xl font-black text-orange-500 drop-shadow-[0_0_20px_rgba(249,115,22,0.8)] tracking-tighter">
                            {phasePopup}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Elite Scanner Effect - Vertical sweep line */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
                <motion.div
                    animate={{ top: ["-10%", "110%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-x-0 h-[2px] bg-linear-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                />
            </div>

            <AnimatePresence>
                {!isReady && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black gap-6"
                    >
                        <div className="relative">
                            <div className="w-16 h-16 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                            <Bot className="absolute inset-0 m-auto text-orange-500 animate-pulse" size={32} />
                        </div>
                        <span className="text-white/40 text-xs font-black uppercase tracking-[0.2em]">Quantum Initialization...</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- Phase 2: Swish Overlay UI --- */}
            <AnimatePresence>
                {swishAnim && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.2, rotate: -20 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 1.5, rotate: 10 }}
                        transition={{ type: "spring", damping: 12, stiffness: 200 }}
                        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
                    >
                        <span className="text-7xl font-black italic text-green-500 uppercase tracking-tighter" style={{
                            textShadow: "0px 0px 30px rgba(34,197,94,0.8), 0px 0px 10px rgba(255,255,255,0.5)"
                        }}>
                            +1 Swish
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Elite HUD Overlays */}
            <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none p-4 md:p-6 flex flex-col justify-between items-stretch z-10">
                {/* Header Metrics */}
                <div className="flex justify-between items-start">
                    <div className="glass-panel p-4 rounded-3xl flex items-center gap-6 shadow-2xl">
                        {drillActive ? (
                            <div className="flex flex-col">
                                <span className="text-[10px] text-orange-400/80 font-semibold uppercase tracking-wider">Réaction Drill Score</span>
                                <span className="text-3xl font-black tabular-nums tracking-tight text-orange-400">{drillScore}</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Session XP</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Flame className="text-orange-400" size={18} />
                                        <span className="text-2xl font-bold tabular-nums tracking-tight">{madeShots * 150 + shotCount * 50}</span>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Accuracy</span>
                                    <span className="text-2xl font-bold tabular-nums text-blue-400 tracking-tight mt-1">
                                        {shotCount > 0 ? Math.round((madeShots / shotCount) * 100) : 0}%
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-3">
                            <Activity className="text-orange-400 animate-pulse" size={16} />
                            <span className="text-[11px] font-bold uppercase tracking-widest">{currentPhase}</span>
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest tabular-nums">{fpsDisplay} FPS</span>
                            {/* V13: Handedness badge */}
                            {handedness.confidence > 60 && (
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400">
                                    {handedness.hand === "right" ? "🤚 R" : "🤚 L"} ({handedness.confidence}%)
                                </span>
                            )}
                        </div>
                        {/* V13: Compact HUD toggle */}
                        <button
                            onClick={() => setCompactHUD(h => !h)}
                            className="pointer-events-auto text-[10px] font-semibold uppercase px-4 py-2 rounded-full glass-panel hover-lift transition-all text-white/70"
                        >
                            {compactHUD ? "Full Stats" : "Minimal"}
                        </button>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="flex justify-between items-end pb-24">
                    {/* V13: Compact vs Full HUD */}
                    {compactHUD ? (
                        /* ── COMPACT HUD and MINIMAP ── */
                        <div className="flex gap-4 items-end">
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-panel p-4 rounded-3xl flex items-center gap-6 shadow-xl"
                            >
                                <ScoreRing value={poseScore} color={scoreColorVal} label="Form" />
                                <div className="h-10 w-px bg-white/10" />
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] text-white/50 font-semibold uppercase tracking-wider mb-1">Shots</span>
                                    <span className="text-xl font-bold text-orange-400 tabular-nums">{madeShots}/{shotCount}</span>
                                </div>
                            </motion.div>

                            {/* Phase 2: Live Minimap */}
                            {shotPositions.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-24 h-24 glass-panel rounded-2xl relative overflow-hidden border border-white/10"
                                >
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-4 border border-orange-500/50 rounded-t-full rounded-b-md opacity-30" />
                                    {shotPositions.map((pos, i) => (
                                        <div
                                            key={i}
                                            className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 ${pos.made ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}
                                            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                                        />
                                    ))}
                                </motion.div>
                            )}
                        </div>
                    ) : (
                        /* ── FULL HUD ── */
                        <div className="flex flex-col gap-4">
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="glass-panel p-5 rounded-3xl flex flex-col gap-5 min-w-[220px] shadow-2xl"
                            >
                                {/* Elite TOP Analytics Bar inside panel */}
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <Gauge className="text-orange-400" size={18} />
                                        <span className="text-[9px] font-semibold uppercase tracking-widest text-white/80">Core AI Engine</span>
                                    </div>
                                    <div className="flex gap-2 opacity-80">
                                        <MetricGauge label="STB" value={stabilityScore} color="blue" />
                                        <MetricGauge label="EXP" value={explosivity * 10} color="orange" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
                                    <ScoreRing value={poseScore} color={scoreColorVal} label="Form" />
                                    <ScoreRing value={symmetryScore} color="#10B981" label="Sym" />
                                    {/* V13: Follow-Through ring */}
                                    <ScoreRing value={followThroughScore} color="#8b5cf6" label="F-Thru" />
                                </div>

                                <div className="grid grid-cols-3 gap-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] text-white/50 font-semibold uppercase mb-1">Release</span>
                                        <span className="text-sm font-bold text-blue-400">{releaseAngle}°</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] text-white/50 font-semibold uppercase mb-1">Depth</span>
                                        <span className="text-sm font-bold text-orange-400">{kneeBendDepth}°</span>
                                    </div>
                                    {/* V13: Consistency metric */}
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] text-white/50 font-semibold uppercase mb-1">Consist.</span>
                                        <span className={`text-sm font-bold ${consistencyScore >= 80 ? 'text-green-400' : consistencyScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {consistencyScore}%
                                        </span>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="glass-panel p-4 rounded-2xl flex items-center gap-6 shadow-lg self-start">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-white/50 font-semibold uppercase mb-1">Max Jump</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-orange-400 tabular-nums">{maxJump}</span>
                                        <span className="text-[10px] text-white/50 font-semibold uppercase">cm</span>
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-white/50 font-semibold uppercase mb-1">Airtime</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-blue-400 tabular-nums">{airtime}</span>
                                        <span className="text-[10px] text-white/50 font-semibold uppercase">s</span>
                                    </div>
                                </div>
                                {/* V13: Ball indicator */}
                                {ballDetected && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30">
                                        <span className="text-[8px]">🏀</span>
                                        <span className="text-[7px] font-black text-orange-400 uppercase">Ball</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right Side Stats */}
                    <div className="flex flex-col items-end gap-3 pointer-events-auto">
                        <div className="glass-modern border border-white/10 p-4 rounded-2xl flex flex-col items-center gap-1 shadow-2xl">
                            <span className="text-[8px] text-white/40 font-black uppercase tracking-widest mb-1">Made</span>
                            <span className="text-4xl font-black text-orange-500 tabular-nums leading-none">{madeShots}</span>
                            <span className="text-[10px] text-white/20 font-black italic">OF {shotCount}</span>
                        </div>
                        {streak > 1 && (
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-2 bg-linear-to-r from-orange-600 to-red-600 px-4 py-1.5 rounded-full shadow-lg shadow-orange-600/30"
                            >
                                <Zap size={14} className="fill-current text-white animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-tighter text-white">X{streak} HOT</span>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Master Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 pointer-events-auto">
                <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleCamera}
                    className="p-3 glass-modern border border-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                    <RefreshCcw size={20} />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { vibrate(20); setHoopMode(!hoopMode); }}
                    className={`p-3 glass-modern border rounded-full transition-colors flex items-center gap-1 ${hoopMode ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-white/10 text-white/40 hover:text-white'}`}
                >
                    <Target size={20} />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { vibrate(20); setDrillState(!drillActive); }}
                    className={`p-3 glass-modern border rounded-full transition-colors flex items-center gap-1 ${drillActive ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' : 'border-white/10 text-white/40 hover:text-white'}`}
                >
                    <Crosshair size={20} />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { vibrate(30); if (!isRecording) startRecording(); else stopRecording(); }}
                    className={`p-5 rounded-full text-white transition-all duration-500 shadow-2xl relative mx-2 ${!isRecording ? 'bg-orange-600' : 'bg-red-600'}`}
                >
                    {!isRecording ? <Circle size={32} className="fill-current" /> : <Square size={32} className="fill-current" />}
                    {isRecording && <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping" />}
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={activateVoice}
                    className={`p-4 rounded-full text-white shadow-2xl relative transition-all duration-300 ${isAnalyzing ? 'bg-purple-600 animate-pulse' : 'bg-blue-600'}`}
                >
                    <Mic size={22} className={isAnalyzing ? 'animate-bounce' : ''} />
                </motion.button>
            </div>

            {/* Voice Assistant Visual */}
            {!isVoiceModalOpen && isListening && (
                <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-60">
                    <VoiceWaveIndicator active={isListening} />
                </div>
            )}

            <VoiceAssistantModal
                isOpen={isVoiceModalOpen}
                onClose={() => {
                    setIsVoiceModalOpen(false);
                    recognitionRef.current?.stop();
                    audioStreamRef.current?.getTracks().forEach(t => t.stop());
                }}
                status={voiceStatus}
                interimTranscript={interimTranscript}
                finalTranscript={userTranscript}
                aiResponse={aiResponse}
                confidence={voiceConfidence}
                onActivate={activateVoice}
                stream={audioStreamRef.current}
                language={coachLanguage}
            />

            <AnimatePresence>
                {aiResponse && !isVoiceModalOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed bottom-32 inset-x-4 z-40"
                    >
                        <div className="glass-modern border border-orange-500/20 p-4 rounded-xl flex items-center gap-3 backdrop-blur-xl bg-orange-950/20">
                            <Bot className="text-orange-500" size={20} />
                            <p className="text-xs font-semibold leading-tight text-orange-100">{aiResponse}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* V13: Radar Chart Overlay */}
            <AnimatePresence>
                {showRadar && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: "-50%", y: 20 }}
                        animate={{ opacity: 1, scale: 1, x: "-50%", y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="fixed top-1/4 left-1/2 z-40 pointer-events-none"
                    >
                        <div className="glass-modern p-6 rounded-4xl border border-white/10 shadow-2xl backdrop-blur-2xl">
                            <div className="flex flex-col items-center gap-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">Consistency Matrix</span>
                                <RadarChart
                                    labels={["Form", "Stability", "Power", "Symmetry", "Arc"]}
                                    data={[poseScore, stabilityScore, explosivity * 10, symmetryScore, consistencyScore]}
                                    size={180}
                                />
                                <div className="px-4 py-2 bg-white/5 rounded-full">
                                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Global Stability: {consistencyScore}%</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
