"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { type Landmark } from "@/lib/biomechanics";
import { Activity } from "lucide-react";

export default function ThreeGhost({ landmarks, visible }: { landmarks: Landmark[] | null, visible: boolean }) {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, lines: THREE.LineSegments } | null>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000005);
        // V13: Depth fog for 3D perception
        scene.fog = new THREE.FogExp2(0x000010, 0.3);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(120, 160);
        mount.appendChild(renderer.domElement);

        // V13: Neon glow material — High-intensity emission
        const material = new THREE.LineBasicMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending, // Better glow superposition
        });
        const geometry = new THREE.BufferGeometry();
        const lines = new THREE.LineSegments(geometry, material);
        scene.add(lines);

        // Multiple lights for bloom mimicry
        const mainLight = new THREE.PointLight(0x00f2ff, 2, 5);
        mainLight.position.set(0, 0, 1.5);
        scene.add(mainLight);

        const fillLight = new THREE.PointLight(0x3b82f6, 1, 3);
        fillLight.position.set(1, 1, 1);
        scene.add(fillLight);

        const camera = new THREE.PerspectiveCamera(50, 120 / 160, 0.1, 100);
        camera.position.z = 2;
        sceneRef.current = { scene, camera, renderer, lines };

        const animate = () => {
            if (!sceneRef.current) return;
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (mount && renderer.domElement) {
                mount.removeChild(renderer.domElement);
            }
            renderer.dispose();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!sceneRef.current || !landmarks || landmarks.length < 33) return;
        const { lines } = sceneRef.current;
        const positions: number[] = [];

        // Manual connections for a cleaner look
        const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper
            [11, 23], [12, 24], [23, 24], // Torso
            [23, 25], [25, 27], [24, 26], [26, 28] // Lower
        ];

        connections.forEach(([i1, i2]) => {
            const p1 = landmarks[i1];
            const p2 = landmarks[i2];
            // Normalize & Center (MediaPipe 0,0 is top-left, 3D 0,0 is center)
            positions.push((p1.x - 0.5) * 2, -(p1.y - 0.5) * 2, (p1.z || 0) * 2);
            positions.push((p2.x - 0.5) * 2, -(p2.y - 0.5) * 2, (p2.z || 0) * 2);
        });

        lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        lines.geometry.attributes.position.needsUpdate = true;
    }, [landmarks]);

    if (!visible) return null;

    return (
        <div className="absolute top-24 right-4 z-20 pointer-events-none">
            <div className="glass-modern border border-blue-500/20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <div className="bg-blue-600/10 px-2 py-1 flex items-center justify-between border-b border-blue-500/10">
                    <span className="text-[7px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1">
                        <Activity size={8} className="animate-pulse" /> 3D Analysis
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                </div>
                <div ref={mountRef} className="w-[120px] h-[160px]" />
            </div>
        </div>
    );
}
