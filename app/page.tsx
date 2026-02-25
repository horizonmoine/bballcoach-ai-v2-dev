"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import {
  Activity,
  Video,
  Upload,
  BookOpen,
  Clock,
  TrendingUp,
  Flame,
  ChevronRight,
} from "lucide-react";

interface Stats {
  totalSessions: number;
  totalDuration: number;
  totalUploads: number;
  lastSessionDate: string | null;
}

const features = [
  {
    name: "Live",
    path: "/live",
    icon: Activity,
    desc: "Tracking 3D temps réel",
    gradient: "from-orange-600 to-orange-500",
    glow: "glow-orange",
  },
  {
    name: "Analyse",
    path: "/analyze",
    icon: Upload,
    desc: "Upload vidéo ou image",
    gradient: "from-green-600 to-green-500",
    glow: "glow-green",
  },
  {
    name: "Compare",
    path: "/compare",
    icon: Video,
    desc: "vs Joueurs Pro",
    gradient: "from-blue-600 to-blue-500",
    glow: "glow-blue",
  },
  {
    name: "Training",
    path: "/training",
    icon: BookOpen,
    desc: "Exercices & tutos",
    gradient: "from-purple-600 to-purple-500",
    glow: "",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    totalDuration: 0,
    totalUploads: 0,
    lastSessionDate: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const [sessionsRes, uploadsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("duration_seconds, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("uploads")
          .select("id")
          .eq("user_id", user.id),
      ]);

      const sessions = sessionsRes.data || [];
      const uploads = uploadsRes.data || [];

      setStats({
        totalSessions: sessions.length,
        totalDuration: sessions.reduce(
          (acc, s) => acc + (s.duration_seconds || 0),
          0,
        ),
        totalUploads: uploads.length,
        lastSessionDate: sessions[0]?.created_at || null,
      });
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
  };

  return (
    <div className="min-h-full bg-neutral-950 text-white px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tighter">
          <span className="text-orange-500">BballCoach</span>AI
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          {user?.email
            ? `Salut, ${user.email.split("@")[0]} 👋`
            : "Coaching biomécanique IA"}
        </p>
      </div>

      {/* Stats Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <motion.div
          variants={item}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-neutral-400 font-bold uppercase">
              Sessions
            </span>
          </div>
          {loading ? (
            <div className="h-8 w-12 skeleton rounded" />
          ) : (
            <p className="text-2xl font-black">
              {stats.totalSessions}
            </p>
          )}
        </motion.div>

        <motion.div
          variants={item}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-neutral-400 font-bold uppercase">
              Temps total
            </span>
          </div>
          {loading ? (
            <div className="h-8 w-16 skeleton rounded" />
          ) : (
            <p className="text-2xl font-black">
              {formatDuration(stats.totalDuration)}
            </p>
          )}
        </motion.div>

        <motion.div
          variants={item}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-green-500" />
            <span className="text-xs text-neutral-400 font-bold uppercase">
              Analyses
            </span>
          </div>
          {loading ? (
            <div className="h-8 w-8 skeleton rounded" />
          ) : (
            <p className="text-2xl font-black">
              {stats.totalUploads}
            </p>
          )}
        </motion.div>

        <motion.div
          variants={item}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-neutral-400 font-bold uppercase">
              Dernière
            </span>
          </div>
          {loading ? (
            <div className="h-8 w-20 skeleton rounded" />
          ) : (
            <p className="text-sm font-bold text-neutral-200 mt-1">
              {stats.lastSessionDate
                ? new Date(
                  stats.lastSessionDate,
                ).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })
                : "—"}
            </p>
          )}
        </motion.div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Link
          href="/live"
          className="block w-full bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-5 mb-6 active:scale-[0.98] transition-transform glow-orange"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black">
                Démarrer une session
              </p>
              <p className="text-sm text-orange-100/70 mt-1">
                Tracking 3D + IA coaching vocal
              </p>
            </div>
            <Activity className="w-10 h-10 text-white/80" />
          </div>
        </Link>
      </motion.div>

      {/* Feature Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider px-1">
          Outils
        </h2>
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div key={f.path} variants={item}>
              <Link
                href={f.path}
                className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-4 active:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">{f.name}</p>
                    <p className="text-xs text-neutral-400">
                      {f.desc}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-600" />
              </Link>
            </motion.div>
          );
        })}

        {/* Sessions link */}
        <motion.div variants={item}>
          <Link
            href="/sessions"
            className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-4 active:bg-neutral-800 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-600 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold">Historique</p>
                <p className="text-xs text-neutral-400">
                  {stats.totalSessions} session
                  {stats.totalSessions !== 1 ? "s" : ""}{" "}
                  enregistrées
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
