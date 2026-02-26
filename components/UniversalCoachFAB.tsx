"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface Message {
    role: "user" | "coach";
    text: string;
}

export default function UniversalCoachFAB() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "coach", text: "Salut ! Je suis ton coach IA. Une question sur ta technique ou un conseil pour progresser ?" },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", text: userMsg }]);
        setLoading(true);

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
                    prompt: `CONTEXT: Tu es un coach de basket expert. Réponds à cette question théorique de l'utilisateur de manière concise et motivante. QUESTION: ${userMsg}`,
                    frames: [], // No frames for theoretical chat
                }),
            });

            const data = await res.json();
            if (data.reply) {
                setMessages(prev => [...prev, { role: "coach", text: data.reply }]);
            } else {
                setMessages(prev => [...prev, { role: "coach", text: "Désolé, je n'ai pas pu traiter ta demande." }]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: "coach", text: "Erreur de connexion avec le coach." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-24 right-6 z-50">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="absolute bottom-16 right-0 w-[85vw] max-w-[350px] h-[450px] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-neutral-800 bg-neutral-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Coach IA</p>
                                    <p className="text-[10px] text-green-500 font-bold uppercase">En ligne</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-neutral-700 rounded-full">
                                <X className="w-5 h-5 text-neutral-400" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
                        >
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === "user"
                                        ? "bg-orange-600 text-white rounded-tr-none"
                                        : "bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700"
                                        }`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-neutral-800 p-3 rounded-2xl rounded-tl-none border border-neutral-700">
                                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-neutral-800 bg-neutral-900">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder="Pose une question..."
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-2.5 pl-4 pr-12 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={loading || !input.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-orange-600 text-white rounded-lg disabled:opacity-50 transition-opacity"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-colors ${isOpen ? "bg-neutral-800 text-white" : "bg-orange-600 text-white"
                    }`}
            >
                {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
            </motion.button>
        </div>
    );
}
