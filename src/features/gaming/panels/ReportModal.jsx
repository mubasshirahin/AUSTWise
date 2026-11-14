import { useState } from 'react';
import { Flag } from 'lucide-react';
import { gz } from '../gamingApi';
import { GzModal, Badge, useFlash } from '../gamingUi';

const REASONS = [
  ['toxicity', 'Toxic or abusive'],
  ['harassment', 'Harassment'],
  ['cheating', 'Cheating'],
  ['spam', 'Spam'],
  ['scam', 'Scam / phishing'],
  ['no_show', 'No-show / left mid-game'],
  ['other', 'Something else'],
];

export default function ReportModal({ target, roomId, message, onClose }) {
  const [reason, setReason] = useState('toxicity');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [flash, showFlash] = useFlash();

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await gz('/reports', { method: 'POST', body: { targetUserId: target.id, roomId, messageId: message?.id, reason, details } });
      setDone(true);
    } catch (err) {
      showFlash(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GzModal
      title={`Report ${target.name}`}
      icon={Flag}
      onClose={onClose}
      summary={<><Badge>Goes to gaming mods</Badge>{message && <Badge tone="amber">Message attached</Badge>}</>}
    >
      {done ? (
        <>
          <p className="gmz-text">Thanks. A gaming mod will review it.</p>
          <div className="gmz-form-row gmz-modal-actions"><button type="button" className="btn btn-primary gmz-btn" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <form onSubmit={submit}>
          {message && <blockquote className="gmz-quote">{message.text}</blockquote>}
          <div className="gmz-form-row">
            <select className="input gmz-field is-grow" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason">
              {REASONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="gmz-form-row">
            <textarea className="input gmz-field is-grow gmz-textarea" maxLength={500} placeholder="What happened? (optional)" value={details} onChange={(event) => setDetails(event.target.value)} />
          </div>
          {flash}
          <div className="gmz-form-row gmz-modal-actions">
            <button type="submit" className="btn btn-primary gmz-btn" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
            <button type="button" className="btn btn-ghost gmz-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </GzModal>
  );
}
