"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Zap, Activity, Trophy } from "lucide-react";

export interface ShotData {
    id: number;
    score: number;
    jumpHeight: number;
    explosivity: number;
    stability: number;
    phase: string;
    timestamp: number;
}

interface ShotHistoryProps {
    shots: ShotData[];
    maxVisible?: number;
}

export default function ShotHistory({ shots, maxVisible = 5 }: ShotHistoryProps) {
    const visible = shots.slice(-maxVisible).reverse();

    if (visible.length === 0) return null;

    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 py-1">
            <AnimatePresence mode="popLayout">
                {visible.map((shot) => {
                    const scoreColor =
                        shot.score >= 80
                            ? "border-green-500/50 bg-green-500/10"
                            : shot.score >= 50
                                ? "border-yellow-500/50 bg-yellow-500/10"
                                : "border-red-500/50 bg-red-500/10";
                    const scoreTextColor =
                        shot.score >= 80
                            ? "text-green-400"
                            : shot.score >= 50
                                ? "text-yellow-400"
                                : "text-red-400";

                    return (
                        <motion.div
                            key={shot.id}
                            initial={{ opacity: 0, scale: 0.8, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: 20 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className={`shrink-0 w-20 rounded-xl border backdrop-blur-md p-2 ${scoreColor}`}
                        >
                            {/* Score */}
                            <div className="text-center mb-1">
                                <span className={`text-lg font-black ${scoreTextColor}`}>
                                    {shot.score}
                                </span>
                            </div>

                            {/* Mini metrics */}
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                    <Trophy className="w-2.5 h-2.5 text-cyan-400" />
                                    <span className="text-[8px] text-neutral-400 font-bold">
                                        {shot.jumpHeight}cm
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Zap className="w-2.5 h-2.5 text-orange-400" />
                                    <span className="text-[8px] text-neutral-400 font-bold">
                                        {shot.explosivity}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Activity className="w-2.5 h-2.5 text-green-400" />
                                    <span className="text-[8px] text-neutral-400 font-bold">
                                        {shot.stability}%
                                    </span>
                                </div>
                            </div>

                            {/* Shot number */}
                            <div className="text-center mt-1">
                                <span className="text-[7px] text-neutral-600 font-bold uppercase">
                                    #{shot.id}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
