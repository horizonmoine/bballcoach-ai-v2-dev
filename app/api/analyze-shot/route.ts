import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "@/lib/env";

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

import { isRateLimited } from "@/lib/rate-limit";

const bodySchema = z.object({
    image: z.string().min(1, "L'image est requise.").max(10_000_000, "Image trop volumineuse."),
    coachLanguage: z.enum(["fr", "en"]).default("en")
});

export async function POST(req: Request) {
    try {
        // --- Auth check ---
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json(
                { error: "Accès refusé. Token manquant." },
                { status: 401 },
            );
        }

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(supabaseUrl, supabaseKey);
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json(
                { error: "Accès refusé. Token invalide." },
                { status: 401 },
            );
        }

        // --- Rate limit ---
        if (isRateLimited(user.id)) {
            return NextResponse.json(
                { error: "Trop de requêtes. Réessaie dans une minute." },
                { status: 429 },
            );
        }

        const rawBody = await req.json();
        const parseResult = bodySchema.safeParse(rawBody);

        if (!parseResult.success) {
            return NextResponse.json(
                { error: "Données invalides." },
                { status: 400 },
            );
        }

        const { image, coachLanguage } = parseResult.data;
        const cleanBase64 = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

        const prompt = `
            You are an elite basketball coach analyzing a frame of a shot just released or landing near the hoop.
            Given the image, analyze if the ball is going through the hoop (a "make") or missing.
            Also provide a brief form rating from 1 to 100 based on the shooter's form if visible, or the shot's trajectory.
            Finally, give one short sentence of advice (in ${coachLanguage === 'fr' ? 'French' : 'English'}).
        `;

        const response = await client.models.generateContent({
            model: "gemini-3.0-flash", // Using the fast flash model
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: cleanBase64
                        }
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isMake: {
                            type: Type.BOOLEAN,
                            description: "True if the ball is going into the hoop or went in, False otherwise. If no ball is visible near the hoop, assume False.",
                        },
                        formRating: {
                            type: Type.INTEGER,
                            description: "Rating of the shot's execution/trajectory from 1 to 100.",
                        },
                        coachAdvice: {
                            type: Type.STRING,
                            description: `One short, actionable sentence of advice. Language: ${coachLanguage === 'fr' ? 'French' : 'English'}`,
                        }
                    },
                    required: ["isMake", "formRating", "coachAdvice"]
                }
            }
        });

        const text = response.text || "{}";
        const result = JSON.parse(text);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Gemini API Error in analyze-shot:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'analyse du tir." },
            { status: 500 },
        );
    }
}
