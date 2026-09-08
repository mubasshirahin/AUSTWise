import { useState, useMemo } from 'react';
import { Plus, Wallet, ArrowDownToLine, ArrowUpFromLine, Trash2, Pencil } from 'lucide-react';
import { LpEmpty, LpModal, LpConfirm, useConfirmState } from './LifePlannerUI';
import {
  ledgerWithBalance, ledgerTotals, fmtMoney, addTransaction, updateTransaction,
  deleteTransaction, fmtDate, todayKey,
} from './lifePlannerStorage';

/**
 * Ledger (Section 5.6): transaction table with running balance, summary
 * card, add/edit form (amount with +/- toggle, category suggestions from
 * previously used categories, optional goal link), inline delete.
 */
export default function LedgerView({ doc, update, onConfirm }) {
  const rows = useMemo(() => ledgerWithBalance(doc), [doc]);
  const totals = useMemo(() => ledgerTotals(doc), [doc]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ date: '', item: '', amount: '', sign: '-', category: '', relatedGoalId: '' });
  const [confirmState, setConfirmState] = useConfirmState();

  const categories = useMemo(
    () => [...new Set(doc.ledger.map((r) => r.category).filter(Boolean))],
    [doc.ledger]
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ date: todayKey(), item: '', amount: '', sign: '-', category: '', relatedGoalId: '' });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      date: row.date,
      item: row.item,
      amount: String(Math.abs(row.amount)),
      sign: row.amount < 0 ? '-' : '+',
      category: row.category || '',
      relatedGoalId: row.relatedGoalId || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.item.trim() || !Number.isFinite(amount) || amount === 0) return;
    const signed = form.sign === '-' ? -Math.abs(amount) : Math.abs(amount);
    const payload = {
      date: form.date || todayKey(),
      item: form.item,
      amount: signed,
      category: form.category,
      relatedGoalId: form.relatedGoalId || null,
    };
    if (editing) {
      update((d) => updateTransaction(d, editing.id, payload));
    } else {
      update((d) => addTransaction(d, payload));
    }
    setShowForm(false);
    setEditing(null);
  };

  const askDelete = (row) => {
    setConfirmState({
      title: 'Delete transaction?',
      message: `"${row.item}" (${fmtMoney(row.amount)}) will be removed and the running balance recalculated.`,
      onConfirm: () => { update((d) => deleteTransaction(d, row.id)); setConfirmState(null); },
    });
  };

  const goalTitle = (id) => {
    const g = doc.goals.find((x) => x.id === id);
    return g ? `G${g.number} ${g.title}` : null;
  };

  return (
    <div>
      {/* Summary */}
      <div className="lp-stats">
        <div className="lp-stat">
          <span className="lp-stat-icon green"><ArrowDownToLine size={16} /></span>
          <div>
            <div className="lp-stat-value" style={{ color: 'var(--accent-emerald)' }}>+{fmtMoney(totals.inflow)}</div>
            <div className="lp-stat-label">Inflow</div>
          </div>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-icon rose"><ArrowUpFromLine size={16} /></span>
          <div>
            <div className="lp-stat-value" style={{ color: 'var(--accent-rose)' }}>−{fmtMoney(totals.outflow)}</div>
            <div className="lp-stat-label">Outflow</div>
          </div>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-icon"><Wallet size={16} /></span>
          <div>
            <div className="lp-stat-value">{fmtMoney(totals.balance)}</div>
            <div className="lp-stat-label">Balance</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="lp-toolbar">
        <span className="lp-spacer" />
        <button type="button" className="lp-add-btn" onClick={openAdd}>
          <Plus size={14} /> Add transaction
        </button>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <LpEmpty
          icon={Wallet}
          title="No transactions yet"
          hint="Log money in and out — the running balance is calculated for you."
        />
      ) : (
        <div className="lp-panel" style={{ overflowX: 'auto' }}>
          <table className="lp-ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</td>
                  <td>
                    {row.item}
                    {row.category && <span className="lp-badge lp-badge-muted" style={{ marginLeft: 6 }}>{row.category}</span>}
                    {row.relatedGoalId && (
                      <span className="lp-badge lp-badge-cyan" style={{ marginLeft: 6 }}>{goalTitle(row.relatedGoalId)}</span>
                    )}
                  </td>
                  <td className={row.amount >= 0 ? 'lp-amt-in' : 'lp-amt-out'} style={{ textAlign: 'right' }}>
                    {row.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(row.amount))}
                  </td>
                  <td className="lp-amt-bal" style={{ textAlign: 'right' }}>{fmtMoney(row.balance)}</td>
                  <td style={{ width: 60, textAlign: 'right' }}>
                    <button type="button" className="lp-icon-btn" onClick={() => openEdit(row)} aria-label={`Edit ${row.item}`}>
                      <Pencil size={12} />
                    </button>
                    <button type="button" className="lp-icon-btn" onClick={() => askDelete(row)} aria-label={`Delete ${row.item}`}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <LpModal title={editing ? 'Edit transaction' : 'Add transaction'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <form onSubmit={handleSubmit} className="lp-form-grid">
            <div>
              <label className="lp-form-label" htmlFor="lp-tx-item">Item</label>
              <input id="lp-tx-item" className="input" value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))} placeholder="e.g. Course materials" autoFocus />
            </div>
            <div className="lp-form-row">
              <div style={{ maxWidth: 90 }}>
                <label className="lp-form-label" htmlFor="lp-tx-sign">Type</label>
                <select id="lp-tx-sign" className="input" value={form.sign} onChange={(e) => setForm((f) => ({ ...f, sign: e.target.value }))}>
                  <option value="-">− Out</option>
                  <option value="+">+ In</option>
                </select>
              </div>
              <div>
                <label className="lp-form-label" htmlFor="lp-tx-amount">Amount</label>
                <input id="lp-tx-amount" type="number" step="any" min="0" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="e.g. 800" />
              </div>
              <div>
                <label className="lp-form-label" htmlFor="lp-tx-date">Date</label>
                <input id="lp-tx-date" type="date" className="input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="lp-form-row">
              <div>
                <label className="lp-form-label" htmlFor="lp-tx-category">Category</label>
                <input id="lp-tx-category" className="input" list="lp-tx-cat-list" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Learning" />
                <datalist id="lp-tx-cat-list">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="lp-form-label" htmlFor="lp-tx-goal">Link to goal</label>
                <select id="lp-tx-goal" className="input" value={form.relatedGoalId} onChange={(e) => setForm((f) => ({ ...f, relatedGoalId: e.target.value }))}>
                  <option value="">None</option>
                  {doc.goals.map((g) => (
                    <option key={g.id} value={g.id}>G{g.number} {g.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>{editing ? 'Save' : 'Add'}</button>
            </div>
          </form>
        </LpModal>
      )}

      {confirmState && (
        <LpConfirm
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
