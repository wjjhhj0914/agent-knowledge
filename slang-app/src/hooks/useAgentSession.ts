import { useCallback, useReducer } from 'react';
import type { AgentEvent, AgentState, HintCard, Situation } from '../types';
import { processEvent } from '../agent/agentEngine';
import { executeToolCall } from '../agent/tools';

const INITIAL: AgentState = {
  mood: 'idle',
  message: '상황을 선택하고 세션을 시작하세요',
  hintCards: [],
  activeHint: null,
  interventionCount: 0,
};

type Action =
  | { type: 'EVENT'; event: AgentEvent; situation: Situation }
  | { type: 'DISMISS_HINT' }
  | { type: 'RESET' }
  | { type: 'SHOW_WRONG_ANSWER_HINT'; card: HintCard };

function reducer(state: AgentState, action: Action): AgentState {
  switch (action.type) {
    case 'EVENT': {
      const calls = processEvent(action.event, action.situation);
      return calls.reduce((s, call) => executeToolCall(call, s), state);
    }
    case 'DISMISS_HINT':
      return { ...state, activeHint: null };
    case 'RESET':
      return INITIAL;
    case 'SHOW_WRONG_ANSWER_HINT':
      return {
        ...state,
        activeHint: action.card,
        hintCards: [...state.hintCards.slice(-4), action.card],
        interventionCount: state.interventionCount + 1,
        mood: 'alert',
        message: '이 표현을 참고해서 다시 말해봐요! 💡',
      };
    default:
      return state;
  }
}

export function useAgentSession(situation: Situation | null) {
  const [agentState, dispatch] = useReducer(reducer, INITIAL);

  const handleEvent = useCallback((event: AgentEvent) => {
    if (!situation) return;
    dispatch({ type: 'EVENT', event, situation });
  }, [situation]);

  const dismissHint = useCallback(() => {
    dispatch({ type: 'DISMISS_HINT' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const showWrongAnswerHint = useCallback((card: HintCard) => {
    dispatch({ type: 'SHOW_WRONG_ANSWER_HINT', card });
  }, []);

  return { agentState, handleEvent, dismissHint, reset, showWrongAnswerHint };
}
