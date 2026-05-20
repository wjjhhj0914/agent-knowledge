import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type Category,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { FaceExpression, PerceptionFrame } from "../types";


// WASM: CDN(0.10.22) 대신 npm으로 설치된 로컬 버전(0.10.35)을 사용.
// public/mediapipe-wasm/ 에 node_modules WASM을 복사해서 Vite가 정적 서빙.
// → npm install로 버전이 올라가도 copy-mediapipe-wasm.js 스크립트로 재동기화.
const WASM_BASE = "/mediapipe-wasm";

// 모델 파일은 Google Storage CDN의 latest 태그 사용 (버전 독립적).
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export type MaryPerceptionClient = {
  detect: (video: HTMLVideoElement, hasSpeech: boolean) => PerceptionFrame;
  close: () => void;
};

export async function createMaryPerceptionClient(): Promise<MaryPerceptionClient> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_MODEL_URL,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false
  });

  const handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_URL,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });

  return {
    detect(video, hasSpeech) {
      const timestampMs = performance.now();
      const faceResult = faceLandmarker.detectForVideo(video, timestampMs);
      const handResult = handLandmarker.detectForVideo(video, timestampMs);

      const { expression, confidence } = classifyExpression(faceResult);

      return {
        timestampMs,
        faceVisible: faceResult.faceLandmarks.length > 0,
        handsVisible: handResult.landmarks.length > 0,
        hasSpeech,
        expression,
        expressionConfidence: confidence,
        gazeFocused: estimateGazeFocused(faceResult)
      };
    },
    close() {
      faceLandmarker.close();
      handLandmarker.close();
    }
  };
}

function classifyExpression(result: FaceLandmarkerResult): {
  expression: FaceExpression;
  confidence: number;
} {
  const categories = result.faceBlendshapes[0]?.categories ?? [];
  if (categories.length === 0) {
    return { expression: "unknown", confidence: 0 };
  }

  const score = makeScoreReader(categories);
  const smile =
    average(score("mouthSmileLeft"), score("mouthSmileRight")) -
    average(score("mouthFrownLeft"), score("mouthFrownRight"));
  const sad =
    average(score("mouthFrownLeft"), score("mouthFrownRight")) +
    average(score("browDownLeft"), score("browDownRight")) * 0.5;
  const surprised =
    score("jawOpen") * 0.45 +
    average(score("eyeWideLeft"), score("eyeWideRight")) * 0.35 +
    score("browInnerUp") * 0.2;

  const candidates: Array<[FaceExpression, number]> = [
    ["happy", smile],
    ["sad", sad],
    ["surprised", surprised]
  ];

  candidates.sort((a, b) => b[1] - a[1]);
  const [expression, confidence] = candidates[0];

  if (confidence < 0.28) {
    return { expression: "neutral", confidence: 1 - confidence };
  }

  return { expression, confidence: clamp01(confidence) };
}

function estimateGazeFocused(result: FaceLandmarkerResult): boolean {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) return false;

  const noseTip = landmarks[1];
  if (!noseTip) return false;

  const horizontallyCentered = noseTip.x > 0.36 && noseTip.x < 0.64;
  const verticallyCentered = noseTip.y > 0.28 && noseTip.y < 0.72;

  return horizontallyCentered && verticallyCentered;
}

function makeScoreReader(categories: Category[]) {
  const map = new Map(categories.map((item) => [item.categoryName, item.score]));
  return (name: string) => map.get(name) ?? 0;
}

function average(...values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
