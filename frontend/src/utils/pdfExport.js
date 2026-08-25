function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export function exportReportPdf(report, title = 'Pharmaco ADR Report') {
  const printableWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printableWindow) {
    window.alert('Please allow popups to download your report as PDF.');
    return;
  }

  const icsr = report?.icsr || report || {};
  const med = icsr.suspect_drugs?.[0] || report?.extractedData?.suspected_medicines?.[0] || {};
  const reactions = icsr.adverse_events || report?.extractedData?.adverse_reactions || [];
  const patient = icsr.patient || report?.extractedData?.patient || {};
  const clinical = icsr.clinical_context || report?.extractedData?.clinical_context || {};
  const causality = icsr.causality || report?.extractedData?.causality_signals || {};
  const narrative = icsr.narrative || 'No narrative generated.';

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; margin: 24px; line-height: 1.5; }
        h1, h2 { color: #0f172a; margin-bottom: 8px; }
        .meta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; color: #4b5563; font-size: 13px; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
        .row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        .label { width: 180px; color: #6b7280; font-weight: 600; flex-shrink: 0; }
        .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 600; }
        @media print { body { margin: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">
        <span class="pill">Report ID: ${formatValue(icsr.report_id || report?.id || 'Pending')}</span>
        <span>${formatValue(report?.status || 'draft')}</span>
        <span>${formatValue(report?.createdAt ? new Date(report.createdAt).toLocaleString('en-IN') : '')}</span>
      </div>

      <div class="card">
        <h2>Narrative Summary</h2>
        <p>${formatValue(narrative)}</p>
      </div>

      <div class="card">
        <h2>Patient Information</h2>
        <div class="row"><div class="label">Initials</div><div>${formatValue(patient.initials || 'Anonymous')}</div></div>
        <div class="row"><div class="label">Age Group</div><div>${formatValue(patient.age_group)}</div></div>
        <div class="row"><div class="label">Gender</div><div>${formatValue(patient.gender)}</div></div>
        <div class="row"><div class="label">Weight</div><div>${formatValue(patient.weight)}</div></div>
      </div>

      <div class="card">
        <h2>Suspect Drug</h2>
        <div class="row"><div class="label">Drug Name</div><div>${formatValue(med.name)}</div></div>
        <div class="row"><div class="label">Dosage</div><div>${formatValue(med.dosage)}</div></div>
        <div class="row"><div class="label">Frequency</div><div>${formatValue(med.frequency)}</div></div>
        <div class="row"><div class="label">Route</div><div>${formatValue(med.route)}</div></div>
        <div class="row"><div class="label">Start Date</div><div>${formatValue(med.start_date)}</div></div>
      </div>

      <div class="card">
        <h2>Adverse Reactions</h2>
        ${reactions.map((reaction, index) => `
          <div style="margin-bottom: 12px;">
            <div class="row"><div class="label">Reaction ${index + 1}</div><div>${formatValue(reaction.original_text || reaction.english_translation || reaction.name)}</div></div>
            <div class="row"><div class="label">Onset</div><div>${formatValue(reaction.onset_date)}</div></div>
            <div class="row"><div class="label">Severity</div><div>${formatValue(reaction.severity)}</div></div>
            <div class="row"><div class="label">Outcome</div><div>${formatValue(reaction.outcome || clinical.outcome)}</div></div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <h2>Clinical Context</h2>
        <div class="row"><div class="label">Reason for Taking</div><div>${formatValue(clinical.reason_for_taking)}</div></div>
        <div class="row"><div class="label">Medical History</div><div>${formatValue(clinical.medical_history)}</div></div>
        <div class="row"><div class="label">Concomitant Medications</div><div>${formatValue(clinical.concomitant_medications?.join(', '))}</div></div>
        <div class="row"><div class="label">Outcome</div><div>${formatValue(clinical.outcome)}</div></div>
      </div>

      <div class="card">
        <h2>Causality</h2>
        <div class="row"><div class="label">Dechallenge</div><div>${formatValue(causality.dechallenge)}</div></div>
        <div class="row"><div class="label">Rechallenge</div><div>${formatValue(causality.rechallenge)}</div></div>
      </div>
    </body>
  </html>`;

  printableWindow.document.write(html);
  printableWindow.document.close();
  printableWindow.focus();
  printableWindow.onload = () => {
    printableWindow.print();
  };
}
