"use client";

import dynamic from "next/dynamic";

const LiveTracker = dynamic(() => import("@/components/LiveTracker"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-screen bg-black flex items-center justify-center text-white font-bold text-xl animate-pulse">
            Chargement du moteur biomécanique…
        </div>
    ),
});

export default function LivePage() {
    return (
        <div className="w-full h-screen bg-black overflow-hidden">
            <LiveTracker />
        </div>
    );
}
