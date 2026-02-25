"use client";

import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6">
                    <div className="text-center max-w-sm">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-black mb-2">
                            Erreur inattendue
                        </h2>
                        <p className="text-sm text-neutral-400 mb-6">
                            {this.state.error?.message || "Une erreur est survenue."}
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="flex items-center gap-2 mx-auto bg-orange-600 active:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            Réessayer
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
