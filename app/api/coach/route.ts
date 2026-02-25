import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

/* ─── Simple in-memory rate limiter ─── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max requests
const RATE_WINDOW = 60_000; // per minute

function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
        return false;
    }

    entry.count++;
    return entry.count > RATE_LIMIT;
}

/* ─── Zod schema ─── */
const bodySchema = z.object({
    prompt: z.string().min(1, "Le prompt est requis.").max(2000),
    frames: z
        .array(z.string())
        .min(1, "Au moins une image est requise.")
        .max(20, "Maximum 20 images."),
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

        // --- Parse & validate body ---
        const rawBody = await req.json();
        const parseResult = bodySchema.safeParse(rawBody);

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]?.message || "Données invalides.";
            return NextResponse.json(
                { error: firstError },
                { status: 400 },
            );
        }

        const { prompt, frames } = parseResult.data;

        // --- Gemini Vision call ---
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-pro-preview-05-06",
        });

        const imageParts = frames.map((frameBase64: string) => {
            const base64Data = frameBase64.replace(
                /^data:image\/\w+;base64,/,
                "",
            );
            return {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg",
                },
            };
        });

        const systemInstruction = `Tu es un coach de basket-ball professionnel d'élite. Tu analyses la biomécanique en te basant sur une séquence d'images chronologiques.
Examine l'angle de la cheville, l'alignement hanche-épaule-coude, le point de relâchement et le suivi (follow-through).
Fournis une réponse directe, sans formatage superflu, sans introduction polie, uniquement des faits techniques, le diagnostic et la correction.`;

        const result = await model.generateContent([
            systemInstruction,
            prompt,
            ...imageParts,
        ]);

        return NextResponse.json({ reply: result.response.text() });
    } catch (error) {
        console.error("Erreur API:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'analyse visuelle." },
            { status: 500 },
        );
    }
}
