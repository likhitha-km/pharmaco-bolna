import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Trash2, Send, Copy, Edit3 } from 'lucide-react';

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

export default function MyReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState(() => readCachedReports());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [actioning, setActioning] = useState(null);

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
    setActioning(report.id);
    try {
      await reportApi.delete(report.id);
      await loadReports();
    } catch (err) {
      console.error('Delete failed', err);
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

  const handleEdit = (report) => navigate(`/report/review/${report.conversationId || report.id}`);

  return (
    <main className="page-content">
      <div className="container" style={{ maxWidth: 800, padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 className="text-h1" style={{ marginBottom: 4 }}>My Reports</h1>
            <p className="text-body">Your submitted ADR reports</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/report')} aria-label="File a new report">
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
            <button className="btn btn-primary" onClick={() => navigate('/report')}>Report a Side Effect</button>
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
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>
                    <Edit3 size={14} /> Edit
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r)} disabled={actioning === r.id}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSubmit(r)} disabled={actioning === r.id || r.status === 'submitted'}>
                    <Send size={14} /> {r.status === 'submitted' ? 'Submitted' : 'Submit'}
                  </button>
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
    </main>
  );
}
