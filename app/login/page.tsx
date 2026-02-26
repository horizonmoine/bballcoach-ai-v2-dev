"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push("/");
        }
    };

    const handleReset = async () => {
        if (!email) {
            setError("Entre ton email d'abord.");
            return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        });
        if (error) setError(error.message);
        else setResetSent(true);
    };

    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-background px-6">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm"
            >
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-orange-500 tracking-tighter mb-2">
                        BballCoach<span className="text-white">AI</span>
                    </h1>
                    <p className="text-neutral-400 text-sm">
                        Connecte-toi pour accéder à tes analyses.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {resetSent && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-sm">
                        Email de réinitialisation envoyé ! Vérifie ta boîte.
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-orange-500 focus:bg-white/10 text-white text-base transition-colors"
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                            Mot de passe
                        </label>
                        <div className="relative">
                            <input
                                type={showPw ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-orange-500 focus:bg-white/10 text-white text-base pr-12 transition-colors"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                            >
                                {showPw ? (
                                    <EyeOff className="w-5 h-5" />
                                ) : (
                                    <Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleReset}
                        className="text-sm text-orange-500 font-medium"
                    >
                        Mot de passe oublié ?
                    </button>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl font-black transition disabled:opacity-50 text-base"
                    >
                        {loading ? "Connexion…" : "Se connecter"}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-neutral-400 text-sm">
                        Pas encore de compte ?{" "}
                        <Link
                            href="/register"
                            className="text-orange-500 font-bold"
                        >
                            Créer un profil
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
