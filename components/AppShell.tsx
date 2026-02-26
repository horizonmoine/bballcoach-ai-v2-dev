"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import {
    Home,
    Video,
    Upload,
    BookOpen,
    User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
    { name: "Accueil", path: "/", icon: Home },
    { name: "Live", path: "/live", icon: Video },
    { name: "Analyse", path: "/analyze", icon: Upload },
    { name: "Training", path: "/training", icon: BookOpen },
    { name: "Profil", path: "/profile", icon: UserIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setLoading(false);
        };
        checkUser();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setUser(session?.user ?? null);
                if (_event === "SIGNED_OUT") router.push("/login");
            },
        );

        return () => authListener.subscription.unsubscribe();
    }, [setUser, router]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#050505] min-h-[100dvh]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center gap-8"
                >
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-32 h-32 border border-orange-500/10 rounded-full animate-[ping_3s_ease-in-out_infinite]" />
                        <div className="absolute w-20 h-20 border-2 border-transparent border-t-orange-500 rounded-full animate-spin glow-orange" />
                        <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center backdrop-blur-xl border border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
                            <span className="text-3xl font-black text-orange-400 tracking-tighter">B</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-lg font-black text-white tracking-widest uppercase">BballCoach <span className="text-orange-500">AI</span></span>
                        <span className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.3em] animate-pulse">System Initialization...</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    const isAuthPage = pathname === "/login" || pathname === "/register";
    const isLivePage = pathname === "/live";

    return (
        <>
            <AnimatePresence mode="wait">
                <motion.main
                    key={pathname}
                    initial={{ opacity: 0, y: isAuthPage ? 0 : 10, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: isAuthPage ? 0 : -10, filter: "blur(4px)" }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex-1 overflow-y-auto no-scrollbar ${!isAuthPage && !isLivePage ? "pb-24" : ""}`}
                >
                    {children}
                </motion.main>
            </AnimatePresence>

            {/* Mobile bottom tab bar - Elite Design */}
            {user && !isAuthPage && !isLivePage && (
                <nav className="fixed bottom-0 left-0 right-0 glass-premium border-t border-white/5 z-50 pb-safe shadow-[0_-20px_40px_rgba(0,0,0,0.8)]">
                    <ul className="flex justify-around items-center h-[76px] px-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.path;
                            const Icon = item.icon;
                            return (
                                <li key={item.path} className="flex-1 flex justify-center">
                                    <Link
                                        href={item.path}
                                        className="relative flex flex-col items-center justify-center w-full h-full group"
                                    >
                                        <div className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-500 ${isActive ? "" : "hover:bg-white/5"}`}>
                                            <motion.div
                                                animate={isActive ? { y: -4, scale: 1.15 } : { y: 0, scale: 1 }}
                                                transition={{ duration: 0.5, type: "spring", bounce: 0.6 }}
                                                className={`${isActive ? "text-white drop-shadow-[0_0_12px_rgba(249,115,22,1)]" : "text-neutral-500 group-active:text-neutral-300"}`}
                                            >
                                                <Icon size={isActive ? 24 : 24} strokeWidth={isActive ? 2.5 : 2} />
                                            </motion.div>

                                            <motion.span
                                                animate={{ opacity: isActive ? 1 : 0.6, y: isActive ? 2 : 0 }}
                                                className={`text-[9px] font-black mt-1 tracking-widest uppercase transition-colors duration-500 ${isActive ? "text-orange-500" : "text-neutral-600"}`}
                                            >
                                                {item.name}
                                            </motion.span>
                                        </div>

                                        {isActive && (
                                            <motion.div
                                                layoutId="activeNavIndicator"
                                                className="absolute top-0 w-12 h-[3px] bg-linear-to-r from-orange-500 via-red-500 to-orange-500 rounded-b-full shadow-[0_4px_15px_rgba(249,115,22,1)]"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            )}
        </>
    );
}
