"use client";

import { useEffect } from "react";
import AppShell from "./AppShell";
import ToastProvider from "./ToastProvider";
import ErrorBoundary from "./ErrorBoundary";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(() => {
                /* SW registration failed — non-critical */
            });
        }
    }, []);

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-[100dvh] overflow-hidden">
                <AppShell>{children}</AppShell>
                <ToastProvider />
            </div>
        </ErrorBoundary>
    );
}
