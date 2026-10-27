import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Download, FileText, LoaderCircle, Search, Trash2, Users, X } from 'lucide-react';
import { getCurrentUserId } from '../../utils/authStorage';
import { deleteQuestionPaper } from '../../utils/questionBankStorage';

const departments = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];
const examTypes = ['Mid', 'Final', 'Quiz', 'Online', 'Assignment', 'Offline', 'Lab Mid', 'Lab Final', 'Project', 'Design'];

const formatSize = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function QuestionBankPanel() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [deletingId, setDeletingId] = useState('');

  const loadPapers = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/question-papers', { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load papers');
      setPapers(Array.isArray(data.papers) ? data.papers : []);
    } catch (e) {
      setStatusMsg(e.message || 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPapers(); }, []);

  const yearOptions = useMemo(() =>
    [...new Set(papers.map(p => String(p.year || '').trim()).filter(Boolean))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
  [papers]);

  const filteredPapers = useMemo(() => {
    let result = [...papers];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.course?.toLowerCase().includes(query) ||
        p.department?.toLowerCase().includes(query) ||
        p.yearSem?.toLowerCase().includes(query) ||
        p.type?.toLowerCase().includes(query) ||
        p.contributorName?.toLowerCase().includes(query) ||
        p.fileName?.toLowerCase().includes(query)
      );
    }
    if (departmentFilter !== 'all') result = result.filter(p => p.department === departmentFilter);
    if (typeFilter !== 'all') result = result.filter(p => p.type === typeFilter);
    if (yearFilter !== 'all') result = result.filter(p => String(p.year || '') === yearFilter);
    return result;
  }, [papers, searchQuery, departmentFilter, typeFilter, yearFilter]);

  const stats = useMemo(() => ({
    total: papers.length,
    solved: papers.filter(p => p.solved).length,
    contributors: new Set(papers.map(p => p.contributorId).filter(Boolean)).size,
    departments: new Set(papers.map(p => p.department).filter(Boolean)).size,
  }), [papers]);

  const handleDelete = async (paper) => {
    if (!window.confirm(`Delete "${paper.name || paper.fileName || 'this paper'}" permanently? Students lose access to it immediately.`)) return;
    setDeletingId(paper.id);
    setStatusMsg('');
    try {
      // Server-first delete, then clean the local offline cache + file copy.
      const res = await fetch(`/api/question-papers/${encodeURIComponent(paper.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed on the server');
      await deleteQuestionPaper(paper.id, getCurrentUserId() || '', true).catch(() => { /* server copy already gone */ });
      setPapers(prev => prev.filter(p => p.id !== paper.id));
      setStatusMsg('Paper deleted.');
    } catch (e) {
      setStatusMsg(e.message || 'Delete failed');
      loadPapers();
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="admin-question-bank-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header + stats */}
      <div className="glass-card-static">
        <div className="admin-qb-heading">
          <span className="admin-qb-icon"><BookOpen size={19} /></span>
          <div><p className="admin-qb-kicker">RESOURCE VAULT</p><h2>Question bank</h2>
            <p>Review shared past papers, find uploads, or remove outdated files.</p></div>
          <span className="admin-qb-total"><strong>{stats.total}</strong><small>papers</small></span>
        </div>

        <div className="grid-4 mb-4" style={{ gap: '12px' }}>
          <div className="glass-card stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label" style={{ fontSize: '10px' }}>Total Papers</span>
              <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <span className="stat-value" style={{ fontSize: '22px' }}>{stats.total}</span>
            <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>all time</span>
          </div>
          <div className="glass-card stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label" style={{ fontSize: '10px' }}>Solved</span>
              <CheckCircle2 size={14} style={{ color: 'var(--accent-emerald)' }} />
            </div>
            <span className="stat-value" style={{ fontSize: '22px', color: 'var(--accent-emerald)' }}>{stats.solved}</span>
            <span className="stat-change positive">with solutions</span>
          </div>
          <div className="glass-card stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label" style={{ fontSize: '10px' }}>Contributors</span>
              <Users size={14} style={{ color: 'var(--accent-purple)' }} />
            </div>
            <span className="stat-value" style={{ fontSize: '22px' }}>{stats.contributors}</span>
            <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>unique uploaders</span>
          </div>
          <div className="glass-card stat-card">
            <div className="flex justify-between items-center">
              <span className="stat-label" style={{ fontSize: '10px' }}>Departments</span>
              <BookOpen size={14} style={{ color: 'var(--accent-amber)' }} />
            </div>
            <span className="stat-value" style={{ fontSize: '22px' }}>{stats.departments}</span>
            <span className="stat-change" style={{ color: 'var(--text-tertiary)' }}>covered</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: '200px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '0 12px' }}>
            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search by course, name, contributor, file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '8px 0', outline: 'none', fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-tertiary)' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <select aria-label="Department filter" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="input" style={{ width: '150px', padding: '8px 12px' }}>
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select aria-label="Exam type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input" style={{ width: '130px', padding: '8px 12px' }}>
            <option value="all">All Types</option>
            {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select aria-label="Year filter" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input" style={{ width: '110px', padding: '8px 12px' }}>
            <option value="all">All Years</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn btn-secondary" onClick={loadPapers} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <LoaderCircle size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Papers list */}
      <div className="glass-card-static">
        <label className="input-label" style={{ display: 'block', marginBottom: '10px' }}>
          {typeFilter === 'all' && departmentFilter === 'all' && yearFilter === 'all'
            ? `All papers (${papers.length})`
            : `Filtered papers (${filteredPapers.length} of ${papers.length})`}
        </label>

        {statusMsg && <p style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginBottom: '10px' }}>{statusMsg}</p>}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', padding: '16px 0' }}>
            <LoaderCircle size={16} className="animate-spin" /> Loading papers…
          </div>
        ) : filteredPapers.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: '24px 0' }}>
            {papers.length === 0 ? 'No question papers uploaded yet. Students upload them from the Vault → Question Bank.' : 'No papers match the current search or filters.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
            {filteredPapers.map(paper => (
              <div
                key={paper.id}
                className="flex justify-between items-center p-3"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {paper.department && <span className="badge badge-blue" style={{ fontSize: '7px', padding: '1px 4px' }}>{paper.department}</span>}
                    <span className="badge" style={{ fontSize: '7px', padding: '1px 4px' }}>{paper.yearSem || paper.year || '—'}</span>
                    <span className="badge" style={{ fontSize: '7px', padding: '1px 4px' }}>{paper.course || '—'}</span>
                    {paper.type && <span className="badge badge-amber" style={{ fontSize: '7px', padding: '1px 4px' }}>{paper.type}{Number(paper.paperNo) > 1 ? ` ${paper.paperNo}` : ''}</span>}
                    {paper.solved && <span className="badge badge-emerald" style={{ fontSize: '7px', padding: '1px 4px' }}>SOLVED</span>}
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {paper.name || paper.fileName || 'Untitled paper'}
                  </h4>
                  <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[paper.contributorName && `by ${paper.contributorName}`, formatDate(paper.uploadedAt), formatSize(paper.size)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/api/question-papers/download/${encodeURIComponent(paper.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-secondary"
                    title={paper.fileName || 'Download paper'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Download size={12} /> File
                  </a>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => handleDelete(paper)}
                    disabled={deletingId === paper.id}
                    aria-label={`Delete ${paper.name || paper.fileName || 'paper'}`}
                    style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', padding: '4px', width: '28px', height: '28px' }}
                  >
                    {deletingId === paper.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
