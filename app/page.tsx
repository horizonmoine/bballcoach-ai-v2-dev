"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  Activity,
  Video,
  Upload,
  BookOpen,
  Clock,
  Flame,
  ChevronRight,
  Trophy,
  Zap,
  Target,
  Star,
} from "lucide-react";
import UniversalCoachFAB from "@/components/UniversalCoachFAB";
import RadarChart from "@/components/RadarChart";
import WeeklyActivityBar from "@/components/WeeklyActivityBar";

interface Stats {
  totalSessions: number;
  totalDuration: number;
  totalUploads: number;
  lastSessionDate: string | null;
  lastSessionFeedback: string | null;
  activityData: number[];
  avgScore: number;
  avgStability: number;
  avgExplosivity: number;
  avgConsistency: number;
  maxJump: number;
  totalShots: number;
}

interface Badge {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  border: string;
  earned: boolean;
}

const features = [
  {
    name: "Live",
    path: "/live",
    icon: Activity,
    desc: "Tracking 3D temps réel",
    gradient: "from-orange-600 to-orange-500",
    glow: "glow-orange",
    accent: "rgba(249,115,22,0.12)",
  },
  {
    name: "Analyse",
    path: "/analyze",
    icon: Upload,
    desc: "Upload vidéo ou image",
    gradient: "from-green-600 to-green-500",
    glow: "glow-green",
    accent: "rgba(34,197,94,0.1)",
  },
  {
    name: "Compare",
    path: "/compare",
    icon: Video,
    desc: "vs Joueurs Pro",
    gradient: "from-blue-600 to-blue-500",
    glow: "glow-blue",
    accent: "rgba(59,130,246,0.1)",
  },
  {
    name: "Training",
    path: "/training",
    icon: BookOpen,
    desc: "Exercices & tutos",
    gradient: "from-purple-600 to-purple-500",
    glow: "glow-purple",
    accent: "rgba(168,85,247,0.1)",
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 28 } },
};

// Circular score ring component
function ScoreRing({ value, size = 56, color = "#f97316" }: { value: number; size?: number; color?: string }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="score-ring -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={3} stroke="rgba(255,255,255,0.06)" fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        strokeWidth={3} stroke={color} fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
    </svg>
  );
}

