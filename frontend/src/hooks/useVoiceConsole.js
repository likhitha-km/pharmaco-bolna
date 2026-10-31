import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceApi } from '../utils/api.js';

/**
 * Live state for the Pharmaco Voice call console: the call list plus the
 * transcript, tool timeline and report of the selected call, kept current
 * over the backend's server-sent event stream.
 */
export function useVoiceConsole() {
  const [calls, setCalls] = useState({});
  const [details, setDetails] = useState({});
  const [reports, setReports] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);
  const followNextRef = useRef(false);
  const selectedRef = useRef(null);
  selectedRef.current = selectedId;

  const loadReport = useCallback(async (id) => {
    try {
      const { data } = await voiceApi.call(id);
      setDetails((prev) => ({ ...prev, [id]: { transcript: data.call.transcript || [], events: data.call.events || [] } }));
      setCalls((prev) => ({ ...prev, [id]: { ...prev[id], ...data.call } }));
      if (data.report) setReports((prev) => ({ ...prev, [id]: data.report }));
    } catch {
      /* call may have been pruned — ignore */
    }
  }, []);

  const selectCall = useCallback((id) => {
    setSelectedId(id);
    if (id) loadReport(id);
  }, [loadReport]);

  /** Auto-select the next call that appears (after the user starts one). */
  const followNextCall = useCallback(() => { followNextRef.current = true; }, []);

  useEffect(() => {
    let source;
    let cancelled = false;

    const refreshList = () =>
      voiceApi.calls().then(({ data }) => {
        if (cancelled) return;
        setCalls(Object.fromEntries(data.calls.map((c) => [c.id, c])));
        if (!selectedRef.current && data.calls[0]) {
          setSelectedId(data.calls[0].id);
          loadReport(data.calls[0].id);
        }
      }).catch(() => {});

    refreshList();
    try {
      source = new EventSource(voiceApi.eventsUrl());
      source.onopen = () => { setConnected(true); refreshList(); };
      source.onerror = () => setConnected(false);
      source.onmessage = (msg) => {
        let event;
        try { event = JSON.parse(msg.data); } catch { return; }
        const { callId, call, ...rest } = event;
        if (!callId) return;

        if (call) setCalls((prev) => ({ ...prev, [callId]: { ...prev[callId], ...call } }));
        if (event.type !== 'call.created') {
          setDetails((prev) => {
            const cur = prev[callId] || { transcript: [], events: [] };
            const next = { ...cur, events: [...cur.events, rest] };
            if (event.type === 'transcript.turn') {
              next.transcript = [...cur.transcript, { role: event.role, text: event.text, text_en: event.text_en, at: event.at }];
            }
            return { ...prev, [callId]: next };
          });
        }

        if (event.type === 'call.created' && followNextRef.current) {
          followNextRef.current = false;
          setSelectedId(callId);
        }
        if (['report.filed', 'report.updated', 'pipeline.done'].includes(event.type)) loadReport(callId);
      };
    } catch {
      setConnected(false);
    }

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [loadReport]);

  const callList = Object.values(calls).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return {
    calls: callList,
    selected: selectedId ? calls[selectedId] : null,
    selectedDetails: selectedId ? details[selectedId] || { transcript: [], events: [] } : null,
    selectedReport: selectedId ? reports[selectedId] : null,
    selectCall,
    followNextCall,
    connected,
  };
}
