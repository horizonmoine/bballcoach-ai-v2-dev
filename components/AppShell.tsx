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
            <div className="flex-1 flex items-center justify-center bg-neutral-950 min-h-[100dvh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-bold text-neutral-400">
                        Chargement…
                    </span>
                </div>
            </div>
        );
    }

    const isAuthPage = pathname === "/login" || pathname === "/register";
    const isLivePage = pathname === "/live";

    return (
        <>
            <main className={`flex-1 overflow-y-auto no-scrollbar ${!isAuthPage && !isLivePage ? "pb-20" : ""}`}>
                {children}
            </main>

            {/* Mobile bottom tab bar */}
            {user && !isAuthPage && !isLivePage && (
                <nav className="fixed bottom-0 left-0 right-0 glass border-t border-neutral-800 z-50 pb-safe">
                    <ul className="flex justify-around items-center h-16">
                        {navItems.map((item) => {
                            const isActive = pathname === item.path;
                            const Icon = item.icon;
                            return (
                                <li key={item.path}>
                                    <Link
                                        href={item.path}
                                        className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all ${isActive
                                                ? "text-orange-500"
                                                : "text-neutral-500 active:text-neutral-300"
                                            }`}
                                    >
                                        <Icon
                                            size={22}
                                            strokeWidth={isActive ? 2.5 : 1.5}
                                        />
                                        <span className="text-[10px] font-bold mt-1 tracking-tight">
                                            {item.name}
                                        </span>
                                        {isActive && (
                                            <div className="w-5 h-0.5 bg-orange-500 rounded-full mt-0.5" />
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
