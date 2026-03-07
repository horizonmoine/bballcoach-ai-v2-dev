"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-2 bg-red-600/90 text-white shadow-lg backdrop-blur-md"
                >
                    <WifiOff className="w-4 h-4 mr-2" />
                    <span className="text-sm font-semibold">Hors ligne. Veuillez vérifier votre connexion.</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
