import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
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
        .max(20, "Maximum 20 images.")
        .default([]),
    metrics: z.object({
        stabilityScore: z.number().optional(),
        explosivity: z.number().optional(),
        maxJump: z.number().optional(),
        airtime: z.number().optional(),
        releaseAngle: z.number().optional(),
        kneeBendDepth: z.number().optional(),
        shotCount: z.number().optional(),
        madeShots: z.number().optional(),
    }).optional(),
    history: z.array(z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
    })).max(10).default([]),
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

        const { prompt, frames, metrics, history } = parseResult.data;

        // --- Build multi-turn conversation for Gemini ---
        const contents: { role: string; parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] }[] = [];

        const metricsInfo = metrics ? `
CONTEXTE SESSION:
- Stabilité: ${metrics.stabilityScore}%
- Explosivité: ${metrics.explosivity}%
- Détente Max: ${metrics.maxJump}cm
- Angle Relâchement: ${metrics.releaseAngle}°
- Flexion Genoux: ${metrics.kneeBendDepth}°
- Score: ${metrics.madeShots}/${metrics.shotCount}
` : "";

        const systemInstruction = `Tu es un coach de basket-ball professionnel d'élite.
Tu analyses la biomécanique en te basant sur des images ET des données métriques précises.
${metricsInfo}

RÈGLES CRITIQUES:
1. Analyse technique pure. Pas de politesse.
2. Si des frames sont fournies, analyse la séquence.
3. Si l'utilisateur pose une question, utilise les metrics pour personnaliser le conseil.
4. Si les metrics montrent une faiblesse (ex: stabilité < 70%), sois exigeant.
5. Réponses 2 phrases max.
6. Réponds toujours dans la langue de l'utilisateur.

DÉTECTION D'ACTIONS:
Si l'utilisateur demande une action spécifique, inclus à la fin de ta réponse texte un tag [ACTION:TYPE] parmi:
- [ACTION:TOGGLE_GHOST]
- [ACTION:SET_SERGEANT]
- [ACTION:SET_SUPPORTIVE]
- [ACTION:RECALL_LAST]
- [ACTION:SUMMARY]
Exemple: "Le mode fantôme est activé. [ACTION:TOGGLE_GHOST]"`;

        // Add conversation history (multi-turn memory)
        for (const turn of history) {
            contents.push({ role: turn.role, parts: [{ text: turn.text }] });
        }

        // Current user message with optional images
        const userParts: { text?: string; inlineData?: { data: string; mimeType: string } }[] = [
            { text: prompt }
        ];

        // Add images if present
        if (frames.length > 0) {
            frames.forEach((frameBase64: string) => {
                if (frameBase64.length > 0) {
                    const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, "");
                    userParts.push({
                        inlineData: {
                            data: base64Data,
                            mimeType: "image/jpeg"
                        }
                    });
                }
            });
        }

        contents.push({ role: "user", parts: userParts });

        const response = await client.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents,
            config: {
                systemInstruction,
                responseModalities: ["text", "audio"],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } }
                }
            }
        });

        // The reply text
        const respParts = (response.candidates?.[0]?.content?.parts as Array<{ text?: string, inlineData?: { data: string, mimeType: string } }>) || [];
        const replyPart = respParts.find((p) => p.text);
        let reply = replyPart?.text || "Pas de réponse textuelle.";

        // Extract Action
        let action = null;
        const actionMatch = reply.match(/\[ACTION:(\w+)\]/);
        if (actionMatch) {
            action = actionMatch[1];
            reply = reply.replace(/\[ACTION:\w+\]/, "").trim();
        }

        // The generated audio (base64)
        let audioBase64 = "";
        let audioMimeType = "audio/wav";
        const audioPart = respParts.find((p) => p.inlineData?.mimeType?.includes("audio"));
        if (audioPart?.inlineData) {
            audioBase64 = audioPart.inlineData.data;
            audioMimeType = audioPart.inlineData.mimeType;
        }

        return NextResponse.json({ reply, action, audio: audioBase64, mimeType: audioMimeType });
    } catch (error) {
        console.error("Erreur API:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'analyse visuelle ou vocale." },
            { status: 500 },
        );
    }
}
