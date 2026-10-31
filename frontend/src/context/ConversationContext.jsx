import { createContext, useContext, useReducer } from 'react';
import { conversationReducer, initialState } from './conversationReducer.js';

const ConversationContext = createContext(null);

export function ConversationProvider({ children }) {
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  return (
    <ConversationContext.Provider value={{ state, dispatch }}>
      {children}
    </ConversationContext.Provider>
  );
}

export const useConversationContext = () => useContext(ConversationContext);
