"use client";

import dynamic from "next/dynamic";

const LiveTracker = dynamic(() => import("@/components/LiveTracker"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen bg-background flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin glow-orange" />
            <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] animate-pulse">Chargement Biomécanique...</span>
        </div>
    ),
});

export default function LivePage() {
    return (
        <div className="w-full flex flex-col h-dvh bg-background text-white overflow-hidden relative">
            <LiveTracker />
        </div>
    );
}
