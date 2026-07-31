import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getAllAccounts,
  signupAccount,
  getAccountById,
} from '../utils/authStorage';
import {
  Bug, X, Star, User, Shield, GraduationCap,
  Users, Check, LogIn, Sparkles, RotateCcw,
  BookOpen,
} from 'lucide-react';
import './DevToolbar.css';

const MAIN_USER_KEY = 'aust-dev-main-user';

const DEPARTMENTS = [
  'CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA',
];

const SECTIONS = ['A', 'B', 'C'];

const ROLE_ICONS = {
  student: GraduationCap,
  faculty: Users,
  alumni: BookOpen,
  admin: Shield,
  moderator: Shield,
  cr: Star,
  sr: Star,
  senior: Users,
};

const STUDENT_NAMES = [
  'Fahim Rahman', 'Nusrat Jahan', 'Tanvir Hasan', 'Sadia Islam',
  'Rafiq Ahmed', 'Mim Akter', 'Jubayer Ali', 'Tasnim Esha',
  'Sakib Khan', 'Nowrin Sultana',
];

const FACULTY_NAMES = [
  'Prof. Dr. Abdur Rahman', 'Dr. Farhana Yasmin', 'Dr. Shafiul Alam',
  'Dr. Nazia Hossain', 'Mr. Tanvir Ahmed', 'Dr. Rokeya Begum',
  'Dr. Ruhul Amin', 'Ar. Khaleda Akter', 'Dr. A.K.M. Fazlul Haque',
  'Mr. Shahidul Islam', 'Dr. S.M. Abdur Razzak', 'Mr. Hasanuzzaman',
  'Dr. Golam Mostafa', 'Ms. Selina Parvin', 'Prof. Dr. Rashid Karim',
];

const DESIGNATIONS = [
  'Professor & Head', 'Professor', 'Associate Professor',
  'Assistant Professor', 'Lecturer', 'Senior Lecturer',
];

function getRoleIcon(role) {
  const Icon = ROLE_ICONS[role] || User;
  return <Icon size={14} />;
}

function getRoleColor(role) {
  const colors = {
    student: 'var(--accent-blue)',
    faculty: 'var(--accent-purple)',
    alumni: 'var(--accent-cyan)',
    admin: 'var(--accent-rose)',
    moderator: 'var(--accent-rose)',
    cr: 'var(--accent-amber)',
    sr: 'var(--accent-emerald)',
    senior: 'var(--accent-purple)',
  };
  return colors[role] || 'var(--text-secondary)';
}

function getRoleLabel(role) {
  const labels = {
    student: 'Student',
    faculty: 'Faculty',
    alumni: 'Alumni',
    admin: 'Admin',
    moderator: 'Moderator',
    cr: 'CR',
    sr: 'SR',
    senior: 'Senior',
  };
  return labels[role] || role;
}

