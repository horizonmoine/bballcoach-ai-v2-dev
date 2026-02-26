"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            const { error: profileError } = await supabase
                .from("profiles")
                .insert({ id: data.user.id, username });
            if (profileError) {
                setError(profileError.message);
                setLoading(false);
                return;
            }
        }
        router.push("/");
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
                        Crée ton profil de joueur.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                            Nom d&apos;utilisateur
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-orange-500 focus:bg-white/10 text-white text-base transition-colors"
                            required
                            autoComplete="username"
                        />
                    </div>
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
                                minLength={6}
                                autoComplete="new-password"
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
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl font-black transition disabled:opacity-50 text-base"
                    >
                        {loading ? "Création…" : "S'inscrire"}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-neutral-400 text-sm">
                        Déjà un compte ?{" "}
                        <Link
                            href="/login"
                            className="text-orange-500 font-bold"
                        >
                            Se connecter
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
