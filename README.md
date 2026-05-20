# 말문 (Malmoon) — AI 실시간 영어 스피킹 코치

> **"말문이 트이는 순간"** — 원어민 같은 영어 회화를 위한 Duolingo Max 스타일의 AI 1:1 영상통화 코칭 앱

---

## 목차

- [서비스 소개](#서비스-소개)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시스템 아키텍처](#시스템-아키텍처)
- [시작하기](#시작하기)
- [환경 변수](#환경-변수)
- [프로젝트 구조](#프로젝트-구조)
- [코칭 시나리오](#코칭-시나리오)
- [알려진 제한사항](#알려진-제한사항)

---

## 서비스 소개

말문은 성인 영어 학습자를 위한 **AI 실시간 스피킹 코치**입니다.  
사용자가 실제 비즈니스·일상 상황(면접, 회의, 발표, 여행, 네트워킹)에서 영어로 대화하면, AI가 즉각적으로 반응하고 피드백을 줍니다.

교재나 문제풀이가 아닌 **말하기 근육**을 키우는 것이 목표입니다.

---

## 주요 기능

### 🎙️ 실시간 AI 영상통화 (코칭 룸)

| 기능 | 설명 |
|---|---|
| **STT → LLM → TTS 루프** | Web Speech API로 음성 인식 → Claude API로 문맥 응답 생성 → 음성 합성 |
| **멀티 액센트 지원** | 🇺🇸 미국식 / 🇬🇧 영국식 / 🇦🇺 호주식 TTS 음성 선택 |
| **즉각 발화 피드백** | 사용자 발화의 격식체·어휘·문법 오류를 한국어로 즉시 코칭 |
| **침묵 개입 시스템** | 15초 침묵 감지 시 한국어로 자연스럽게 개입, 힌트 카드 자동 제공 |
| **오답 즉시 개입** | "No" / "I don't know" 등 대화 단절 답변 감지 시 즉시 코칭 |
| **힌트 카드** | 상황별 원어민 표현을 발음기호·한국어 번역과 함께 우측 패널에 제공 |

### 👁️ 멀티모달 퍼셉션 (MediaPipe)

| 감지 항목 | 임계값 | 개입 방식 |
|---|---|---|
| 시선 이탈 | 10초 | 아이컨택 힌트 카드 |
| 표정 굳음 (중립·슬픔) | 15초 | 호흡 코칭 카드 |
| 침묵 | 20초 | 긴급 표현 힌트 |
| 침묵 + 표정 굳음 동시 | — | 즉시 표현 제안 (hesitation_peak) |

### 📚 슬랭 보너스 탭

- **플립 카드 학습**: 슬랭·숙어·구동사·구어체 20+ 카드
- **4지선다 퀴즈**: 학습한 표현 즉시 점검
- **복습 목록**: 저장 단어 검색·필터링

---

## 기술 스택

```
Frontend    React 19 + TypeScript + Vite 8 + Tailwind CSS v4
AI          Anthropic Claude API (claude-haiku-4-5)
            └─ API 키 미설정 시 룰 기반 스크립트로 자동 폴백
STT         Web Speech API (SpeechRecognition)
TTS         Web Speech API (SpeechSynthesis) — 다국어 음성 선택
Perception  MediaPipe Tasks Vision 0.10.35
            ├─ FaceLandmarker (표정·시선 추적)
            └─ HandLandmarker (손 제스처 감지)
Audio       Web Audio API (마이크 RMS 기반 발화 감지)
```

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                     브라우저 (React)                      │
│                                                         │
│  웹캠 / 마이크                                            │
│      │                                                  │
│      ▼                                                  │
│  useCoachingPerception                                  │
│  ├─ MediaPipe FaceLandmarker → 표정·시선 분석             │
│  ├─ MediaPipe HandLandmarker → 손 감지                   │
│  └─ Web Audio RMS → 발화 감지                            │
│      │                                                  │
│      ▼ AgentEvent                                       │
│  useAgentSession (reducer)                              │
│  └─ agentEngine.processEvent() → ToolCall[]             │
│      └─ 힌트카드·에이전트 무드 업데이트                      │
│                                                         │
│  useConversation (STT → LLM → TTS 루프)                 │
│  ├─ SpeechRecognition → transcript                      │
│  ├─ evaluateUserResponse() → 오답 즉시 개입               │
│  ├─ analyzeSpeech() → 발화 피드백                         │
│  ├─ generateTurnResponse()                              │
│  │   ├─ [API 키 있음] Claude API 호출                    │
│  │   └─ [API 키 없음] 룰 기반 스크립트 폴백               │
│  └─ SpeechSynthesis TTS → 음성 출력                     │
│                                                         │
│  CoachingRoom (UI)                                      │
│  ├─ 좌측: 웹캠 + STT 자막 + 시나리오 정보                  │
│  └─ 우측: 에이전트 아바타 + 대화 버블 + 힌트 카드            │
└─────────────────────────────────────────────────────────┘
```

---

## 시작하기

### 사전 요구사항

- Node.js 18+
- Chrome 브라우저 (Web Speech API 지원 필수)
- 웹캠 및 마이크

### 설치 및 실행

```bash
# 1. 저장소 클론 후 앱 디렉터리로 이동
cd slang-app

# 2. 의존성 설치
npm install

# 3. MediaPipe WASM 바이너리 복사 (필수)
#    node_modules에서 public/mediapipe-wasm/ 으로 복사합니다
npm run copy-wasm

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 후 카메라·마이크 권한을 허용하세요.

### 빌드

```bash
npm run build     # TypeScript 컴파일 + Vite 번들링
npm run preview   # 빌드 결과물 로컬 미리보기
```

---

## 환경 변수

`slang-app/.env` 파일을 생성하세요.

```env
# Anthropic Claude API 키 (선택)
# 설정하지 않으면 룰 기반 대화 스크립트로 자동 폴백됩니다.
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

> **보안 주의**: `.env` 파일은 `.gitignore`에 포함되어 있으므로 절대 커밋하지 마세요.  
> 브라우저에서 직접 API를 호출하는 구조이므로 `anthropic-dangerous-direct-browser-access: true` 헤더를 사용합니다.  
> 프로덕션 환경에서는 백엔드 프록시 서버를 통해 API 키를 보호하세요.

---

## 프로젝트 구조

```
slang-app/
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── mediapipe-wasm/          # WASM 바이너리 (npm run copy-wasm으로 생성)
│
├── scripts/
│   └── copy-mediapipe-wasm.js   # WASM 복사 스크립트
│
└── src/
    ├── types.ts                 # 앱 전역 타입 정의
    │
    ├── data/
    │   ├── situations.ts        # 5개 롤플레이 시나리오 데이터
    │   └── cards.ts             # 슬랭·숙어 학습 카드 데이터
    │
    ├── agent/
    │   ├── agentEngine.ts       # AI 대화 엔진 (Claude API + 룰 기반 폴백)
    │   └── tools.ts             # 에이전트 툴콜 스키마 및 실행기
    │
    ├── perception/
    │   ├── mediapipeClient.ts   # MediaPipe 모델 초기화 및 추론
    │   ├── coachingTracker.ts   # 퍼셉션 이벤트 분류 (침묵·시선·표정)
    │   └── speechActivity.ts   # 마이크 RMS 발화 감지
    │
    ├── hooks/
    │   ├── useConversation.ts   # STT → LLM → TTS 실시간 턴테이킹 루프
    │   ├── useCoachingPerception.ts  # 웹캠 + MediaPipe 통합 훅
    │   └── useAgentSession.ts   # 에이전트 상태 reducer
    │
    ├── components/
    │   ├── CoachingRoom.tsx     # 메인 코칭 화면 (핵심 UI)
    │   ├── AgentAvatar.tsx      # 에이전트 감정 표현 아바타
    │   ├── AgentOverlay.tsx     # 퍼셉션 기반 힌트 오버레이
    │   ├── MainLanding.tsx      # 시나리오 선택 랜딩 화면
    │   ├── Navbar.tsx           # 상단 XP·스트릭·하트 바
    │   ├── PerceptionStatus.tsx # 웹캠 상태 지표
    │   └── slang/
    │       ├── SlangTab.tsx     # 슬랭 탭 컨테이너
    │       ├── LearnScreen.tsx  # 플립 카드 학습
    │       ├── QuizScreen.tsx   # 4지선다 퀴즈
    │       └── ReviewScreen.tsx # 복습 목록
    │
    ├── speech.d.ts              # Web Speech API 타입 선언 (TS DOM lib 보완)
    ├── App.tsx                  # 루트 컴포넌트 (화면·테마·XP 상태)
    ├── App.css                  # 컴포넌트 스타일
    ├── index.css                # --sl-* CSS 변수 디자인 시스템
    └── main.tsx                 # 앱 진입점
```

---

## 코칭 시나리오

| 시나리오 | 난이도 | 상황 설명 |
|---|---|---|
| 💼 영어 면접 | Advanced | 외국계 기업 입사 면접, STAR 기법 연습 |
| 🤝 영어 회의 | Intermediate | 국제 팀 미팅, 의견 제시·진행 표현 |
| 🎤 영어 발표 | Advanced | 15명 이해관계자 대상 프로젝트 제안 발표 |
| ✈️ 해외 여행 | Beginner | 뉴욕 호텔 체크인, 실생활 요청·협상 표현 |
| 🌐 네트워킹 | Intermediate | 테크 컨퍼런스, 자연스러운 첫 대화 시작 |

---

## 알려진 제한사항

- **Web Speech API**: Chrome/Edge에서만 안정적으로 동작합니다. Safari·Firefox는 지원 미흡
- **MediaPipe WASM**: 최초 실행 시 모델 로딩에 10~20초 소요됩니다
- **직접 API 호출**: 브라우저에서 Claude API를 직접 호출하는 프로토타입 구조입니다. 프로덕션 전환 시 백엔드 프록시가 필요합니다
