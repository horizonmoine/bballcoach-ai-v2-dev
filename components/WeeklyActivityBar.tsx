"use client";

import { motion } from "framer-motion";

interface WeeklyActivityBarProps {
    data: number[]; // 7 values (Mon-Sun)
    labels?: string[];
    maxValue?: number;
    color?: string;
}

const DEFAULT_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function WeeklyActivityBar({
    data,
    labels = DEFAULT_LABELS,
    maxValue,
    color = "#f97316",
}: WeeklyActivityBarProps) {
    const max = maxValue || Math.max(...data, 1);

    return (
        <div className="flex items-end justify-between gap-1.5 h-20 w-full px-1">
            {data.map((val, i) => {
                const heightPct = Math.max(8, (val / max) * 100);
                const isToday = i === new Date().getDay() - 1 || (i === 6 && new Date().getDay() === 0);
                return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: `${heightPct}%`, opacity: 1 }}
                            transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
                            className="w-full rounded-t-md relative group cursor-default min-h-[3px]"
                            style={{
                                background: isToday
                                    ? `linear-gradient(to top, ${color}, ${color}dd)`
                                    : `linear-gradient(to top, ${color}40, ${color}20)`,
                                boxShadow: isToday ? `0 0 12px ${color}60` : "none",
                            }}
                        >
                            {/* Tooltip */}
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-neutral-700">
                                {val}
                            </div>
                        </motion.div>
                        <span
                            className={`text-[9px] font-bold ${isToday ? "text-orange-500" : "text-neutral-600"
                                }`}
                        >
                            {labels[i]}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
