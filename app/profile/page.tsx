"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    User,
    LogOut,
    Shield,
    Clock,
    Activity,
    Upload,
    Mail,
    Edit3,
    Check,
    X,
} from "lucide-react";

interface Profile {
    username: string;
}

interface Stats {
    sessions: number;
    uploads: number;
    totalTime: number;
}

export default function ProfilePage() {
    const { user } = useAuthStore();
    const { addToast } = useToastStore();
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [stats, setStats] = useState<Stats>({
        sessions: 0,
        uploads: 0,
        totalTime: 0,
    });
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            const [profileRes, sessionsRes, uploadsRes] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("username")
                    .eq("id", user.id)
                    .single(),
                supabase
                    .from("sessions")
                    .select("duration_seconds")
                    .eq("user_id", user.id),
                supabase
                    .from("uploads")
                    .select("id")
                    .eq("user_id", user.id),
            ]);

            if (profileRes.data) {
                setProfile(profileRes.data);
                setNewUsername(profileRes.data.username || "");
            }

            setStats({
                sessions: sessionsRes.data?.length || 0,
                uploads: uploadsRes.data?.length || 0,
                totalTime: (sessionsRes.data || []).reduce(
                    (acc, s) => acc + (s.duration_seconds || 0),
                    0,
                ),
            });
            setLoading(false);
        };
        load();
    }, [user]);

    const updateUsername = async () => {
        if (!user || !newUsername.trim()) return;
        const { error } = await supabase
            .from("profiles")
            .update({ username: newUsername.trim() })
            .eq("id", user.id);
        if (error) {
            addToast("Erreur mise à jour du nom.", "error");
        } else {
            setProfile((p) => (p ? { ...p, username: newUsername.trim() } : p));
            setIsEditing(false);
            addToast("Nom mis à jour !", "success");
        }
    };

    const resetPassword = async () => {
        if (!user?.email) return;
        const { error } = await supabase.auth.resetPasswordForEmail(
            user.email,
            { redirectTo: `${window.location.origin}/login` },
        );
        if (error) addToast("Erreur envoi email.", "error");
        else addToast("Email de réinitialisation envoyé !", "success");
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const formatTime = (s: number) => {
        if (s < 60) return `${s}s`;
        if (s < 3600) return `${Math.floor(s / 60)}min`;
        return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
    };

    return (
        <div className="min-h-full bg-background text-white px-4 pt-6 pb-4">
            <h1 className="text-2xl font-black mb-6">Mon Profil</h1>

            {/* Avatar + Name */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 mb-4"
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-orange-400 flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) =>
                                        setNewUsername(e.target.value)
                                    }
                                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-orange-500"
                                    autoFocus
                                />
                                <button
                                    onClick={updateUsername}
                                    className="p-2 bg-green-600 rounded-lg"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="p-2 bg-neutral-700 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black">
                                    {loading ? (
                                        <span className="skeleton inline-block w-24 h-6 rounded" />
                                    ) : (
                                        profile?.username || "Joueur"
                                    )}
                                </h2>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-1 text-neutral-400 hover:text-white"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-1 text-neutral-400 text-sm mt-1">
                            <Mail className="w-3 h-3" />
                            <span>{user?.email}</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-3 gap-3 mb-4"
            >
                <div className="glass-panel p-4 text-center">
                    <Activity className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                    <p className="text-xl font-black">
                        {loading ? (
                            <span className="skeleton inline-block w-8 h-6 rounded" />
                        ) : (
                            stats.sessions
                        )}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">
                        Sessions
                    </p>
                </div>
                <div className="glass-panel p-4 text-center">
                    <Clock className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                    <p className="text-xl font-black">
                        {loading ? (
                            <span className="skeleton inline-block w-12 h-6 rounded" />
                        ) : (
                            formatTime(stats.totalTime)
                        )}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">
                        Temps
                    </p>
                </div>
                <div className="glass-panel p-4 text-center">
                    <Upload className="w-5 h-5 text-green-500 mx-auto mb-2" />
                    <p className="text-xl font-black">
                        {loading ? (
                            <span className="skeleton inline-block w-8 h-6 rounded" />
                        ) : (
                            stats.uploads
                        )}
                    </p>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">
                        Analyses
                    </p>
                </div>
            </motion.div>

            {/* Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
            >
                <button
                    onClick={resetPassword}
                    className="w-full flex items-center gap-4 glass-panel p-4 hover-lift transition"
                >
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-sm">
                        Réinitialiser le mot de passe
                    </span>
                </button>

                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-4 glass-panel border-red-900/30 p-4 hover-lift transition"
                >
                    <LogOut className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-sm text-red-500">
                        Déconnexion
                    </span>
                </button>
            </motion.div>
        </div>
    );
}
