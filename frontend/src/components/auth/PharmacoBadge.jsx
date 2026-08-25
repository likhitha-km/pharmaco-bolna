import { useEffect, useState } from 'react';
import { CheckCircle, Copy } from 'lucide-react';

export default function PharmacoBadge({ id }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!id) {
      return;
    }

    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
    } catch (_err) {
      setCopied(false);
    }
  };

  return (
    <div className="pharmaco-badge">
      <p className="pharmaco-badge-label">Your Pharmaco ID</p>
      <div className="pharmaco-badge-id">
        <span>{id || '---'}</span>
        <button type="button" className="pharmaco-copy-btn" onClick={handleCopy} aria-label="Copy Pharmaco ID">
          {copied ? <CheckCircle size={18} color="#34C759" /> : <Copy size={18} color="#CC785C" />}
        </button>
      </div>
      <p className="field-hint">Save this ID. You can use it to sign in from any device.</p>
    </div>
  );
}
