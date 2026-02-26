"use client";

import React from "react";

const categories = [
    {
        title: "Fondamentaux de Tir",
        color: "orange",
        items: [
            {
                name: "Form Shooting sous le panier",
                type: "Mécanique",
                desc: "Alignement poignet-coude-épaule. Une main, distance 1m.",
                videoId: "fPqOyDB4pWI",
            },
            {
                name: "Catch & Shoot — Triple Threat",
                type: "Tir extérieur",
                desc: "Réception, position triple menace, tir en rythme.",
                videoId: "tMODHkFCu3I",
            },
        ],
    },
    {
        title: "Ball Handling & Finitions",
        color: "blue",
        items: [
            {
                name: "Pound Dribbles & Crossovers",
                type: "Dribble",
                desc: "Dribble de force, changement de main rapide. 3×30 sec chaque main.",
                videoId: "OcobqOqmGgQ",
            },
            {
                name: "Euro Step & Floater",
                type: "Finition",
                desc: "Finition intérieure avec changement d'appui et tir en suspension.",
                videoId: "IYf_Vjz8kI4",
            },
        ],
    },
    {
        title: "Mobilité & Prévention",
        color: "purple",
        items: [
            {
                name: "Mobilité Cheville & Genou",
                type: "Étirement dynamique",
                desc: "Dorsiflexion, rotation de hanche. Prévention entorses.",
                videoId: "yqYFVTAXyJ4",
            },
            {
                name: "Renforcement Core",
                type: "Préparation physique",
                desc: "Gainage, Russian twists, stabilité du tronc pour le tir.",
                videoId: "DHD1-2P94DI",
            },
        ],
    },
    {
        title: "Analyse Technique Pro",
        color: "green",
        items: [
            {
                name: "Étude : Mécanique de Steph Curry",
                type: "Analyse vidéo",
                desc: "Déconstruction du tir le plus efficace de l'histoire NBA.",
                videoId: "HOFq3ruJMbE",
            },
            {
                name: "Étude : Footwork de Kobe Bryant",
                type: "Analyse vidéo",
                desc: "Les appuis, fakes et pivots du Black Mamba.",
                videoId: "TaD2VfJTgeQ",
            },
        ],
    },
];

const colorMap: Record<string, { badge: string; border: string }> = {
    orange: {
        badge: "text-orange-500",
        border: "border-orange-500/20",
    },
    blue: {
        badge: "text-blue-500",
        border: "border-blue-500/20",
    },
    purple: {
        badge: "text-purple-500",
        border: "border-purple-500/20",
    },
    green: {
        badge: "text-green-500",
        border: "border-green-500/20",
    },
};

export default function TrainingPage() {
    return (
        <div className="min-h-screen bg-background text-white p-6 md:p-8">
            <h1 className="text-4xl font-black mb-2 text-purple-500">
                Entraînement & Ressources
            </h1>
            <p className="text-neutral-400 mb-10 text-lg">
                Exercices, étirements et analyses vidéo techniques.
            </p>

            {categories.map((cat) => {
                const colors = colorMap[cat.color];
                return (
                    <section key={cat.title} className="mb-12">
                        <h2
                            className={`text-2xl font-black mb-6 ${colors.badge}`}
                        >
                            {cat.title}
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {cat.items.map((item) => (
                                <div
                                    key={item.name}
                                    className={`glass-panel overflow-hidden shadow-xl ${colors.border}`}
                                >
                                    <div className="w-full aspect-video bg-black">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${item.videoId}`}
                                            title={item.name}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    </div>
                                    <div className="p-6">
                                        <span
                                            className={`text-xs font-bold uppercase tracking-wider ${colors.badge} mb-2 block`}
                                        >
                                            {item.type}
                                        </span>
                                        <h3 className="text-xl font-bold mb-2">{item.name}</h3>
                                        <p className="text-neutral-400 text-sm leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
