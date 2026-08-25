import { useCallback, useRef } from 'react';
import { useConversationContext } from '../context/ConversationContext.jsx';
import { conversationApi, reportApi } from '../utils/api.js';

export function useConversation() {
  const { state, dispatch } = useConversationContext();
  const autoDraftedRef = useRef(new Set());

  const startConversation = useCallback(async (userType = 'patient', language = 'hi-IN', isAnonymous = true) => {
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_USER_TYPE', payload: userType });
    dispatch({ type: 'SET_LANGUAGE', payload: language });
    dispatch({ type: 'SET_ANONYMOUS', payload: isAnonymous });

    try {
      const { data } = await conversationApi.start({ userType, language, isAnonymous });
      dispatch({ type: 'SET_CONVERSATION_ID', payload: data.conversationId });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { role: 'assistant', content: data.welcomeMessage, timestamp: new Date().toISOString() },
      });
      return data.conversationId;
    } catch (err) {
      console.error('[useConversation] startConversation error:', err);
      // Offline fallback
      const fallbackId = 'offline-' + Date.now();
      dispatch({ type: 'SET_CONVERSATION_ID', payload: fallbackId });
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { role: 'assistant', content: language === 'hi-IN' ? 'नमस्ते! मैं Pharmaco का सहायक हूं। आप जो दवाई ले रहे थे, उसका नाम बताइए।' : "Hello! I'm Pharmaco's assistant. Which medicine did you take?", timestamp: new Date().toISOString() },
      });
      return fallbackId;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  const saveDraftAutomatically = useCallback(async (conversationId, extractedData, completenessScore, language, isAnonymous) => {
    if (!conversationId || !extractedData) return null;
    const key = `${conversationId}:${JSON.stringify(extractedData?.suspected_medicines || [])}:${JSON.stringify(extractedData?.adverse_reactions || [])}`;
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

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !state.conversationId) return;

    // Add user message immediately
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'user', content: text, timestamp: new Date().toISOString() } });
    dispatch({ type: 'SET_LOADING', payload: true });

    // Add placeholder bot message for streaming feel
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', timestamp: new Date().toISOString(), isLoading: true } });

    try {
      const historyPayload = state.messages.map(m => ({ role: m.role, content: m.content }));

      const { data } = await conversationApi.message({
        conversationId: state.conversationId,
        message: text,
        userType: state.userType,
        language: state.language,
        history: historyPayload
      });

      dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: data.message });

      if (data.isEmergency) dispatch({ type: 'SET_EMERGENCY', payload: true });
      if (data.extractedData) dispatch({ type: 'SET_EXTRACTED_DATA', payload: data.extractedData });
      if (data.meddraData) dispatch({ type: 'SET_MEDDRA_DATA', payload: data.meddraData });
      if (data.completenessScore != null) dispatch({ type: 'SET_COMPLETENESS', payload: data.completenessScore });
      if (data.isReportReady) {
        dispatch({ type: 'SET_REPORT_READY', payload: true });
        await saveDraftAutomatically(state.conversationId, data.extractedData || state.extractedData, data.completenessScore ?? state.completenessScore, state.language, state.isAnonymous);
      }
    } catch (err) {
      dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: "I'm having trouble connecting. Please check your API key and try again." });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.conversationId, state.userType, state.language, state.messages, state.extractedData, state.completenessScore, state.isAnonymous, dispatch, saveDraftAutomatically]);

  const sendVoice = useCallback(async (audioBlob) => {
    if (!state.conversationId) return;
    
    // Optimistically add user bubble for voice so UI doesn't freeze
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'user', content: '🎤 (Processing audio...)', timestamp: new Date().toISOString(), isVoice: true, isLoading: true } });
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // Add placeholder bot message
    dispatch({ type: 'ADD_MESSAGE', payload: { role: 'assistant', content: '', timestamp: new Date().toISOString(), isLoading: true } });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('conversationId', state.conversationId);
      formData.append('language', state.language);
      const { data } = await conversationApi.voice(formData);
      
      dispatch({ type: 'UPDATE_VOICE_RESPONSE', payload: { transcript: data.transcript, message: data.message } });
      
      if (data.isReportReady) {
        dispatch({ type: 'SET_REPORT_READY', payload: true });
        await saveDraftAutomatically(state.conversationId, data.extractedData || state.extractedData, state.completenessScore, state.language, state.isAnonymous);
      }
    } catch (err) {
      console.error('[useConversation] sendVoice error:', err);
      dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: "Voice processing failed. Please try typing instead." });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.conversationId, state.language, state.extractedData, state.completenessScore, state.isAnonymous, dispatch, saveDraftAutomatically]);

  const endConversation = useCallback(async () => {
    if (!state.conversationId) return null;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data } = await conversationApi.end(state.conversationId);
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
      dispatch({ type: 'SET_REPORT_READY', payload: data.status === 'report_ready' || !!data.extractedData });
      return data;
    } catch (err) {
      console.error('[useConversation] hydrateConversation error:', err);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  const resetConversation = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const changeLanguage = useCallback((lang) => {
    dispatch({ type: 'SET_LANGUAGE', payload: lang });
  }, [dispatch]);

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
    sendVoice,
    endConversation,
    hydrateConversation,
    resetConversation,
    saveDraftAutomatically,
    changeLanguage,
    changeUserType,
    changeAnonymous,
  };
}
