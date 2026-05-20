import { useCallback, useEffect, useRef, useState } from 'react';
import { createMaryPerceptionClient } from '../perception/mediapipeClient';
import { createSpeechActivityDetector } from '../perception/speechActivity';
import { createCoachingTracker } from '../perception/coachingTracker';
import type { AgentEvent, PerceptionFrame, PerceptionSnapshot, SituationId } from '../types';

// ── 상태 타입 ─────────────────────────────────────────────────────────
// 'loading-models' : 카메라는 켜졌고 MediaPipe 모델 다운로드 중
export type PerceptionStatus =
  | 'idle'
  | 'starting'
  | 'loading-models'
  | 'running'
  | 'error';

export interface MediaErrorInfo {
  name: string;
  title: string;
  guide: string;
  detail: string;   // 개발자용 raw 메시지
  canRetry: boolean;
}

// ── 에러 직렬화 ───────────────────────────────────────────────────────
// Error / DOMException / Event / plain-object / primitive 모두 처리
function serializeUnknown(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name;
  }
  if (typeof Event !== 'undefined' && err instanceof Event) {
    // WASM / MediaPipe 내부 실패가 Event 객체로 throw됨
    const t = err.target as Record<string, unknown> | null;
    const targetErr = t?.['error'];
    return [
      `Event(type="${err.type}"`,
      targetErr != null ? `, target.error=${String(targetErr)}` : '',
      ')',
    ].join('');
  }
  if (typeof err === 'object' && err !== null) {
    try { return JSON.stringify(err); } catch { /* fall through */ }
    return Object.prototype.toString.call(err);
  }
  return String(err);
}

function getErrorName(err: unknown): string {
  if (err instanceof DOMException || err instanceof Error) return err.name;
  if (typeof Event !== 'undefined' && err instanceof Event) return `Event(${err.type})`;
  return 'UnknownError';
}

// ── Phase 1: getUserMedia 실패 분류 ──────────────────────────────────
function classifyStreamError(err: unknown): MediaErrorInfo {
  console.error('[Malmoon] 실제 발생한 상세 에러 (stream phase):', err);

  const name   = getErrorName(err);
  const detail = serializeUnknown(err);

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        name, detail, canRetry: false,
        title: '카메라/마이크 권한이 거부됐어요',
        guide: '주소창 왼쪽 자물쇠(🔒) 아이콘 → 카메라·마이크 "허용" → 페이지 새로고침',
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        name, detail, canRetry: true,
        title: '카메라 또는 마이크를 찾을 수 없어요',
        guide: '외장 웹캠이나 마이크를 연결한 뒤 다시 시도해주세요.',
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        name, detail, canRetry: true,
        title: '장치를 사용할 수 없어요 (다른 앱 점유 중)',
        guide: 'Zoom, Teams, FaceTime 등 카메라를 쓰는 앱을 모두 종료하고 다시 시도해주세요.',
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        name, detail, canRetry: true,
        title: '요청한 카메라 해상도를 지원하지 않아요',
        guide: '페이지를 새로고침하고 다시 시도해주세요.',
      };
    case 'SecurityError':
      return {
        name, detail, canRetry: false,
        title: '보안 정책으로 카메라를 사용할 수 없어요',
        guide: 'HTTPS 또는 localhost에서만 카메라를 사용할 수 있습니다.',
      };
    default:
      return {
        name, detail, canRetry: true,
        title: '카메라를 시작할 수 없어요',
        guide: `페이지를 새로고침하고 다시 시도해주세요. (${detail})`,
      };
  }
}

// ── Phase 2: video.play() 실패 분류 ──────────────────────────────────
function classifyPlayError(err: unknown): MediaErrorInfo {
  console.error('[Malmoon] 실제 발생한 상세 에러 (video.play phase):', err);
  const name   = getErrorName(err);
  const detail = serializeUnknown(err);
  return {
    name, detail, canRetry: true,
    title: '카메라 영상을 재생할 수 없어요',
    guide: '브라우저가 미디어 재생을 차단했습니다. 페이지를 새로고침하고 다시 시도해주세요.',
  };
}

