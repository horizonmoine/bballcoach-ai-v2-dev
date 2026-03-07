export const extractFramesFromVideo = async (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    frameCount: number = 8,
    options?: { url?: string; crossOrigin?: string }
): Promise<string[]> => {
    return new Promise((resolve) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        const process = async () => {
            const dur = video.duration;
            if (!dur || !isFinite(dur)) { resolve([]); return; }
            const frames: string[] = [];
            for (let i = 1; i <= frameCount; i++) {
                video.currentTime = (dur / frameCount) * i;
                await new Promise<void>((r) => { video.onseeked = () => r(); });
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL("image/jpeg", 0.6));
            }
            resolve(frames);
        };

        if (options?.url) {
            if (options.crossOrigin) video.crossOrigin = options.crossOrigin;
            video.src = options.url;
            video.onloadeddata = process;
        } else {
            process();
        }
    });
};
