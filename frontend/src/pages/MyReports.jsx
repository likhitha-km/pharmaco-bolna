import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Send, Copy, Edit3, MessageSquarePlus, MessageCircle } from 'lucide-react';
import { showToast } from '../components/common/Toast.jsx';

const REPORT_CACHE_KEY = 'pharmaco_cached_reports';

function readCachedReports() {
  try {
    const cached = localStorage.getItem(REPORT_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function writeCachedReports(reports) {
  try {
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(reports));
  } catch {
    // ignore storage issues
  }
}
import { ReportCard } from '../components/report/ReportCard.jsx';
import { ICSRReport } from '../components/report/ICSRReport.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Skeleton } from '../components/common/Skeleton.jsx';
import { reportApi } from '../utils/api.js';
import { ACTIVE_CONVERSATION_KEY } from '../hooks/useConversation.js';

export default function MyReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState(() => readCachedReports());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [actioning, setActioning] = useState(null);
  const [followupTarget, setFollowupTarget] = useState(null);
  const [followupText, setFollowupText] = useState('');
  const [followupSubmitting, setFollowupSubmitting] = useState(false);

  const loadReports = async () => {
    const cachedReports = readCachedReports();
    if (cachedReports.length > 0) {
      setReports(cachedReports);
    }

    setLoading(true);
    try {
      const { data } = await reportApi.myReports();
      const nextReports = data.reports || [];
      writeCachedReports(nextReports);
      setReports(nextReports);
    } catch {
      setReports(cachedReports);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await loadReports();
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (report) => {
    setActioning(report.id);
    try {
      await reportApi.submit(report.id);
      await loadReports();
    } catch (err) {
      console.error('Submit failed', err);
    } finally {
      setActioning(null);
    }
  };

  const handleDelete = async (report) => {
    const isDraft = report.status === 'draft';
    const confirmed = window.confirm(
      isDraft
        ? 'Delete this draft and its conversation? This can’t be undone.'
        : 'This report has already been submitted, so it stays on file for pharmacovigilance. It will be withdrawn and removed from your list. Continue?',
    );
    if (!confirmed) return;

    setActioning(report.id);
    try {
      await reportApi.delete(report.id);
      // Remove it right away (list and offline cache) rather than waiting for a reload.
      setReports((prev) => {
        const next = prev.filter((r) => r.id !== report.id);
        writeCachedReports(next);
        return next;
      });
      try {
        if (report.conversationId && localStorage.getItem(ACTIVE_CONVERSATION_KEY) === report.conversationId) {
          localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        }
      } catch { /* ignore */ }
      showToast(isDraft ? 'Draft deleted.' : 'Report withdrawn.', 'success');
    } catch (err) {
      console.error('Delete failed', err);
      showToast(err.response?.data?.error || 'Could not delete the report. Please check your connection and try again.', 'error');
    } finally {
      setActioning(null);
    }
  };

  const handleDuplicate = async (report) => {
    setActioning(report.id);
    try {
      await reportApi.saveDraft({
        conversationId: report.conversationId,
        extractedData: report.extractedData,
        icsr: report.icsr,
        completenessScore: report.completenessScore,
        isAnonymous: report.isAnonymous,
        language: report.language,
      });
      await loadReports();
    } catch (err) {
      console.error('Duplicate failed', err);
    } finally {
      setActioning(null);
    }
  };

  const handleView = (report) => setSelected(report);

  const openFollowup = (report) => {
    setFollowupTarget(report);
    setFollowupText('');
  };

  const submitFollowup = async () => {
    if (!followupTarget || !followupText.trim()) return;
    setFollowupSubmitting(true);
    try {
      await reportApi.followup(followupTarget.id, followupText.trim());
      showToast('Follow-up added to your report.', 'success');
      setFollowupTarget(null);
      setFollowupText('');
      await loadReports();
    } catch (err) {
      console.error('Follow-up failed', err);
      showToast('Could not send your follow-up. Please try again.', 'error');
    } finally {
      setFollowupSubmitting(false);
    }
  };

  const handleEdit = (report) => navigate(`/report/review/${report.conversationId || report.id}`);

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 800, padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 className="text-h1" style={{ marginBottom: 4 }}>My Reports</h1>
            <p className="text-body">Your submitted ADR reports</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/report?new=true')} aria-label="File a new report">
            <Plus size={18} aria-hidden="true" /> New Report
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height={100} radius={14} />)}
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <FileText size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 16px' }} aria-hidden="true" />
            <p className="text-h4" style={{ marginBottom: 8 }}>No reports yet</p>
            <p className="text-body" style={{ marginBottom: 24 }}>Have you experienced a medicine side effect? Report it to help others.</p>
            <button className="btn btn-primary" onClick={() => navigate('/report?new=true')}>Report a Side Effect</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((r) => (
              <div key={r.id} className="card" style={{ padding: 20 }}>
                <ReportCard report={r} onClick={() => handleView(r)} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleView(r)}>
                    <FileText size={14} /> View
                  </button>
                  {r.status === 'draft' && r.conversationId && (
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/report?resume=${encodeURIComponent(r.conversationId)}`)}>
                      <MessageCircle size={14} /> Continue in chat
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>
                    <Edit3 size={14} /> Edit
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r)} disabled={actioning === r.id}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSubmit(r)} disabled={actioning === r.id || r.status === 'submitted' || r.status === 'followup_requested'}>
                    <Send size={14} /> {r.status === 'submitted' || r.status === 'followup_requested' ? 'Submitted' : 'Submit'}
                  </button>
                  {(r.status === 'submitted' || r.status === 'followup_requested') && (
                    <button className="btn btn-ghost btn-sm" onClick={() => openFollowup(r)}>
                      <MessageSquarePlus size={14} /> Add Follow-up
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(r)} disabled={actioning === r.id}>
                    <Copy size={14} /> Duplicate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Report ${selected.id}`} size="lg">
          <ICSRReport report={selected.icsr || selected} />
        </Modal>
      )}

      {followupTarget && (
        <Modal isOpen={!!followupTarget} onClose={() => setFollowupTarget(null)} title={`Follow-up on ${followupTarget.id}`} size="sm">
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Add new information about this report — for example, whether the reaction has resolved or if you were hospitalized since submitting.
          </p>
          <textarea
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
            rows={4}
            className="input"
            placeholder="e.g. The rash has fully cleared up as of this week."
            style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-body)', marginBottom: 16 }}
            aria-label="Follow-up message"
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setFollowupTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitFollowup} disabled={!followupText.trim() || followupSubmitting}>
              {followupSubmitting ? 'Sending...' : 'Send Follow-up'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