// ── Phase 3: MediaPipe / 오디오 모델 실패 분류 ────────────────────────
function classifyModelError(err: unknown): MediaErrorInfo {
  console.error('[Malmoon] 실제 발생한 상세 에러 (model phase):', err);
  const name   = getErrorName(err);
  const detail = serializeUnknown(err);
  return {
    name, detail, canRetry: true,
    title: 'AI 분석 모델을 로드할 수 없어요',
    guide: [
      'MediaPipe WASM 모델을 CDN에서 가져오는 데 실패했습니다.',
      '네트워크 연결을 확인하고 페이지를 새로고침해주세요.',
      `(내부 오류: ${detail})`,
    ].join(' '),
  };
}

// ── 스트림 안전 해제 ─────────────────────────────────────────────────
function releaseStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach(track => {
    track.stop();
    console.debug('[Malmoon] track stopped:', track.kind, track.label);
  });
}

// ── 훅 ───────────────────────────────────────────────────────────────
interface UseCoachingPerceptionOptions {
  situationId: SituationId;
  onEvent: (event: AgentEvent) => void;
}

export function useCoachingPerception({ situationId, onEvent }: UseCoachingPerceptionOptions) {
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number | null>(null);
  const clientRef  = useRef<Awaited<ReturnType<typeof createMaryPerceptionClient>> | null>(null);
  const speechRef  = useRef<Awaited<ReturnType<typeof createSpeechActivityDetector>> | null>(null);
  const trackerRef = useRef<ReturnType<typeof createCoachingTracker> | null>(null);

  // 비동기 start() 도중 stop()이 호출되면 토큰이 달라져 in-flight 리소스를 즉시 해제
  const startTokenRef = useRef(0);

  const [status, setStatus]         = useState<PerceptionStatus>('idle');
  const [mediaError, setMediaError] = useState<MediaErrorInfo | null>(null);
  const [latestFrame, setFrame]     = useState<PerceptionFrame | null>(null);
  const [snapshot, setSnapshot]     = useState<PerceptionSnapshot>({
    silenceSec: 0, frozenSec: 0, gazeAwaySec: 0, isActive: false,
  });

  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);

  // ── stop: 모든 리소스를 순서대로 해제 ──────────────────────────────
  const stop = useCallback(async () => {
    startTokenRef.current += 1;  // in-flight start() 무효화

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    clientRef.current?.close();
    clientRef.current = null;

    await speechRef.current?.stop();
    speechRef.current = null;

    releaseStream(streamRef.current);
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    trackerRef.current?.reset();
    trackerRef.current = null;

    setFrame(null);
    setSnapshot({ silenceSec: 0, frozenSec: 0, gazeAwaySec: 0, isActive: false });
    setStatus('idle');
  }, []);

  // ── start: 3단계 분리 ─────────────────────────────────────────────
  const start = useCallback(async () => {
    if (status === 'running' || status === 'starting' || status === 'loading-models') return;
    setStatus('starting');
    setMediaError(null);

    const token = ++startTokenRef.current;

    // ── PHASE 1: 카메라/마이크 스트림 확보 ─────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      setMediaError(classifyStreamError(err));
      setStatus('error');
      return;
    }

    if (token !== startTokenRef.current) {
      console.warn('[Malmoon] aborted after getUserMedia');
      releaseStream(stream);
      return;
    }
    streamRef.current = stream;

    // ── PHASE 2: 비디오 요소 연결 + 재생 ───────────────────────────
    // videoRef.current가 null이면 React가 아직 DOM을 마운트하지 않은 것
    if (!videoRef.current) {
      console.error('[Malmoon] videoRef.current is null — video element not mounted');
      releaseStream(stream);
      streamRef.current = null;
      setMediaError({
        name: 'MountError',
        title: '화면 구성 오류',
        guide: '페이지를 새로고침하고 다시 시도해주세요.',
        detail: 'videoRef.current was null when stream was ready',
        canRetry: true,
      });
      setStatus('error');
      return;
    }

    videoRef.current.srcObject = stream;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;

    try {
      await videoRef.current.play();
    } catch (playErr) {
      // play()가 AbortError를 던지는 경우: srcObject 교체나 언마운트 타이밍 충돌
      // 치명적이지 않을 수도 있으나(muted 자동재생은 대부분 허용됨) 일단 기록하고 진행
      const name = getErrorName(playErr);
      console.warn('[Malmoon] video.play() rejected:', name, serializeUnknown(playErr), playErr);

      // AbortError는 대개 srcObject 재설정이 겹치는 무해한 race이므로 계속 진행
      // 그 외의 에러는 사용자에게 알림 후 중단
      if (name !== 'AbortError') {
        releaseStream(stream);
        streamRef.current = null;
        videoRef.current.srcObject = null;
        setMediaError(classifyPlayError(playErr));
        setStatus('error');
        return;
      }
    }

    if (token !== startTokenRef.current) {
      console.warn('[Malmoon] aborted after video.play()');
      releaseStream(stream);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    // ── PHASE 3: MediaPipe 모델 + 오디오 분석기 초기화 ─────────────
    // 카메라 영상은 이미 보이는 상태. 모델 로딩은 CDN에서 수 초 소요될 수 있음.
    setStatus('loading-models');

    let client: Awaited<ReturnType<typeof createMaryPerceptionClient>>;
    let speech: Awaited<ReturnType<typeof createSpeechActivityDetector>>;

    try {
      // MediaPipe와 오디오를 병렬 로드하되 각각 에러를 잡을 수 있게 분리
      client = await createMaryPerceptionClient();
    } catch (mpErr) {
      console.error('[Malmoon] 실제 발생한 상세 에러:', mpErr);
      releaseStream(stream);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setMediaError(classifyModelError(mpErr));
      setStatus('error');
      return;
    }

    if (token !== startTokenRef.current) {
      console.warn('[Malmoon] aborted after MediaPipe init');
      client.close();
      releaseStream(stream);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    try {
      speech = await createSpeechActivityDetector(stream);
    } catch (audioErr) {
      console.error('[Malmoon] 실제 발생한 상세 에러:', audioErr);
      client.close();
      releaseStream(stream);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setMediaError(classifyModelError(audioErr));
      setStatus('error');
      return;
    }

    if (token !== startTokenRef.current) {
      console.warn('[Malmoon] aborted after audio init');
      client.close();
      await speech.stop();
      releaseStream(stream);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }

    clientRef.current = client;
    speechRef.current = speech;

    // ── PHASE 4: 코칭 트래커 + rAF 루프 시작 ───────────────────────
    trackerRef.current = createCoachingTracker({
      situationId,
      silenceThresholdMs:  20_000,
      frozenThresholdMs:   15_000,
      gazeAwayThresholdMs: 10_000,
      cooldownMs:          25_000,
      onEvent:    evt => onEventRef.current(evt),
      onSnapshot: setSnapshot,
    });

    onEventRef.current({
      type: 'session_started',
      situationId,
      payload: {},
      timestampMs: performance.now(),
    });

    const tick = () => {
      const video   = videoRef.current;
      const c       = clientRef.current;
      const sp      = speechRef.current;
      const tracker = trackerRef.current;
      if (video && c && sp && tracker && video.readyState >= 2) {
        const frame = c.detect(video, sp.hasSpeech);
        setFrame(frame);
        tracker.update(frame);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    setStatus('running');
  }, [situationId, status, stop]);

  // ── 언마운트 클린업 ───────────────────────────────────────────────
  useEffect(() => () => { void stop(); }, [stop]);

  return { videoRef, latestFrame, snapshot, status, mediaError, start, stop };
}
