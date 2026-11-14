import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { gz } from '../gamingApi';
import { GzModal, useFlash } from '../gamingUi';

export default function JoinCodeModal({ onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, showFlash] = useFlash();
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      onJoined(await gz('/join-by-code', { method: 'POST', body: { code } }));
    } catch (err) {
      showFlash(err.message);
      setBusy(false);
    }
  };
  return (
    <GzModal title="Join a private room" icon={KeyRound} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="gmz-form-row">
          <input
            className="input gmz-field is-grow gmz-code-input"
            placeholder="6-letter invite code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            autoFocus
          />
        </div>
        {flash}
        <div className="gmz-form-row gmz-modal-actions">
          <button type="submit" className="btn btn-primary gmz-btn" disabled={busy || code.length !== 6}>{busy ? 'Joining…' : 'Join room'}</button>
          <button type="button" className="btn btn-ghost gmz-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </GzModal>
  );
}
