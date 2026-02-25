"use client";

import { useToastStore } from "@/store/toastStore";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const typeStyles = {
    info: "border-blue-500 bg-blue-500/10 text-blue-400",
    success: "border-green-500 bg-green-500/10 text-green-400",
    error: "border-red-500 bg-red-500/10 text-red-400",
};

export default function ToastProvider() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`pointer-events-auto border rounded-xl px-4 py-3 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 ${typeStyles[toast.type]}`}
                    >
                        <p className="text-sm font-medium flex-1">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 opacity-60 hover:opacity-100 transition"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
