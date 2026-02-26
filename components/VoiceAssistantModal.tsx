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

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, Square, Bot, Loader2 } from "lucide-react";
import VoiceWaveIndicator from "./VoiceWaveIndicator";

export type VoiceStatus = "idle" | "listening" | "analyzing" | "responding" | "cooldown";

interface VoiceAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: VoiceStatus;
    interimTranscript: string;
    finalTranscript: string;
    aiResponse: string;
    confidence: number;
    onActivate: () => void;
    stream?: MediaStream | null;
    language: "fr" | "en";
}

const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
    isOpen,
    onClose,
    status,
    interimTranscript,
    finalTranscript,
    aiResponse,
    confidence,
    onActivate,
    stream,
    language
}) => {
    // V13: Typing Effect state
    const [displayedResponse, setDisplayedResponse] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (!aiResponse) {
            setDisplayedResponse("");
            setIsTyping(false);
            return;
        }

        let i = 0;
        setDisplayedResponse("");
        setIsTyping(true);
        const interval = setInterval(() => {
            setDisplayedResponse(aiResponse.slice(0, i + 1));
            i++;
            if (i >= aiResponse.length) {
                clearInterval(interval);
                setIsTyping(false);
            }
        }, 15);
        return () => clearInterval(interval);
    }, [aiResponse]);

    if (!isOpen) return null;

    const isListening = status === "listening";
    const isAnalyzing = status === "analyzing";
    const isResponding = status === "responding";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg glass-modern border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
                {/* Header with Wave */}
                <div className="relative h-48 bg-linear-to-b from-orange-500/10 to-transparent flex flex-col items-center justify-center p-6">
                    <div className="absolute top-4 right-4">
                        <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="mb-4">
                        <VoiceWaveIndicator
                            active={isListening || isResponding}
                            stream={stream}
                            size="lg"
                            color={isResponding ? "#3b82f6" : "#f97316"}
                        />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">
                            {isListening ? (language === "fr" ? "ÉCOUTE EN COURS" : "LISTENING NOW") :
                                isAnalyzing ? (language === "fr" ? "ANALYSE QUANTIQUE" : "ANALYZING POSE") :
                                    isResponding ? (language === "fr" ? "COACH RÉPOND" : "COACH RESPONDING") :
                                        (language === "fr" ? "SYSTÈME PRÊT" : "SYSTEM READY")}
                        </span>
                        {isAnalyzing && (
                            <div className="flex gap-1">
                                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 h-1 rounded-full bg-orange-500" />
                                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1 h-1 rounded-full bg-orange-500" />
                                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1 h-1 rounded-full bg-orange-500" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col gap-6">
                    {/* Transcript Area */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest">
                            <span>{language === "fr" ? "Transcription" : "Transcript"}</span>
                            {confidence > 0 && <span className="text-orange-500/50">{Math.round(confidence * 100)}% Match</span>}
                        </div>
                        <div className="min-h-[60px] p-4 bg-white/5 rounded-2xl border border-white/5">
                            {finalTranscript ? (
                                <p className="text-sm font-medium text-white/90 leading-relaxed italic">
                                    "{finalTranscript}"
                                </p>
                            ) : interimTranscript ? (
                                <p className="text-sm font-medium text-white/40 leading-relaxed italic">
                                    {interimTranscript}...
                                </p>
                            ) : (
                                <p className="text-sm font-medium text-white/20 leading-relaxed italic">
                                    {language === "fr" ? "Dites quelque chose..." : "Say something..."}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* AI Response Area */}
                    <AnimatePresence mode="wait">
                        {(displayedResponse || isAnalyzing) && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-2"
                            >
                                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                                    <Bot size={12} />
                                    <span>{language === "fr" ? "Réponse du Coach" : "Coach Response"}</span>
                                </div>
                                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                    <p className="text-sm font-bold text-blue-50 leading-relaxed">
                                        {displayedResponse}
                                        {isTyping && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} className="inline-block w-1 h-4 ml-1 bg-blue-400 align-middle" />}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Suggestions (only when idle) */}
                    {!isListening && !isAnalyzing && !isResponding && (
                        <div className="space-y-3">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                {language === "fr" ? "Commandes Suggérées" : "Suggested Commands"}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    language === "fr" ? "Quels sont mes points faibles ?" : "What are my weak points?",
                                    language === "fr" ? "Active le mode fantôme" : "Activate ghost mode",
                                    language === "fr" ? "Résume ma séance" : "Summarize my session",
                                    language === "fr" ? "Mode sergent !" : "Sergeant mode!",
                                ].map((cmd) => (
                                    <button
                                        key={cmd}
                                        onClick={() => { }} // Placeholder
                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[11px] font-medium text-white/60 transition-colors"
                                    >
                                        {cmd}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-4 flex justify-center">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onActivate}
                            disabled={isAnalyzing}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl ${isListening ? 'bg-red-500 text-white' : 'bg-orange-500 text-black'}`}
                        >
                            {isListening ? (
                                <><Square size={16} fill="currentColor" /> {language === "fr" ? "Terminer" : "Finish"}</>
                            ) : (
                                <><Mic size={16} /> {language === "fr" ? "Parler au Coach" : "Talk to Coach"}</>
                            )}
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default VoiceAssistantModal;
