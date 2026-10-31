import { useCallback, useRef } from 'react';
import { useConversationContext } from '../context/ConversationContext.jsx';
import { conversationApi, reportApi } from '../utils/api.js';
import { tSafety } from '../utils/i18n.js';

// Persists which conversation is currently "in progress" so a page refresh
// on /report doesn't silently start a brand-new conversation and orphan the
// one the user was mid-way through. Cleared once a report is submitted or
// the user explicitly starts fresh.
export const ACTIVE_CONVERSATION_KEY = 'pharmaco_active_conversation_id';

function rememberActiveConversation(id) {
  try { localStorage.setItem(ACTIVE_CONVERSATION_KEY, id); } catch { /* ignore */ }
}

function forgetActiveConversation() {
  try { localStorage.removeItem(ACTIVE_CONVERSATION_KEY); } catch { /* ignore */ }
}

const newClientId = () => (globalThis.crypto?.randomUUID?.() || `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function useConversation() {
  const { state, dispatch } = useConversationContext();
  const autoDraftedRef = useRef(new Set());
  const sendingRef = useRef(false);
  const startingRef = useRef(null);

  const doStartConversation = useCallback(async (userType, language, isAnonymous) => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_USER_TYPE', payload: userType });
    dispatch({ type: 'SET_LANGUAGE', payload: language });
    dispatch({ type: 'SET_ANONYMOUS', payload: isAnonymous });

    try {
      const { data } = await conversationApi.start({ userType, language, isAnonymous });
      dispatch({ type: 'SET_CONVERSATION_ID', payload: data.conversationId });
      // The server stamps the welcome message (id, seq, UTC time).
      dispatch({
        type: 'ADD_MESSAGE',
        payload: data.welcome || { role: 'assistant', content: data.welcomeMessage },
      });
      rememberActiveConversation(data.conversationId);
      return data.conversationId;
    } catch (err) {
      console.error('[useConversation] startConversation error:', err);
      // Offline fallback
      const fallbackId = 'offline-' + Date.now();
      dispatch({ type: 'SET_CONVERSATION_ID', payload: fallbackId });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { role: 'assistant', content: tSafety('offlineWelcome', language), clientId: newClientId() },
      });
      return fallbackId;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  const startConversation = useCallback((userType = 'patient', language = 'hi-IN', isAnonymous = true) => {
    // A second call while one is in flight joins it instead of creating another
    // conversation (and another welcome message).
    if (startingRef.current) return startingRef.current;
    const run = doStartConversation(userType, language, isAnonymous).finally(() => { startingRef.current = null; });
    startingRef.current = run;
    return run;
  }, [doStartConversation]);

  const saveDraftAutomatically = useCallback(async (conversationId, extractedData, completenessScore, language, isAnonymous) => {
    if (!conversationId || !extractedData) return null;
    // Key on the full structured payload (not just medicine/reaction) so any
    // corrected field — outcome, concomitant meds, dosage, etc. — triggers a
    // fresh draft save rather than silently going stale.
    const key = `${conversationId}:${JSON.stringify(extractedData)}`;
    if (autoDraftedRef.current.has(key)) return null;

    autoDraftedRef.current.add(key);
    try {
      const result = await reportApi.saveDraft({
        conversationId,
        extractedData,
        completenessScore,
        isAnonymous,
        language,
      });
      return result.data;
    } catch (err) {
      console.error('[useConversation] auto draft save failed:', err);
      return null;
    }
  }, []);

  // inputMode 'voice' marks text the user dictated and reviewed before sending.
  const sendMessage = useCallback(async (text, { inputMode = 'text' } = {}) => {
    if (!text.trim() || !state.conversationId) return;
    // One turn at a time: the server processes a conversation's messages in
    // order, and a second send mid-reply would only queue behind the first.
    if (sendingRef.current) return;
    sendingRef.current = true;

    // Provisional bubbles. They carry no timestamp — the server stamps the real
    // messages (UTC, with a sequence number) and replaces these on reply.
    const userClientId = newClientId();
    const botClientId = newClientId();
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'user', content: text, clientId: userClientId, ...(inputMode === 'voice' && { isVoice: true }) } });
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', clientId: botClientId, isLoading: true } });
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const { data } = await conversationApi.message({
        conversationId: state.conversationId,
        message: text,
        inputMode,
        userType: state.userType,
        // The conversation language is explicit state; the server uses it for the
        // reply, the emergency advice and (via the speaker) the voice playback.
        language: state.language,
      });

      dispatch({
        type: 'RECONCILE_TURN',
        payload: {
          userClientId,
          botClientId,
          userMessage: data.userMessage,
          assistantMessage: data.assistantMessage || { role: 'assistant', content: data.message },
        },
      });

      if (data.isEmergency) dispatch({ type: 'SET_EMERGENCY', payload: true });
      if (data.extractedData) dispatch({ type: 'SET_EXTRACTED_DATA', payload: data.extractedData });
      if (data.meddraData) dispatch({ type: 'SET_MEDDRA_DATA', payload: data.meddraData });
      if (data.completenessScore != null) dispatch({ type: 'SET_COMPLETENESS', payload: data.completenessScore });
      if (data.isReportReady) dispatch({ type: 'SET_REPORT_READY', payload: true });

      // Once a report has reached "ready" at least once, keep the saved
      // draft in sync with every later correction too.
      if (data.isReportReady || state.isReportReady) {
        await saveDraftAutomatically(state.conversationId, data.extractedData || state.extractedData, data.completenessScore ?? state.completenessScore, state.language, state.isAnonymous);
      }
    } catch (err) {
      console.error('[useConversation] sendMessage error:', err);
      dispatch({ type: 'FAIL_TURN', payload: { botClientId, content: tSafety('connectionError', state.language) } });
    } finally {
      sendingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.conversationId, state.userType, state.language, state.extractedData, state.completenessScore, state.isAnonymous, state.isReportReady, dispatch, saveDraftAutomatically]);

  const endConversation = useCallback(async () => {
    if (!state.conversationId) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await conversationApi.end(state.conversationId);
      forgetActiveConversation();
      return data;
    } catch (err) {
      console.error('[useConversation] endConversation error:', err);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.conversationId, dispatch]);

  const hydrateConversation = useCallback(async (conversationId) => {
    if (!conversationId) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await conversationApi.history(conversationId);
      dispatch({ type: 'SET_CONVERSATION_ID', payload: data.id || conversationId });
      if (Array.isArray(data.messages)) dispatch({ type: 'SET_MESSAGES', payload: data.messages });
      if (data.extractedData) dispatch({ type: 'SET_EXTRACTED_DATA', payload: data.extractedData });
      if (data.meddraData) dispatch({ type: 'SET_MEDDRA_DATA', payload: data.meddraData });
      if (data.completenessScore != null) dispatch({ type: 'SET_COMPLETENESS', payload: data.completenessScore });
      if (data.language) dispatch({ type: 'SET_LANGUAGE', payload: data.language });
      if (data.userType) dispatch({ type: 'SET_USER_TYPE', payload: data.userType });
      if (data.isAnonymous != null) dispatch({ type: 'SET_ANONYMOUS', payload: data.isAnonymous });
      // Only the server's persisted "report_ready" status counts — having
      // *some* extractedData mid-conversation does not mean the report is
      // actually ready (this used to trigger premature draft autosaves).
      dispatch({ type: 'SET_REPORT_READY', payload: data.status === 'report_ready' || data.status === 'completed' });
      return data;
    } catch (err) {
      console.error('[useConversation] hydrateConversation error:', err);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  // Manual correction on the Review screen — bypasses the chat entirely but
  // writes through the same canonical conversation record on the backend,
  // and re-syncs MedDRA mapping + completeness so nothing goes stale.
  const saveFieldEdits = useCallback(async (extractedData) => {
    if (!state.conversationId) return null;
    try {
      const { data } = await conversationApi.updateFields(state.conversationId, extractedData);
      dispatch({ type: 'SET_EXTRACTED_DATA', payload: data.extractedData });
      if (data.meddraData) dispatch({ type: 'SET_MEDDRA_DATA', payload: data.meddraData });
      if (data.completenessScore != null) dispatch({ type: 'SET_COMPLETENESS', payload: data.completenessScore });
      return data;
    } catch (err) {
      console.error('[useConversation] saveFieldEdits error:', err);
      throw err;
    }
  }, [state.conversationId, dispatch]);

  // Generates a professional ICSR draft from whatever has actually been
  // collected so far — an explicit, user-initiated step, never automatic.
  const generateDraftReport = useCallback(async () => {
    if (!state.conversationId) return null;
    const { data } = await conversationApi.generateDraft(state.conversationId);
    if (data.meddraData) dispatch({ type: 'SET_MEDDRA_DATA', payload: data.meddraData });
    if (data.completenessScore != null) dispatch({ type: 'SET_COMPLETENESS', payload: data.completenessScore });
    return data;
  }, [state.conversationId, dispatch]);

  // "Save & finish later": store whatever has been collected so far as a
  // draft the user can resume from My Reports. The conversation itself is
  // already persisted server-side on every turn.
  const saveForLater = useCallback(async () => {
    if (!state.conversationId || state.conversationId.startsWith('offline-')) return { saved: false };
    if (!state.extractedData) return { saved: true, draft: false };
    const result = await reportApi.saveDraft({
      conversationId: state.conversationId,
      extractedData: state.extractedData,
      completenessScore: state.completenessScore,
      isAnonymous: state.isAnonymous,
      language: state.language,
    });
    return { saved: true, draft: true, reportId: result.data?.reportId };
  }, [state.conversationId, state.extractedData, state.completenessScore, state.isAnonymous, state.language]);

  const resetConversation = useCallback(() => {
    forgetActiveConversation();
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  // Language is explicit conversation state. Changing it is saved on the server
  // straight away; if the patient hasn't spoken yet, the welcome message is
  // re-written in the new language (earlier chat history is left as it was).
  const changeLanguage = useCallback(async (lang) => {
    dispatch({ type: 'SET_LANGUAGE', payload: lang });
    const first = state.messages[0];
    const untouched = state.messages.length > 0 && !state.messages.some((m) => m.role === 'user');

    if (!state.conversationId) return;
    if (state.conversationId.startsWith('offline-')) {
      if (untouched && first) dispatch({ type: 'REPLACE_MESSAGE', payload: { id: first.id, clientId: first.clientId, content: tSafety('offlineWelcome', lang) } });
      return;
    }
    try {
      const { data } = await conversationApi.setLanguage(state.conversationId, lang);
      if (data.welcome && first) dispatch({ type: 'REPLACE_MESSAGE', payload: { id: first.id, clientId: first.clientId, content: data.welcome.content } });
    } catch (err) {
      console.error('[useConversation] changeLanguage error:', err);
    }
  }, [state.conversationId, state.messages, dispatch]);

  const changeUserType = useCallback((type) => {
    dispatch({ type: 'SET_USER_TYPE', payload: type });
  }, [dispatch]);

  const changeAnonymous = useCallback((anon) => {
    dispatch({ type: 'SET_ANONYMOUS', payload: anon });
  }, [dispatch]);

  return {
    ...state,
    startConversation,
    sendMessage,
    endConversation,
    hydrateConversation,
    resetConversation,
    saveDraftAutomatically,
    saveForLater,
    saveFieldEdits,
    generateDraftReport,
    changeLanguage,
    changeUserType,
    changeAnonymous,
  };
}
