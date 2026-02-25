/**
 * Edge Computing Biomechanics Engine v2
 * Calculates joint angles from MediaPipe landmarks at 60 FPS without network calls.
 * Enhanced with follow-through, guide hand, set point, and release angle detection.
 */

export interface Landmark {
    x: number;
    y: number;
    z?: number;
    visibility?: number;
}

export type ShotPhase = "IDLE" | "DIP" | "SET" | "RELEASE" | "FOLLOW_THROUGH";

/**
 * Calculates the angle at point B formed by line segments BA and BC.
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
    const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

/**
 * Calculates distance between two landmarks.
 */
function dist(a: Landmark, b: Landmark): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Determines if the player is right-handed based on wrist position.
 */
function isRightHanded(landmarks: Landmark[]): boolean {
    return landmarks[16].y < landmarks[15].y;
}

/**
 * Analyzes landmarks and returns an instant coaching cue if bad form is detected.
 * Returns null if posture is acceptable.
 */
export function getPostureFeedback(landmarks: Landmark[]): string | null {
    if (!landmarks || landmarks.length < 33) return null;

    const rightHanded = isRightHanded(landmarks);

    // Shooting arm landmarks
    const shootingShoulder = landmarks[rightHanded ? 12 : 11];
    const shootingElbow = landmarks[rightHanded ? 14 : 13];
    const shootingWrist = landmarks[rightHanded ? 16 : 15];

    // Guide hand landmarks
    const guideShoulder = landmarks[rightHanded ? 11 : 12];
    const guideElbow = landmarks[rightHanded ? 13 : 14];
    const guideWrist = landmarks[rightHanded ? 15 : 16];

    // Lower body
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    // Shoulders alignment
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const elbowAngle = calculateAngle(shootingShoulder, shootingElbow, shootingWrist);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const avgKneeAngle = (rightKneeAngle + leftKneeAngle) / 2;

    const isShootingMotion = shootingWrist.y < shootingShoulder.y;

    // === Critical checks (highest priority) ===

    // 1. Elbow flaring out during shot
    if (isShootingMotion && elbowAngle < 45) {
        return "Ouvre ton coude, aligne-le sous le ballon";
    }

    // 2. No leg drive — legs too straight during shooting prep
    if (!isShootingMotion && avgKneeAngle > 170 && shootingWrist.y > leftHip.y) {
        return "Fléchis tes appuis, utilise tes jambes";
    }

    // 3. Guide hand interfering — guide wrist above shoulder during release
    if (isShootingMotion && guideWrist.y < guideShoulder.y) {
        const guideElbowAngle = calculateAngle(guideShoulder, guideElbow, guideWrist);
        if (guideElbowAngle > 150) {
            return "Main guide trop haute, relâche-la";
        }
    }

    // 4. Shoulders not square — significant tilt
    const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
    if (isShootingMotion && shoulderTilt > 0.08) {
        return "Épaules déséquilibrées, reste carré";
    }

    // 5. Set point too low — shooting elbow below chin level
    const nose = landmarks[0];
    if (isShootingMotion && shootingElbow.y > nose.y + 0.05) {
        return "Monte ton point de départ, coude au niveau des yeux";
    }

    // 6. Follow-through check — wrist should be relaxed (bent down) after release
    if (isShootingMotion && shootingWrist.y < shootingElbow.y) {
        const wristAngle = calculateAngle(shootingElbow, shootingWrist, {
            x: shootingWrist.x,
            y: shootingWrist.y + 0.1,
        });
        if (wristAngle > 150) {
            return "Fouette ton poignet, follow-through vers le panier";
        }
    }

    // 7. Stance too narrow
    const stanceWidth = dist(leftAnkle, rightAnkle);
    const shoulderWidth = dist(leftShoulder, rightShoulder);
    if (stanceWidth < shoulderWidth * 0.6 && !isShootingMotion) {
        return "Écarte tes pieds, largeur d'épaules";
    }

    return null;
}

/**
 * Returns a numerical score (0-100) for the detected pose quality.
 */
export function getPoseScore(landmarks: Landmark[]): number {
    if (!landmarks || landmarks.length < 33) return 0;

    let score = 100;
    const rightHanded = isRightHanded(landmarks);

    const shootingShoulder = landmarks[rightHanded ? 12 : 11];
    const shootingElbow = landmarks[rightHanded ? 14 : 13];
    const shootingWrist = landmarks[rightHanded ? 16 : 15];

    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    const elbowAngle = calculateAngle(shootingShoulder, shootingElbow, shootingWrist);
    const avgKneeAngle =
        (calculateAngle(leftHip, leftKnee, leftAnkle) +
            calculateAngle(rightHip, rightKnee, rightAnkle)) /
        2;

    // Penalize elbow angle (ideal: 85-95°)
    if (elbowAngle < 70) score -= 25;
    else if (elbowAngle < 80) score -= 10;
    else if (elbowAngle > 120) score -= 15;

    // Penalize straight legs (ideal: 130-160°)
    if (avgKneeAngle > 170) score -= 20;
    else if (avgKneeAngle > 165) score -= 10;

    // Penalize narrow stance
    const stanceWidth = dist(landmarks[27], landmarks[28]);
    const shoulderWidth = dist(landmarks[11], landmarks[12]);
    if (stanceWidth < shoulderWidth * 0.6) score -= 10;

    // Shoulder tilt penalty
    const tilt = Math.abs(landmarks[11].y - landmarks[12].y);
    if (tilt > 0.08) score -= 15;
    else if (tilt > 0.05) score -= 5;

    return Math.max(0, Math.min(100, score));
}

/**
 * Detects the current phase of the shooting motion.
 */
export function getShotPhase(landmarks: Landmark[]): ShotPhase {
    if (!landmarks || landmarks.length < 33) return "IDLE";

    const rightHanded = isRightHanded(landmarks);
    const wrist = landmarks[rightHanded ? 16 : 15];
    const nose = landmarks[0];
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];

    const kneeAngle = (calculateAngle(leftHip, leftKnee, leftAnkle) + calculateAngle(rightHip, rightKnee, rightAnkle)) / 2;

    // Logic for phases
    if (kneeAngle < 140 && wrist.y > landmarks[12].y) return "DIP";
    if (wrist.y < nose.y && wrist.y > (nose.y - 0.1)) return "SET";
    if (wrist.y < (nose.y - 0.15)) return "RELEASE";
    if (kneeAngle > 165 && wrist.y > nose.y && wrist.y < landmarks[12].y) return "FOLLOW_THROUGH";

    return "IDLE";
}

/**
 * Calculates stability based on shoulder and hip alignment.
 * 0 = unstable, 100 = perfectly balanced.
 */
export function getStabilityScore(landmarks: Landmark[]): number {
    if (!landmarks || landmarks.length < 33) return 0;

    const shoulderDiff = Math.abs(landmarks[11].y - landmarks[12].y);
    const hipDiff = Math.abs(landmarks[23].y - landmarks[24].y);

    // Penalize differences in height (tilt)
    const score = 100 - (shoulderDiff * 800) - (hipDiff * 500);
    return Math.max(0, Math.min(100, Math.round(score)));
}
