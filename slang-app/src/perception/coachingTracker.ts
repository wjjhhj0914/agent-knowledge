import type { AgentEvent, AgentEventType, FaceExpression, PerceptionFrame, PerceptionSnapshot, SituationId } from '../types';

export interface CoachingTrackerOptions {
  situationId: SituationId;
  silenceThresholdMs?: number;      // default 20_000 (20s)
  frozenThresholdMs?: number;       // default 15_000 (15s)
  gazeAwayThresholdMs?: number;     // default 10_000 (10s)
  cooldownMs?: number;              // re-fire cooldown per event type
  onEvent: (event: AgentEvent) => void;
  onSnapshot: (snapshot: PerceptionSnapshot) => void;
}

const FROZEN_EXPRESSIONS = new Set<FaceExpression>(['neutral', 'sad', 'unknown']);

export function createCoachingTracker(opts: CoachingTrackerOptions) {
  const silenceMs    = opts.silenceThresholdMs  ?? 20_000;
  const frozenMs     = opts.frozenThresholdMs   ?? 15_000;
  const gazeAwayMs   = opts.gazeAwayThresholdMs ?? 10_000;
  const cooldown     = opts.cooldownMs          ?? 25_000;

  let silenceStartAt: number | null = null;
  let frozenStartAt:  number | null = null;
  let gazeAwayAt:     number | null = null;

  const lastFired = new Map<AgentEventType, number>();
  let wasSpeaking = false;

  function canFire(type: AgentEventType, now: number) {
    const last = lastFired.get(type) ?? 0;
    return now - last >= cooldown;
  }

  function fire(type: AgentEventType, now: number, extra: Record<string, unknown> = {}) {
    lastFired.set(type, now);
    opts.onEvent({ type, situationId: opts.situationId, payload: extra, timestampMs: now });
  }

  function reset() {
    silenceStartAt = null;
    frozenStartAt  = null;
    gazeAwayAt     = null;
    lastFired.clear();
    wasSpeaking    = false;
  }

  function update(frame: PerceptionFrame) {
    const now = frame.timestampMs;

    // ── Silence tracking ─────────────────────────────────────────────
    if (!frame.hasSpeech || !frame.faceVisible) {
      silenceStartAt ??= now;
    } else {
      if (!wasSpeaking) {
        // Recovered from silence
        if (silenceStartAt !== null && now - silenceStartAt >= 5_000) {
          if (canFire('user_recovered', now)) fire('user_recovered', now, {});
        }
      }
      silenceStartAt = null;
    }
    wasSpeaking = frame.hasSpeech;

    // ── Frozen expression tracking ──────────────────────────────────
    if (frame.faceVisible && FROZEN_EXPRESSIONS.has(frame.expression)) {
      frozenStartAt ??= now;
    } else {
      frozenStartAt = null;
    }

    // ── Gaze away tracking ───────────────────────────────────────────
    if (frame.faceVisible && !frame.gazeFocused) {
      gazeAwayAt ??= now;
    } else {
      gazeAwayAt = null;
    }

    // ── Compute durations ────────────────────────────────────────────
    const silenceSec   = silenceStartAt !== null ? (now - silenceStartAt) / 1000 : 0;
    const frozenSec    = frozenStartAt  !== null ? (now - frozenStartAt)  / 1000 : 0;
    const gazeAwaySec  = gazeAwayAt     !== null ? (now - gazeAwayAt)     / 1000 : 0;

    opts.onSnapshot({
      silenceSec:   Math.floor(silenceSec),
      frozenSec:    Math.floor(frozenSec),
      gazeAwaySec:  Math.floor(gazeAwaySec),
      isActive: frame.hasSpeech && frame.faceVisible && frame.gazeFocused,
    });

    // ── Fire events ──────────────────────────────────────────────────
    if (silenceSec >= frozenSec && silenceSec >= gazeAwaySec) {
      // Simultaneous silence + frozen = peak hesitation
      if (silenceSec * 1000 >= silenceMs && frozenSec * 1000 >= frozenMs) {
        if (canFire('hesitation_peak', now)) fire('hesitation_peak', now, { silenceSec: Math.floor(silenceSec) });
        return;
      }
    }

    if (silenceSec * 1000 >= silenceMs && canFire('silence_detected', now)) {
      fire('silence_detected', now, { silenceSec: Math.floor(silenceSec) });
    }

    if (frozenSec * 1000 >= frozenMs && canFire('expression_frozen', now)) {
      fire('expression_frozen', now, { frozenSec: Math.floor(frozenSec), expression: frame.expression });
    }

    if (gazeAwaySec * 1000 >= gazeAwayMs && canFire('gaze_away', now)) {
      fire('gaze_away', now, { gazeAwaySec: Math.floor(gazeAwaySec) });
    }
  }

  return { update, reset };
}
