// ── Perception (from MediaPipe layer) ──────────────────────────────
export type FaceExpression = 'happy' | 'sad' | 'surprised' | 'neutral' | 'unknown';

export interface PerceptionFrame {
  timestampMs: number;
  faceVisible: boolean;
  handsVisible: boolean;
  hasSpeech: boolean;
  expression: FaceExpression;
  expressionConfidence: number;
  gazeFocused: boolean;
}

export interface PerceptionSnapshot {
  silenceSec: number;
  frozenSec: number;      // consecutive seconds of non-happy neutral/sad expression
  gazeAwaySec: number;
  isActive: boolean;      // user is speaking + face visible + gaze focused
}

// ── Agent Events (perception → agent) ──────────────────────────────
export type AgentEventType =
  | 'session_started'
  | 'session_ended'
  | 'user_speaking'
  | 'silence_detected'      // silence > 20s
  | 'expression_frozen'     // neutral/sad expression > 15s
  | 'gaze_away'             // gaze not focused > 10s
  | 'hesitation_peak'       // silence + frozen expression together
  | 'user_recovered';       // user starts speaking again after silence

export interface AgentEvent {
  type: AgentEventType;
  situationId: SituationId;
  payload: Record<string, unknown>;
  timestampMs: number;
}

// ── Agent Tool Calls (agent → UI) ──────────────────────────────────
export type ToolName =
  | 'show_hint_card'
  | 'change_agent_reaction'
  | 'suggest_phrase'
  | 'play_encouragement'
  | 'dismiss_hint';

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
}

export type AgentMood = 'idle' | 'listening' | 'thinking' | 'encouraging' | 'alert' | 'celebrating';

export type HintType = 'phrase' | 'tip' | 'correction' | 'encouragement' | 'breathe';

export interface HintCard {
  id: string;
  type: HintType;
  title: string;
  body: string;
  phrase?: string;
  phonetic?: string;
  translation?: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface AgentState {
  mood: AgentMood;
  message: string;
  hintCards: HintCard[];          // stacked, newest last
  activeHint: HintCard | null;    // currently shown hint
  interventionCount: number;
}

// ── Situations ─────────────────────────────────────────────────────
export type SituationId = 'interview' | 'meeting' | 'presentation' | 'travel' | 'networking';
export type Difficulty  = 'beginner' | 'intermediate' | 'advanced';

export interface PhraseSuggestion {
  phrase: string;
  phonetic?: string;
  translation: string;
  context?: string;
}

export interface Situation {
  id: SituationId;
  title: string;
  subtitle: string;
  icon: string;
  difficulty: Difficulty;
  color: string;
  accent: string;
  scenarioPrompt: string;
  tips: string[];
  hints: PhraseSuggestion[];
}

// ── Speech Feedback (immediate correction / improvement) ──────────
export interface SpeechFeedback {
  type: 'correction' | 'improvement' | 'grammar';
  original: string;    // what the user said
  suggestion: string;  // better English
  explanation: string; // Korean coaching note
}

// ── Real-time Conversation (turn-taking) ───────────────────────────
export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent' | 'feedback';
  text: string;
  timestampMs: number;
  feedbackData?: SpeechFeedback;  // only when role === 'feedback'
  isIntervention?: boolean;       // true for silence-intervention agent messages (excluded from turn count)
}

export type TurnState =
  | 'idle'            // session not started
  | 'agent_speaking'  // TTS playing
  | 'waiting'         // user's turn, silence timer + STT active
  | 'user_speaking'   // STT interim result detected
  | 'agent_thinking'  // generating response
  | 'intervening';    // silence intervention in progress

// ── Screens / App ──────────────────────────────────────────────────
export type Screen = 'landing' | 'session' | 'slang';
export type Theme  = 'light' | 'dark';
export type VoiceAccent = 'en-US' | 'en-GB' | 'en-AU';

// ── Slang (bonus tab) ──────────────────────────────────────────────
export type Category = 'slang' | 'idiom' | 'phrasal-verb' | 'colloquial';

export interface SlangCard {
  id: string;
  term: string;
  phonetic?: string;
  meaning: string;
  example: string;
  translation: string;
  category: Category;
  difficulty: Difficulty;
  tags: string[];
  likes: number;
}
