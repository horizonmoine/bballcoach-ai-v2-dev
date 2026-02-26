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
 * Fallback to 2D if Z is missing.
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
    const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

/**
 * Advanced 3D angle calculation using Euclidean vectors.
 */
export function calculateAngle3D(a: Landmark, b: Landmark, c: Landmark): number {
    if (a.z === undefined || b.z === undefined || c.z === undefined) {
        return calculateAngle(a, b, c);
    }

    const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosTheta = dotProduct / (mag1 * mag2);
    // Clamp for precision errors
    const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
    return Math.round(angle);
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

    const elbowAngle = calculateAngle3D(shootingShoulder, shootingElbow, shootingWrist);
    const rightKneeAngle = calculateAngle3D(rightHip, rightKnee, rightAnkle);
    const leftKneeAngle = calculateAngle3D(leftHip, leftKnee, leftAnkle);
    const avgKneeAngle = (rightKneeAngle + leftKneeAngle) / 2;

    const isShootingMotion = shootingWrist.y < shootingShoulder.y;

    // === Critical checks (highest priority) ===

    // 1. Elbow flaring out during shot (Elite check)
    if (isShootingMotion && elbowAngle < 45) {
        return "Ouvre ton coude, aligne-le sous le ballon";
    }

    // 2. No leg drive
    if (!isShootingMotion && avgKneeAngle > 172 && shootingWrist.y > leftHip.y) {
        return "Fléchis tes appuis, utilise tes jambes pour la puissance";
    }

    // 3. Guide hand interfering
    if (isShootingMotion && guideWrist.y < guideShoulder.y) {
        const guideElbowAngle = calculateAngle3D(guideShoulder, guideElbow, guideWrist);
        if (guideElbowAngle > 155) {
            return "Main guide trop haute, relâche-la au sommet";
        }
    }

    // 4. Shoulders not square
    const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
    if (isShootingMotion && shoulderTilt > 0.07) {
        return "Épaules déséquilibrées, reste carré face à l'arceau";
    }

    // 5. Set point check
    const nose = landmarks[0];
    if (isShootingMotion && shootingElbow.y > nose.y + 0.04) {
        return "Monte ton point de départ, coude à hauteur des yeux";
    }

    // 6. Follow-through check
    if (isShootingMotion && shootingWrist.y < shootingElbow.y) {
        const wristAngle = calculateAngle(shootingElbow, shootingWrist, {
            x: shootingWrist.x,
            y: shootingWrist.y + 0.1,
            z: shootingWrist.z
        });
        if (wristAngle > 160) {
            return "Fouette ton poignet, laisse ta main dans l'arceau";
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

/**
 * Estimates jump height in CM based on hip movement relative to initial floor position.
 * Assumes a standard human height scaling.
 */
export function calculateJumpHeight(landmarks: Landmark[], initialHipY: number): number {
    const currentHipY = (landmarks[23].y + landmarks[24].y) / 2;
    const diff = initialHipY - currentHipY;
    if (diff <= 0) return 0;
    // Heuristic: 1.0 screen unit ~= 175cm (depending on distance, but we normalize by body height if possible)
    const bodyHeight = Math.abs(landmarks[0].y - (landmarks[27].y + landmarks[28].y) / 2);
    const cmPerUnit = 175 / (bodyHeight || 0.5);
    return Math.round(diff * cmPerUnit);
}

/**
 * Calculates consistency by comparing current arm vector snapshots to the previous one.
 */
export function calculateConsistency(currentSnap: number[], prevSnap: number[] | null): number {
    if (!prevSnap) return 100;
    let sumSq = 0;
    for (let i = 0; i < currentSnap.length; i++) {
        sumSq += Math.pow(currentSnap[i] - prevSnap[i], 2);
    }
    const dist = Math.sqrt(sumSq);
    return Math.max(0, Math.min(100, Math.round(100 - (dist * 2))));
}

export function getJointVelocity(currentLm: Landmark, prevLm: Landmark | null, dt: number): number {
    if (!prevLm || dt === 0) return 0;
    const dx = currentLm.x - prevLm.x;
    const dy = currentLm.y - prevLm.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance / dt; // screen units per millisecond (approx)
}

export function calculateAirtime(startTime: number | null, endTime: number | null): number {
    if (!startTime || !endTime) return 0;
    return Math.max(0, endTime - startTime);
}

/**
 * V13: Follow-Through Persistence Score
 * Measures how long the shooting wrist stays above the eye plane after release.
 * Call on each frame during FOLLOW_THROUGH phase, increment counter.
 * Returns 0-100 score based on frames held.
 */
export function getFollowThroughScore(framesHeld: number, targetFrames: number = 15): number {
    return Math.min(100, Math.round((framesHeld / targetFrames) * 100));
}

/**
 * V13: Checks if wrist is above eye plane (follow-through condition).
 */
export function isFollowThroughHeld(landmarks: Landmark[]): boolean {
    if (!landmarks || landmarks.length < 33) return false;
    const rightHanded = isRightHanded(landmarks);
    const wrist = landmarks[rightHanded ? 16 : 15];
    const eye = landmarks[rightHanded ? 5 : 2]; // right/left eye
    return wrist.y < eye.y; // y=0 is top of screen
}

/**
 * V13: Handedness Auto-Detection with Rolling Vote
 * Pass in previous votes array and current landmarks, returns updated votes.
 * Once 10+ votes accumulated, the majority determines dominant hand.
 */
export interface HandednessResult {
    hand: "right" | "left";
    confidence: number; // 0-100
    votes: ("right" | "left")[];
}

export function updateHandednessVote(
    landmarks: Landmark[],
    prevVotes: ("right" | "left")[]
): HandednessResult {
    const rightWrist = landmarks[16];
    const leftWrist = landmarks[15];
    // The shooting hand is typically higher during motion
    const vote: "right" | "left" = rightWrist.y < leftWrist.y ? "right" : "left";
    const votes = [...prevVotes, vote].slice(-20); // Keep last 20 frames

    const rightCount = votes.filter(v => v === "right").length;
    const leftCount = votes.filter(v => v === "left").length;
    const total = votes.length;
    const dominant = rightCount >= leftCount ? "right" : "left";
    const confidence = Math.round((Math.max(rightCount, leftCount) / total) * 100);

    return { hand: dominant, confidence, votes };
}

/**
 * V13: Shot Consistency Tracker
 * Stores snapshot of key angles at release, compares last N shots.
 */
export interface ShotSnapshot {
    elbowAngle: number;
    kneeAngle: number;
    releaseAngle: number;
    wristX: number;
    wristY: number;
    timestamp: number;
}

export function createShotSnapshot(landmarks: Landmark[]): ShotSnapshot {
    const rightHanded = isRightHanded(landmarks);
    const shoulder = landmarks[rightHanded ? 12 : 11];
    const elbow = landmarks[rightHanded ? 14 : 13];
    const wrist = landmarks[rightHanded ? 16 : 15];
    const hip = landmarks[rightHanded ? 24 : 23];
    const knee = landmarks[rightHanded ? 26 : 25];
    const ankle = landmarks[rightHanded ? 28 : 27];

    return {
        elbowAngle: calculateAngle(shoulder, elbow, wrist),
        kneeAngle: calculateAngle(hip, knee, ankle),
        releaseAngle: calculateAngle(elbow, wrist, { x: wrist.x, y: wrist.y - 0.1 }),
        wristX: wrist.x,
        wristY: wrist.y,
        timestamp: Date.now(),
    };
}

export function getShotConsistencyScore(snapshots: ShotSnapshot[]): number {
    if (snapshots.length < 2) return 100;
    const last = snapshots.slice(-5);
    let totalDev = 0;
    for (let i = 1; i < last.length; i++) {
        totalDev += Math.abs(last[i].elbowAngle - last[i - 1].elbowAngle);
        totalDev += Math.abs(last[i].kneeAngle - last[i - 1].kneeAngle);
        totalDev += Math.abs(last[i].releaseAngle - last[i - 1].releaseAngle);
    }
    const avgDev = totalDev / ((last.length - 1) * 3);
    return Math.max(0, Math.min(100, Math.round(100 - avgDev * 3)));
}

/**
 * V13: Ball-in-Hand Detection Heuristic
 * Uses wrist-to-shoulder distance ratio and hand position.
 */
export function detectBallInHand(landmarks: Landmark[]): boolean {
    if (!landmarks || landmarks.length < 33) return false;
    const rightHanded = isRightHanded(landmarks);
    const wrist = landmarks[rightHanded ? 16 : 15];
    const shoulder = landmarks[rightHanded ? 12 : 11];
    const index = landmarks[rightHanded ? 20 : 19]; // index finger tip

    // Ball-in-hand heuristic: wrist above hip AND fingers spread (index far from wrist)
    const wristShoulderDist = dist(wrist, shoulder);
    const fingerSpread = dist(wrist, index);
    const ratio = fingerSpread / (wristShoulderDist || 0.01);

    // When holding a ball, fingers are more spread
    return ratio > 0.25 && wrist.y < landmarks[23].y;
}
