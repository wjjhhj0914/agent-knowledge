import type { AgentMood, AgentState, HintCard, HintType, ToolCall } from '../types';

let hintIdCounter = 0;
function newHintId() { return `hint_${++hintIdCounter}`; }

// ── Tool Schemas (function calling definitions) ─────────────────────
export const TOOL_SCHEMAS = [
  {
    name: 'show_hint_card',
    description: 'Display a coaching hint card on the user\'s screen when they are stuck or hesitating.',
    parameters: {
      type: 'hint_card',
      title: 'Short headline for the hint',
      body: 'Main coaching message (1-2 sentences)',
      phrase: 'Optional native phrase to say',
      phonetic: 'Optional IPA pronunciation',
      translation: 'Optional Korean translation',
      urgency: 'low | medium | high',
    },
  },
  {
    name: 'change_agent_reaction',
    description: "Update the AI agent's emotional state and message displayed to the user.",
    parameters: {
      mood: 'idle | listening | thinking | encouraging | alert | celebrating',
      message: 'Short message from the agent (max 60 chars)',
    },
  },
  {
    name: 'suggest_phrase',
    description: 'Suggest a specific native phrase the user can say right now.',
    parameters: {
      phrase: 'The English phrase',
      phonetic: 'IPA pronunciation',
      translation: 'Korean meaning',
      context: 'When to use this phrase',
    },
  },
  {
    name: 'play_encouragement',
    description: 'Play a brief positive encouragement when user recovers or performs well.',
    parameters: { level: 'light | strong' },
  },
  {
    name: 'dismiss_hint',
    description: 'Remove the current hint card from the screen.',
    parameters: {},
  },
] as const;

// ── Tool Executors ──────────────────────────────────────────────────
export function executeToolCall(call: ToolCall, state: AgentState): AgentState {
  switch (call.name) {
    case 'show_hint_card': {
      const args = call.args as {
        type?: HintType; title: string; body: string;
        phrase?: string; phonetic?: string; translation?: string;
        urgency?: HintCard['urgency'];
      };
      const card: HintCard = {
        id: newHintId(),
        type: args.type ?? 'tip',
        title: args.title,
        body: args.body,
        phrase: args.phrase,
        phonetic: args.phonetic,
        translation: args.translation,
        urgency: args.urgency ?? 'medium',
      };
      return {
        ...state,
        activeHint: card,
        hintCards: [...state.hintCards.slice(-4), card],
        interventionCount: state.interventionCount + 1,
      };
    }

    case 'change_agent_reaction': {
      const args = call.args as { mood: AgentMood; message: string };
      return { ...state, mood: args.mood, message: args.message };
    }

    case 'suggest_phrase': {
      const args = call.args as { phrase: string; phonetic?: string; translation: string; context?: string };
      const card: HintCard = {
        id: newHintId(),
        type: 'phrase',
        title: '지금 이 표현을 써보세요',
        body: args.context ?? '원어민이 자주 쓰는 표현입니다.',
        phrase: args.phrase,
        phonetic: args.phonetic,
        translation: args.translation,
        urgency: 'medium',
      };
      return {
        ...state,
        activeHint: card,
        hintCards: [...state.hintCards.slice(-4), card],
        interventionCount: state.interventionCount + 1,
      };
    }

    case 'play_encouragement': {
      const msg = call.args['level'] === 'strong'
        ? '완벽해요! 그 흐름 계속 가세요 🎉'
        : '좋아요, 자연스럽게 이어가세요 👍';
      return { ...state, mood: 'celebrating', message: msg };
    }

    case 'dismiss_hint': {
      return { ...state, activeHint: null };
    }

    default:
      return state;
  }
}
