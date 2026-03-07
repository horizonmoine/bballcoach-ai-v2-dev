const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(userId: string, maxRequests: number = 20, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
        return false;
    }

    entry.count++;
    return entry.count > maxRequests;
}
