import { reconcileTurn, sortMessages } from '../utils/messages.js';

export const initialState = {
  conversationId: null,
  messages: [],
  isLoading: false,
  extractedData: null,
  meddraData: null,
  completenessScore: null,
  isReportReady: false,
  isEmergency: false,
  userType: 'patient',
  language: 'hi-IN',
  isAnonymous: true,
};

export function conversationReducer(state, action) {
  switch (action.type) {
    case 'SET_CONVERSATION_ID': return { ...state, conversationId: action.payload };
    case 'SET_MESSAGES': return { ...state, messages: sortMessages(action.payload) };
    case 'ADD_MESSAGE': return { ...state, messages: sortMessages([...state.messages, action.payload]) };
    // The server's reply arrived: replace the provisional bubbles with the
    // server-stamped messages (real id, seq and UTC timestamp).
    case 'RECONCILE_TURN': return { ...state, messages: reconcileTurn(state.messages, action.payload) };
    // The request failed: show a local error in the placeholder; there is no
    // server message, so it intentionally carries no timestamp.
    case 'FAIL_TURN': {
      const { botClientId, content } = action.payload;
      return {
        ...state,
        messages: state.messages.map((m) => (m.clientId === botClientId ? { ...m, content, isLoading: false, isError: true } : m)),
      };
    }
    // Swap one message's content in place (same id, seq and time) — used when
    // the welcome message is re-written after a language change.
    case 'REPLACE_MESSAGE': {
      const { id, clientId, content } = action.payload;
      return { ...state, messages: state.messages.map((m) => ((id && m.id === id) || (clientId && m.clientId === clientId) ? { ...m, content } : m)) };
    }
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_EXTRACTED_DATA': return { ...state, extractedData: action.payload };
    case 'SET_MEDDRA_DATA': return { ...state, meddraData: action.payload };
    case 'SET_COMPLETENESS': return { ...state, completenessScore: action.payload };
    case 'SET_REPORT_READY': return { ...state, isReportReady: action.payload };
    case 'SET_EMERGENCY': return { ...state, isEmergency: action.payload };
    case 'SET_USER_TYPE': return { ...state, userType: action.payload };
    case 'SET_LANGUAGE': return { ...state, language: action.payload };
    case 'SET_ANONYMOUS': return { ...state, isAnonymous: action.payload };
    case 'RESET': return { ...initialState };
    default: return state;
  }
}
