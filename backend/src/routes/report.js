import express from 'express';
import { getReport, getUserReports, saveReport, deleteReport, deleteConversation, updateConversation, getConversation, getReportsByConversationId } from '../services/firebaseService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/report/draft
router.post('/draft', requireAuth, async (req, res) => {
  try {
    const { conversationId, extractedData, icsr, completenessScore, isAnonymous = true, language } = req.body;
    const userId = req.user?.uid || 'anonymous';
    const existingReports = conversationId ? await getReportsByConversationId(conversationId, 20) : [];
    const existingDraft = existingReports.find((report) => report.status === 'draft');
    const draftId = existingDraft?.id || `${conversationId || 'draft'}-${Date.now()}`;

    const draftReport = {
      id: draftId,
      conversationId,
      userId: userId || 'anonymous',
      extractedData,
      icsr,
      completenessScore,
      status: 'draft',
      isAnonymous,
      language: language || 'en-IN',
      createdAt: existingDraft?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: extractedData?.suspected_medicines?.[0]?.name || 'ADR Draft',
      reaction: extractedData?.adverse_reactions?.[0]?.original_text || extractedData?.adverse_reactions?.[0]?.english_translation || null,
    };

    await saveReport(draftReport);
    res.json({ success: true, reportId: draftId, report: draftReport, message: 'Draft saved successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/my-reports
router.get('/my-reports', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid || 'anonymous';
    // Withdrawn reports stay on file for pharmacovigilance but are not shown to the owner.
    const reports = (await getUserReports(userId, 50)).filter((r) => r.status !== 'withdrawn');
    res.json({ reports, count: reports.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/:reportId
router.get('/:reportId', async (req, res) => {
  try {
    const report = await getReport(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/report/:reportId
router.put('/:reportId', requireAuth, async (req, res) => {
  try {
    const report = await getReport(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const updated = {
      ...report,
      ...req.body,
      userId: req.user?.uid || report.userId || 'anonymous',
      updatedAt: new Date().toISOString(),
    };

    await saveReport(updated);
    res.json({ success: true, report: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/report/:reportId/submit
router.post('/:reportId/submit', requireAuth, async (req, res) => {
  try {
    const report = await getReport(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const medicine = report.extractedData?.suspected_medicines?.[0]?.name;
    const reaction = report.extractedData?.adverse_reactions?.[0]?.original_text;
    const onset = report.extractedData?.adverse_reactions?.[0]?.onset_date;

    if (!medicine || !reaction || !onset) {
      return res.status(400).json({ error: 'Required ADR fields are still missing.' });
    }

    const updated = {
      ...report,
      userId: req.user?.uid || report.userId || 'anonymous',
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveReport(updated);
    res.json({ success: true, report: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/report/:reportId/followup
router.post('/:reportId/followup', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'A follow-up message is required.' });
    }

    const report = await getReport(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const conversation = report.conversationId ? await getConversation(report.conversationId) : null;
    if (conversation) {
      const updatedMessages = [
        ...(conversation.messages || []),
        { role: 'user', content: message, timestamp: new Date().toISOString(), isFollowup: true },
      ];
      await updateConversation(report.conversationId, { messages: updatedMessages });
    }

    const followupEntry = { message: message.trim(), submittedAt: new Date().toISOString() };
    const updatedReport = {
      ...report,
      status: report.status === 'draft' ? report.status : 'followup_requested',
      followupMessages: [...(report.followupMessages || []), followupEntry],
      updatedAt: new Date().toISOString(),
    };
    await saveReport(updatedReport);

    res.json({ success: true, message: 'Your follow-up has been added to this report.', report: updatedReport });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/:reportId/icsr
router.get('/:reportId/icsr', async (req, res) => {
  try {
    const report = await getReport(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ icsr: report.icsr, completenessScore: report.completenessScore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/report/:reportId
// Only the report's owner can delete it (anyone else gets a 404, as if it did not exist).
//  - A draft was never submitted to PvPI: it is permanently deleted, together
//    with the chat it came from (unless another report still uses that chat).
//  - A submitted report is part of the pharmacovigilance record: it is
//    withdrawn — hidden from the owner's list but kept on file — not erased.
router.delete('/:reportId', requireAuth, async (req, res) => {
  try {
    const report = await getReport(req.params.reportId);
    const caller = req.user?.uid || 'anonymous';
    if (!report || (report.userId || 'anonymous') !== caller) return res.status(404).json({ error: 'Report not found' });

    if (report.status === 'draft') {
      await deleteReport(report.id);
      if (report.conversationId) {
        const others = (await getReportsByConversationId(report.conversationId, 20)).filter((r) => r.id !== report.id);
        if (others.length === 0) await deleteConversation(report.conversationId);
      }
      return res.json({ success: true, mode: 'deleted', message: 'Draft deleted' });
    }

    await saveReport({ ...report, status: 'withdrawn', withdrawnAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ success: true, mode: 'withdrawn', message: 'Report withdrawn' });
  } catch (error) {
    console.error('[DELETE /report/:id]', error);
    res.status(500).json({ error: 'Could not delete the report. Please try again.', message: error.message });
  }
});

export default router;