export default function Home() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    totalDuration: 0,
    totalUploads: 0,
    lastSessionDate: null,
    lastSessionFeedback: null,
    activityData: [0, 0, 0, 0, 0, 0, 0],
    avgScore: 0,
    avgStability: 0,
    avgExplosivity: 0,
    avgConsistency: 0,
    maxJump: 0,
    totalShots: 0,
  });
  const [loading, setLoading] = useState(true);
  const [badgeFlash, setBadgeFlash] = useState(-1);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const [sessionsRes, uploadsRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("duration_seconds, created_at, ai_feedback_summary, avg_score, avg_stability, avg_explosivity, avg_consistency, max_jump, total_shots")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("uploads")
          .select("id")
          .eq("user_id", user.id),
      ]);

      const sessions = sessionsRes.data || [];
      const uploads = uploadsRes.data || [];

      const today = new Date();
      const activityData = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        const dayOffset = (today.getDay() + 6) % 7;
        date.setDate(today.getDate() - dayOffset + i);
        const dayStr = date.toISOString().split("T")[0];
        return sessions.filter((s) => s.created_at?.startsWith(dayStr)).length;
      });

      const sessionsWithMetrics = sessions.filter((s) => s.avg_score != null);
      const avg = (key: keyof typeof sessions[0]) =>
        sessionsWithMetrics.length > 0
          ? Math.round(sessionsWithMetrics.reduce((a, s) => a + ((s[key] as number) || 0), 0) / sessionsWithMetrics.length)
          : 0;

      const maxJump = sessions.reduce((max, s) => Math.max(max, s.max_jump || 0), 0);
      const totalShots = sessions.reduce((tot, s) => tot + (s.total_shots || 0), 0);

      setStats({
        totalSessions: sessions.length,
        totalDuration: sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
        totalUploads: uploads.length,
        lastSessionDate: sessions[0]?.created_at || null,
        lastSessionFeedback: sessions[0]?.ai_feedback_summary || null,
        activityData,
        avgScore: avg("avg_score"),
        avgStability: avg("avg_stability"),
        avgExplosivity: avg("avg_explosivity"),
        avgConsistency: avg("avg_consistency"),
        maxJump,
        totalShots,
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

  const level = Math.floor(stats.totalDuration / 3600) + 1;
  const xpProgress = (stats.totalDuration % 3600) / 36;

  const badges: Badge[] = [
    {
      icon: <Flame className="w-3.5 h-3.5" />,
      label: "🔥 Streak 5+",
      color: "text-orange-400",
      bg: "rgba(249,115,22,0.12)",
      border: "rgba(249,115,22,0.25)",
      earned: stats.totalSessions >= 5,
    },
    {
      icon: <Trophy className="w-3.5 h-3.5" />,
      label: "🏆 100 tirs",
      color: "text-yellow-400",
      bg: "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.25)",
      earned: stats.totalShots >= 100,
    },
    {
      icon: <Zap className="w-3.5 h-3.5" />,
      label: "⚡ Explosif",
      color: "text-cyan-400",
      bg: "rgba(0,242,255,0.1)",
      border: "rgba(0,242,255,0.2)",
      earned: stats.avgExplosivity >= 80,
    },
    {
      icon: <Target className="w-3.5 h-3.5" />,
      label: "🎯 Précis",
      color: "text-green-400",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.22)",
      earned: stats.avgScore >= 80,
    },
    {
      icon: <Star className="w-3.5 h-3.5" />,
      label: "⭐ Lvl 5+",
      color: "text-purple-400",
      bg: "rgba(168,85,247,0.1)",
      border: "rgba(168,85,247,0.22)",
      earned: level >= 5,
    },
  ];

  return (
    <div className="min-h-full bg-background text-white px-4 pt-6 pb-4">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-7"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter">
              <span className="text-neon-orange">Bball</span>
              <span className="text-white">Coach</span>
              <span className="text-white/40 font-light"> AI</span>
            </h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              {user?.email
                ? `Salut, ${user.email.split("@")[0]} 👋`
                : "Coaching biomécanique IA"}
            </p>
          </div>
          {/* Hot streak badge */}
          <AnimatePresence>
            {stats.totalSessions >= 3 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30"
              >
                <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">
                  {stats.totalSessions}x sessions
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Stats Cards ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 mb-6"
      >
        {/* Sessions */}
        <motion.div variants={item} className="glass-panel hover-lift p-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top-right, rgba(249,115,22,0.15), transparent 70%)" }}
          />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Sessions</span>
          </div>
          {loading
            ? <div className="h-8 w-12 skeleton rounded" />
            : <p className="text-3xl font-black text-white tabular-nums">{stats.totalSessions}</p>
          }
        </motion.div>

        {/* Duration */}
        <motion.div variants={item} className="glass-panel hover-lift p-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top-right, rgba(59,130,246,0.15), transparent 70%)" }}
          />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Temps total</span>
          </div>
          {loading
            ? <div className="h-8 w-16 skeleton rounded" />
            : <p className="text-3xl font-black text-white tabular-nums">{formatDuration(stats.totalDuration)}</p>
          }
        </motion.div>

        {/* Analyses */}
        <motion.div variants={item} className="glass-panel hover-lift p-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top-right, rgba(34,197,94,0.12), transparent 70%)" }}
          />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Upload className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Analyses</span>
          </div>
          {loading
            ? <div className="h-8 w-8 skeleton rounded" />
            : <p className="text-3xl font-black text-white tabular-nums">{stats.totalUploads}</p>
          }
        </motion.div>

        {/* Level + XP */}
        <motion.div variants={item} className="glass-panel hover-lift p-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top-right, rgba(168,85,247,0.12), transparent 70%)" }}
          />
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Niveau</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <ScoreRing value={xpProgress} size={52} color="#f97316" />
              <p className="absolute text-base font-black text-white">{level}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-neutral-500 font-bold uppercase mb-1">XP vers Lvl {level + 1}</p>
              {/* Shimmer progress bar */}
              <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden relative shimmer">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                  className="h-full rounded-full metric-bar-fill"
                  style={{
                    background: "linear-gradient(90deg, #f97316, #fbbf24)",
                    boxShadow: "0 0 8px rgba(249,115,22,0.5)",
                  }}
                />
              </div>
              <p className="text-[8px] text-neutral-600 mt-0.5 font-bold">{Math.round(xpProgress)}%</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Achievement Badges ── */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 mb-2.5">
            Badges
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {badges.map((b, i) => (
              <motion.button
                key={i}
                initial={b.earned ? { scale: 0.8, opacity: 0 } : {}}
                animate={b.earned ? { scale: 1, opacity: 1 } : {}}
                transition={b.earned ? { type: "spring", stiffness: 400, damping: 20, delay: i * 0.08 } : {}}
                onTouchStart={() => b.earned && setBadgeFlash(i)}
                onTouchEnd={() => setBadgeFlash(-1)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all duration-300 ${b.earned ? b.color : "text-neutral-700 border-neutral-800 bg-neutral-900"
                  } ${badgeFlash === i ? "scale-110" : "scale-100"}`}
                style={b.earned
                  ? { background: b.bg, borderColor: b.border }
                  : {}
                }
              >
                {b.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Weekly Activity ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-panel hover-lift p-4 mb-6"
      >
        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">
          Activité 7 jours
        </p>
        <WeeklyActivityBar data={stats.activityData} />
      </motion.div>

      {/* ── Performance Radar ── */}
      {!loading && (stats.avgScore > 0 || stats.totalSessions > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-panel hover-lift p-4 mb-6"
        >
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
            Radar Performance
          </p>
          <RadarChart
            labels={["Précision", "Stabilité", "Explosivité", "Consistance", "Volume"]}
            data={[
              stats.avgScore || 50,
              stats.avgStability || 50,
              stats.avgExplosivity || 50,
              stats.avgConsistency || 50,
              Math.min(100, stats.totalShots),
            ]}
          />
        </motion.div>
      )}

      {/* ── Shot Heatmap (Hot/Cold Zones) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="glass-panel hover-lift p-4 mb-6"
      >
        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">
          Zones de tir (Heatmap)
        </p>
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900 border border-white/5 flex items-end justify-center pb-2">
          {/* Abstract Court Background */}
          <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Basketball_court.svg/500px-Basketball_court.svg.png')] bg-cover bg-bottom opacity-20 pointer-events-none" />
          <div className="absolute bottom-0 w-32 h-20 border-t-2 border-x-2 border-white/10 rounded-t-full" />
          <div className="absolute bottom-0 inset-x-0 h-8 border-t border-white/10 bg-orange-500/5" />

          {/* Mock Data Heatmap Spots */}
          <div className="absolute bottom-[40%] left-[25%] w-8 h-8 rounded-full bg-red-500/80 blur-md" />
          <div className="absolute bottom-[40%] left-[25%] w-4 h-4 rounded-full bg-red-400" />

          <div className="absolute bottom-[30%] left-[75%] w-10 h-10 rounded-full bg-orange-500/60 blur-md" />
          <div className="absolute bottom-[30%] left-[75%] w-5 h-5 rounded-full bg-orange-400" />

          <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-12 h-12 rounded-full bg-blue-500/60 blur-md" />
          <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-4 h-4 rounded-full bg-blue-400" />

          <div className="absolute top-[40%] left-[80%] w-6 h-6 rounded-full bg-green-500/80 blur-md" />
          <div className="absolute top-[40%] left-[80%] w-3 h-3 rounded-full bg-green-400" />

          {/* Legend */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 bg-black/40 p-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[8px] font-bold text-white/70 uppercase">Échec fréquent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[8px] font-bold text-white/70 uppercase">Zone Froide</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[8px] font-bold text-white/70 uppercase">Zone Chaude</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── CTA Start Session ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 22 }}
        className="mb-6"
      >
        <Link
          href="/live"
          className="block w-full rounded-2xl p-5 active:scale-[0.98] transition-transform glow-orange-lg relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #ea580c 0%, #f97316 60%, #fb923c 100%)",
          }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 shimmer opacity-40 pointer-events-none" />
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-lg font-black">Démarrer une session</p>
              <p className="text-sm text-orange-100/70 mt-1">Tracking 3D + IA coaching vocal</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Activity className="w-7 h-7 text-white" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* ── Last Session ── */}
      {stats.lastSessionDate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-panel hover-lift p-4 mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
              Dernière session
            </p>
            <span className="text-[10px] text-neutral-600 font-bold">
              {new Date(stats.lastSessionDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {stats.lastSessionFeedback ? (
            <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">
              {stats.lastSessionFeedback}
            </p>
          ) : (
            <p className="text-xs text-neutral-600 italic">Pas encore de feedback IA</p>
          )}
          <Link
            href="/sessions"
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-orange-400 font-black uppercase tracking-wider"
          >
            Voir tout <ChevronRight className="w-3 h-3" />
          </Link>
        </motion.div>
      )}

      {/* ── Feature Grid ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-2.5"
      >
        <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1 mb-1">
          Outils
        </h2>
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div key={f.path} variants={item}>
              <Link
                href={f.path}
                className="glass-panel hover-lift flex items-center justify-between p-4 active:scale-[0.98] transition-all duration-300 relative overflow-hidden group"
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(ellipse at 30% 50%, ${f.accent}, transparent 70%)` }}
                />
                <div className="flex items-center gap-4 relative">
                  <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${f.gradient} flex items-center justify-center ${f.glow}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{f.name}</p>
                    <p className="text-xs text-neutral-500">{f.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-700 relative" />
              </Link>
            </motion.div>
          );
        })}

        {/* Sessions link */}
        <motion.div variants={item}>
          <Link
            href="/sessions"
            className="glass-panel hover-lift flex items-center justify-between p-4 active:scale-[0.98] transition-all duration-300 group"
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-neutral-700 to-neutral-600 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-white">Historique</p>
                <p className="text-xs text-neutral-500">
                  {stats.totalSessions} session{stats.totalSessions !== 1 ? "s" : ""}{" "}enregistrées
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-700" />
          </Link>
        </motion.div>
      </motion.div>

      <UniversalCoachFAB />
    </div>
  );
}