export default function DevToolbar() {
  const { user, loginDirect } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [mainUserId, setMainUserId] = useState(() => localStorage.getItem(MAIN_USER_KEY) || '');
  const [refreshKey, setRefreshKey] = useState(0);

  // Batch generation mode: 'student' | 'faculty'
  const [genMode, setGenMode] = useState('student');

  // Student batch form
  const [dept, setDept] = useState('CSE');
  const [semester, setSemester] = useState(3);
  const [section, setSection] = useState('A');

  // Faculty batch form
  const [facDept, setFacDept] = useState('CSE');
  const [facDesignation, setFacDesignation] = useState('Lecturer');
  const [facAmount, setFacAmount] = useState(3);

  const [isGenerating, setIsGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  // All accounts (excluding guest)
  const accounts = useMemo(() => {
    const all = getAllAccounts().filter(a => a.id !== 'guest' && a.role !== 'guest');
    // Filter to show only batch-generated accounts from current dept+sem? No, show all.
    // Sort: main user first, then by role group, then newest first
    return all.sort((a, b) => {
      if (a.id === mainUserId) return -1;
      if (b.id === mainUserId) return 1;
      const roleOrder = { sr: 0, cr: 1, student: 2, faculty: 3, admin: 4, alumni: 5, moderator: 6, senior: 7 };
      const aOrder = roleOrder[a.role] ?? 99;
      const bOrder = roleOrder[b.role] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, mainUserId]);

  // ─── Set main user ────────────────────────────────────────────────
  const setMainUser = useCallback((userId) => {
    setMainUserId(userId);
    localStorage.setItem(MAIN_USER_KEY, userId);
    setRefreshKey(k => k + 1);
  }, []);

  // ─── Switch account (one-click) ───────────────────────────────────
  const switchToAccount = useCallback((account) => {
    if (!mainUserId && user?.id && user.id !== 'guest') {
      setMainUser(user.id);
    }
    loginDirect(account);
    setRefreshKey(k => k + 1);
  }, [loginDirect, mainUserId, user, setMainUser]);

  // ─── Generate student batch: SR + 2 CRs + 10 students ────────────
  const generateBatch = useCallback(() => {
    setIsGenerating(true);
    setGenMessage('');

    try {
      const baseEmail = `${dept.toLowerCase()}.${section.toLowerCase()}.sem${semester}`;
      const password = 'test1234';
      const batchNo = String(2025 - semester + 1);
      let created = 0;

      // 1 SR
      try {
        signupAccount({
          name: `${dept} SR ${section} Sem${semester}`,
          email: `${baseEmail}.sr@aust.edu`, password, role: 'sr',
          department: dept, batchNo, section, semester,
        });
        created++;
      } catch { /* skip duplicate */ }

      // 2 CRs
      ['A1', 'A2'].forEach((lab, i) => {
        try {
          signupAccount({
            name: `${dept} CR ${lab} Sem${semester}`,
            email: `${baseEmail}.cr${i + 1}@aust.edu`, password, role: 'cr',
            department: dept, batchNo, section, labSection: lab, semester,
          });
          created++;
        } catch { /* skip duplicate */ }
      });

      // 10 students
      STUDENT_NAMES.forEach((name, i) => {
        try {
          signupAccount({
            name, email: `${baseEmail}.s${i + 1}@aust.edu`, password,
            role: 'student', department: dept, batchNo, section, semester,
          });
          created++;
        } catch { /* skip duplicate */ }
      });

      setGenMessage(`✅ Created ${created} accounts (1 SR + 2 CRs + ${Math.max(0, created - 3)} students)`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setGenMessage(`❌ ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [dept, semester, section]);

  // ─── Generate faculty batch ───────────────────────────────────────
  const generateFaculty = useCallback(() => {
    setIsGenerating(true);
    setGenMessage('');

    try {
      const password = 'test1234';
      let created = 0;
      const usedNames = [...FACULTY_NAMES];

      for (let i = 0; i < facAmount; i++) {
        try {
          const name = usedNames[i] || `Faculty ${i + 1}`;
          const email = `${facDept.toLowerCase()}.fac${i + 1}@aust.edu`;
          signupAccount({
            name,
            email,
            password,
            role: 'faculty',
            department: facDept,
            designation: facDesignation,
          });
          created++;
        } catch { /* skip duplicate */ }
      }

      setGenMessage(`✅ Created ${created} faculty (${facDesignation}, ${facDept})`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setGenMessage(`❌ ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [facDept, facDesignation, facAmount]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        className="dev-fab"
        onClick={() => setIsOpen(true)}
        title="Dev Tools (Ctrl+Shift+D)"
      >
        <Bug size={18} />
        <span className="dev-fab-dot" />
      </button>
    );
  }

  const isCurrentMain = user?.id && user.id !== 'guest' && mainUserId === user.id;

  return (
    <div className="dev-panel-overlay" onClick={() => setIsOpen(false)}>
      <div className="dev-panel" onClick={e => e.stopPropagation()}>
        {/* ─── Header ─── */}
        <div className="dev-panel-header">
          <div className="dev-panel-title">
            <Bug size={15} />
            <span>Dev Console</span>
          </div>
          <button className="dev-close-btn" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* ─── Current session ─── */}
        <div className="dev-session-bar">
          <div className="dev-session-info">
            <span className="dev-session-label">Session:</span>
            <span className="dev-session-name" style={{ color: getRoleColor(user?.role) }}>
              {user?.name || 'Guest'}
            </span>
            <span className="dev-role-pill" style={{ background: getRoleColor(user?.role), color: '#000' }}>
              {getRoleLabel(user?.role)}
            </span>
            {isCurrentMain && <Star size={11} className="dev-main-star-filled" fill="currentColor" />}
          </div>
          {user?.id && user.id !== 'guest' && !isCurrentMain && (
            <button
              className="dev-main-set-btn"
              onClick={() => setMainUser(user.id)}
              title="Set current user as Main"
            >
              <Star size={12} />
              Set Main
            </button>
          )}
        </div>

        {/* ─── Mode Tabs ─── */}
        <div className="dev-mode-tabs">
          <button
            className={`dev-mode-tab ${genMode === 'student' ? 'active' : ''}`}
            onClick={() => setGenMode('student')}
          >
            <GraduationCap size={13} />
            Students
          </button>
          <button
            className={`dev-mode-tab ${genMode === 'faculty' ? 'active' : ''}`}
            onClick={() => setGenMode('faculty')}
          >
            <Users size={13} />
            Faculty
          </button>
        </div>

        {/* ─── Student Batch Generator ─── */}
        {genMode === 'student' && (
          <div className="dev-generator">
            <div className="dev-gen-title">
              <Sparkles size={14} />
              <span>Generate Student Batch</span>
            </div>

            <div className="dev-gen-selects">
              <div className="dev-gen-field">
                <label>Department</label>
                <select value={dept} onChange={e => setDept(e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="dev-gen-field">
                <label>Semester</label>
                <select value={semester} onChange={e => setSemester(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>Sem {n}</option>)}
                </select>
              </div>
              <div className="dev-gen-field">
                <label>Section</label>
                <select value={section} onChange={e => setSection(e.target.value)}>
                  {SECTIONS.map(s => <option key={s} value={s}>Sec {s}</option>)}
                </select>
              </div>
            </div>

            <div className="dev-gen-info">
              <span>1 SR</span><span className="dev-gen-dot">+</span>
              <span>2 CRs</span><span className="dev-gen-dot">+</span>
              <span>10 Students</span><span className="dev-gen-dot">=</span>
              <strong>13 accounts</strong>
            </div>

            <button className="dev-gen-btn" onClick={generateBatch} disabled={isGenerating}>
              {isGenerating ? 'Creating...' : <><Sparkles size={14} /> Generate & Test Roles</>}
            </button>

            {genMessage && (
              <div className={`dev-gen-msg ${genMessage.startsWith('✅') ? 'success' : 'error'}`}>
                {genMessage}
              </div>
            )}
          </div>
        )}

        {/* ─── Faculty Generator ─── */}
        {genMode === 'faculty' && (
          <div className="dev-generator">
            <div className="dev-gen-title">
              <Users size={14} />
              <span>Generate Faculty</span>
            </div>

            <div className="dev-gen-selects">
              <div className="dev-gen-field">
                <label>Department</label>
                <select value={facDept} onChange={e => setFacDept(e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="dev-gen-field">
                <label>Designation</label>
                <select value={facDesignation} onChange={e => setFacDesignation(e.target.value)}>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="dev-gen-field">
                <label>Amount</label>
                <select value={facAmount} onChange={e => setFacAmount(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="dev-gen-info">
              <span>{facAmount} Faculty</span>
              <span className="dev-gen-dot">·</span>
              <span>{facDesignation}</span>
              <span className="dev-gen-dot">·</span>
              <span>{facDept}</span>
            </div>

            <button className="dev-gen-btn" onClick={generateFaculty} disabled={isGenerating}>
              {isGenerating ? 'Creating...' : <><Users size={14} /> Generate Faculty</>}
            </button>

            {genMessage && (
              <div className={`dev-gen-msg ${genMessage.startsWith('✅') ? 'success' : 'error'}`}>
                {genMessage}
              </div>
            )}
          </div>
        )}

        {/* ─── Quick Switch: Main User ─── */}
        {mainUserId && mainUserId !== user?.id && (() => {
          const mainAcc = getAccountById(mainUserId);
          if (!mainAcc) return null;
          return (
            <button
              className="dev-switch-main-btn"
              onClick={() => switchToAccount(mainAcc)}
            >
              <RotateCcw size={13} />
              <Star size={12} className="dev-star-icon" fill="currentColor" />
              <span>Switch back to <strong>{mainAcc.name}</strong></span>
            </button>
          );
        })()}

        {/* ─── Accounts List ─── */}
        <div className="dev-accounts-section">
          <div className="dev-accounts-header">
            <Users size={13} />
            <span>All Accounts</span>
            <span className="dev-accounts-count">{accounts.length}</span>
          </div>

          <div className="dev-accounts-list">
            {accounts.length === 0 ? (
              <div className="dev-empty">
                <Users size={22} />
                <span>No accounts. Generate one above!</span>
              </div>
            ) : (
              accounts.map(acc => {
                const isActive = user?.id === acc.id;
                const isMain = acc.id === mainUserId;
                const isBatch = acc._devBatch || acc.email?.includes('.sem');
                return (
                  <div
                    key={acc.id}
                    className={`dev-acct ${isActive ? 'active' : ''} ${isMain ? 'main' : ''}`}
                    onClick={() => !isActive && switchToAccount(acc)}
                  >
                    <div className="dev-acct-avatar" style={{ background: getRoleColor(acc.role) }}>
                      {getRoleIcon(acc.role)}
                    </div>
                    <div className="dev-acct-info">
                      <div className="dev-acct-name">
                        {acc.name}
                        {isMain && <Star size={10} className="dev-main-star" fill="currentColor" />}
                        {isActive && <Check size={10} className="dev-active-check" />}
                      </div>
                      <div className="dev-acct-meta">
                        <span className="dev-role-tag" style={{ color: getRoleColor(acc.role) }}>
                          {getRoleLabel(acc.role)}
                        </span>
                        {acc.department && <span>{acc.department}</span>}
                        {acc.semester && <span>Sem {acc.semester}</span>}
                        {acc.section && <span>Sec {acc.section}</span>}
                        {acc.labSection && <span>Lab {acc.labSection}</span>}
                      </div>
                    </div>
                    <div className="dev-acct-actions">
                      {!isActive && (
                        <button
                          className="dev-switch-btn"
                          onClick={e => { e.stopPropagation(); switchToAccount(acc); }}
                          title="Switch"
                        >
                          <LogIn size={12} />
                        </button>
                      )}
                      <button
                        className={`dev-star-btn ${isMain ? 'active' : ''}`}
                        onClick={e => { e.stopPropagation(); isMain ? setMainUser('') : setMainUser(acc.id); }}
                        title={isMain ? 'Remove Main' : 'Set as Main'}
                      >
                        <Star size={11} fill={isMain ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="dev-footer">
          <span>Ctrl+Shift+D <span className="dev-footer-hide">to toggle</span></span>
          <span>{accounts.length} total</span>
        </div>
      </div>
    </div>
  );
}
