import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, ChevronDown, ChevronRight,
  GraduationCap, Layers,
  BadgeCheck, Star, Download, FileDown, Loader2,
  Crown, Briefcase,
} from 'lucide-react';
import brandMark from '../../assets/austwise-icon-final.svg';
import { getAllAccounts, createAwid } from '../../utils/authStorage';
import { getCachedMembers, refreshMemberDirectory } from '../../utils/memberDirectory';
import { useAuth } from '../../context/AuthContext';
import { formatSemesterLabel, getSemesterCountForDepartment } from '../../utils/semester';
import { DirectoryDepartmentHeader, DirectoryMemberCard } from './DirectoryShared';
import { getDepartmentLabel } from './directoryUtils';

// Role pill shown next to a student's name (and their label in the hover card).
const ROLE_TAGS = {
  vp: { short: 'VP', label: 'Vice President' },
  gs: { short: 'GS', label: 'General Secretary' },
  sr: { short: 'SR', label: 'Student Representative' },
  cr: { short: 'CR', label: 'Class Representative' },
};

// Extract student ID from @aust.edu email the same way the profile does
function extractStudentId(student) {
  const email = student.email || '';
  if (email.includes('@aust.edu')) {
    const prefix = email.split('@')[0] || '';
    const id = prefix.replace(/^[a-z.]+/i, '');
    if (id) return id;
  }
  return student.id || '';
}

const DEPARTMENTS = ['CSE', 'EEE', 'CE', 'ME', 'IPE', 'TE', 'ARCH', 'BBA'];

const DEPT_FULL_NAMES = {
  CSE: 'Computer Science & Engineering',
  EEE: 'Electrical & Electronic Engineering',
  CE: 'Civil Engineering',
  ME: 'Mechanical Engineering',
  IPE: 'Industrial & Production Engineering',
  TE: 'Textile Engineering',
  ARCH: 'Architecture',
  BBA: 'Business Administration',
};

const LAB_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];
const SECTION_ORDER = ['A', 'B', 'C', 'D'];
const EXPANDED_SEMESTERS_KEY = 'aust-student-directory-expanded-v1';
const EXPANDED_DEPARTMENTS_KEY = 'aust-student-directory-expanded-departments-v1';

function getSavedExpandedState(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}

function getSectionLetter(section) {
  return (section || '')[0]?.toUpperCase() || 'Z';
}

function getLabSortKey(labSection) {
  const idx = LAB_ORDER.indexOf(labSection);
  return idx >= 0 ? idx : 99;
}

// Shared style for account photos inside the circular slot avatars — fills the
// circle, crops to a round portrait, covers overflow.
const AVATAR_IMG_STYLE = { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' };

// Minimal HTML escaping for values injected into the export document.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function StudentDirectory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeDept, setActiveDept] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSems, setExpandedSems] = useState(() => getSavedExpandedState(EXPANDED_SEMESTERS_KEY));
  const [expandedDepts, setExpandedDepts] = useState(() => getSavedExpandedState(EXPANDED_DEPARTMENTS_KEY));
  const [directoryAccounts, setDirectoryAccounts] = useState(() => {
    const localById = new Map(getAllAccounts().map((account) => [account.id, account]));
    return getCachedMembers().map((member) => ({ ...localById.get(member.id), ...member }));
  });

  // Role approvals happen server-side. Refresh the sanitized public directory
  // list so VP/GS appointments appear for other users without relying on each
  // browser's stale local account cache.
  useEffect(() => {
    let cancelled = false;
    const syncDirectory = async () => {
      try {
        const members = await refreshMemberDirectory();
        if (cancelled) return;
        const localById = new Map(getAllAccounts().map((account) => [account.id, account]));
        setDirectoryAccounts(members.map((member) => ({
          ...(localById.get(member.id) || {}),
          ...member,
          email: localById.get(member.id)?.email || '',
        })));
      } catch { /* Keep the local directory when offline. */ }
    };
    syncDirectory();
    const timer = setInterval(syncDirectory, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    try {
      if (Object.keys(expandedSems).length) {
        sessionStorage.setItem(EXPANDED_SEMESTERS_KEY, JSON.stringify(expandedSems));
      } else {
        sessionStorage.removeItem(EXPANDED_SEMESTERS_KEY);
      }
    } catch { /* Expansion state is best-effort across refreshes. */ }
  }, [expandedSems]);

  useEffect(() => {
    try {
      if (Object.keys(expandedDepts).length) {
        sessionStorage.setItem(EXPANDED_DEPARTMENTS_KEY, JSON.stringify(expandedDepts));
      } else {
        sessionStorage.removeItem(EXPANDED_DEPARTMENTS_KEY);
      }
    } catch { /* Expansion state is best-effort across refreshes. */ }
  }, [expandedDepts]);

  // Get all accounts and group them by dept → sem.
  // Every semester slot (1 → total for the dept) is always created so the full
  // academic structure renders — whether or not students are registered yet.
  const { grouped, deptStats, deptExecs } = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const students = directoryAccounts.filter((account) => {
      if (!['student', 'cr', 'sr', 'vp', 'gs'].includes(account.role)) return false;
      if (!query) return true;
      return [account.name, account.email, account.studentId, account.awid,
        account.department, account.labSection, account.section, extractStudentId(account)]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });

    const grouped = {};
    const deptStats = {};
    const deptExecs = {};

    for (const dept of DEPARTMENTS) {
      const deptStudents = students.filter(s => s.department === dept);
      const totalSemesters = getSemesterCountForDepartment(dept);

      grouped[dept] = {};
      deptExecs[dept] = {
        vp: deptStudents.find(s => s.role === 'vp') || null,
        gs: deptStudents.find(s => s.role === 'gs') || null,
      };
      deptStats[dept] = { total: deptStudents.length, semesters: 0, totalSemesters };

      // Loop over the dept's full semester range, but also cover any student
      // whose semester value exceeds it so nobody gets hidden from the list.
      const maxSem = Math.max(totalSemesters, ...deptStudents.map(s => Number(s.semester) || 0));

      for (let sem = 1; sem <= maxSem; sem += 1) {
        const semStudents = deptStudents.filter(s => Number(s.semester) === sem);

        // Separate by role — SRs/CRs get their own slots, but every student
        // (SR, CR and regular alike) also belongs to the class list below.
        const srs = semStudents.filter(s => s.role === 'sr');
        const crs = semStudents.filter(s => s.role === 'cr');
        let regulars = [...semStudents];

        // Sort SRs by section (A, B, C, D)
        srs.sort((a, b) => {
          const aIdx = SECTION_ORDER.indexOf(getSectionLetter(a.section));
          const bIdx = SECTION_ORDER.indexOf(getSectionLetter(b.section));
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (a.id || '').localeCompare(b.id || '');
        });

        // Sort CRs by labSection (A1, A2, B1, B2, C1, C2, D1, D2)
        crs.sort((a, b) => {
          const aLab = getLabSortKey(a.labSection || a.section);
          const bLab = getLabSortKey(b.labSection || b.section);
          if (aLab !== bLab) return aLab - bLab;
          return (a.id || '').localeCompare(b.id || '');
        });

        // Sort students alphabetically by name (dictionary order).
        regulars.sort((a, b) =>
          (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()) ||
          (a.id || '').localeCompare(b.id || '')
        );

        // Dept-level executives (VP/GS) stay first in the semester list so
        // they're easy to spot — everyone else follows alphabetically.
        const execInSem = regulars.filter(s => s.role === 'vp' || s.role === 'gs');
        if (execInSem.length > 0) {
          regulars = [...execInSem, ...regulars.filter(s => s.role !== 'vp' && s.role !== 'gs')];
        }

        grouped[dept][sem] = { srs, crs, regulars };
        if (semStudents.length > 0) deptStats[dept].semesters += 1;
      }
    }

    return { grouped, deptStats, deptExecs };
  }, [directoryAccounts, searchTerm]);

  // Every department is listed — the directory renders the full semester
  // structure even for departments that have no students yet.
  const displayDepts = useMemo(() => {
    const departments = activeDept === 'all'
      ? DEPARTMENTS
      : (DEPARTMENTS.includes(activeDept) ? [activeDept] : []);
    const hasMatches = activeDept === 'all'
      ? Object.values(deptStats).some((stats) => stats.total > 0)
      : (deptStats[activeDept]?.total || 0) > 0;
    return searchTerm.trim() && !hasMatches
      ? []
      : departments;
  }, [activeDept, searchTerm, deptStats]);

  // Toggle semester expansion
  const toggleSem = (dept, sem) => {
    setExpandedSems(prev => ({
      ...prev,
      [`${dept}-${sem}`]: !prev[`${dept}-${sem}`],
    }));
  };

  const toggleDept = (dept) => {
    setExpandedDepts((previous) => ({ ...previous, [dept]: !previous[dept] }));
  };

  // Build SR slot data (3 slots: A, B, C)
  const SR_SLOTS = SECTION_ORDER.map(sec => ({ section: sec, label: `Section ${sec}` }));

  // Build CR slot data (8 slots: A1, A2, B1, B2, C1, C2, D1, D2)
  const CR_SLOTS = LAB_ORDER.map(lab => ({ lab, section: lab[0], label: `Lab ${lab}` }));

  // ── Per-semester export (JPG / PDF) ──
  const [exportOpen, setExportOpen] = useState(null); // semKey of the open menu
  const [exporting, setExporting] = useState(null);   // semKey currently exporting
  const exportRef = useRef(null);

  // Close the export dropdown when clicking anywhere else.
  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buildExportNode = (dept, sem) => {
    const data = grouped[dept][sem];
    const students = data.regulars || [];

    const root = document.documentElement;
    const cs = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const bg = cs('--bg-primary') || '#0A0A0C';
    const logoUrl = brandMark;
    const card = cs('--bg-card') || '#1B1B1F';
    const input = cs('--bg-input') || '#1B1B1F';
    const border = cs('--border-primary') || '#2A2A35';
    const textPri = cs('--text-primary') || '#FFFFFF';
    const textSec = cs('--text-secondary') || '#E2E8F0';
    const textTer = cs('--text-tertiary') || '#94A3B8';
    const amber = cs('--accent-amber') || '#F59E0B';
    const emerald = cs('--accent-emerald') || '#34D399';

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; left: -9999px; top: 0; width: 900px;
      background: ${bg}; color: ${textPri};
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      padding: 0 0 12px;
    `;

    // ─── Brand header ───
    const brand = document.createElement('div');
    brand.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 22px 12px; border-bottom: 1px solid ${border};
    `;
    brand.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${logoUrl}" alt="AUSTWise" style="width: 34px; height: 34px; object-fit: contain; flex-shrink: 0;" />
        <div style="display: flex; flex-direction: column;">
          <div style="font-size: 17px; font-weight: 800; color: ${textPri}; letter-spacing: -0.01em; line-height: 1.15;">AUSTWise</div>
          <div style="font-size: 8px; color: ${textTer}; letter-spacing: 0.07em; text-transform: uppercase;">Your Academic Companion</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 8px; color: ${textTer}; text-transform: uppercase; letter-spacing: 0.07em;">Generated</div>
        <div style="font-size: 11px; color: ${textPri}; font-weight: 700; margin-top: 2px;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
      </div>
    `;
    container.appendChild(brand);

    // ─── Title block ───
    const title = document.createElement('div');
    title.style.cssText = `padding: 16px 22px 10px;`;
    const execs = deptExecs[dept] || {};
    const execLine = [
      execs.vp ? `VP: ${execs.vp.name}` : null,
      execs.gs ? `GS: ${execs.gs.name}` : null,
    ].filter(Boolean).join(' · ');
    title.innerHTML = `
      <div style="font-size: 15px; font-weight: 800; color: ${textPri};">Department of ${DEPT_FULL_NAMES[dept] || dept}</div>
      <div style="font-size: 12px; color: ${textSec}; margin-top: 3px;">
        Year ${formatSemesterLabel(Number(sem))} (Semester ${sem}) — ${students.length} student${students.length !== 1 ? 's' : ''}
      </div>
      ${execLine ? `<div style="font-size: 11px; color: ${amber}; margin-top: 4px; font-weight: 600;">${escapeHtml(execLine)}</div>` : ''}
    `;
    container.appendChild(title);

    // ─── Student table ───
    const wrap = document.createElement('div');
    wrap.style.cssText = `margin: 4px 22px; border: 1px solid ${border}; border-radius: 8px; overflow: hidden;`;
    const table = document.createElement('table');
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11.5px;`;

    const th = (label, w) =>
      `<th style="text-align: left; padding: 8px 10px; background: ${input}; color: ${textTer}; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; ${w ? `width: ${w};` : ''} border-bottom: 1px solid ${border};">${label}</th>`;

    let html = `<thead><tr>${th('#', '32px')}${th('Name')}${th('AUST ID', '110px')}${th('AWID', '90px')}${th('Email')}${th('Lab', '56px')}${th('Blood', '64px')}${th('Batch', '80px')}</tr></thead><tbody>`;

    if (students.length === 0) {
      html += `<tr><td colspan="8" style="padding: 22px; text-align: center; color: ${textTer}; font-style: italic;">No students in this semester.</td></tr>`;
    } else {
      students.forEach((s, i) => {
        const roleBadge = s.role === 'vp'
          ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 800; color: ${amber}; background: rgba(245, 158, 11, 0.12); border: 1px solid ${amber};">VP</span>`
          : s.role === 'gs'
            ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 800; color: ${emerald}; background: rgba(52, 211, 153, 0.12); border: 1px solid ${emerald};">GS</span>`
            : s.role === 'sr'
              ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 800; color: #60A5FA; background: rgba(96, 165, 250, 0.12); border: 1px solid #60A5FA;">SR</span>`
              : s.role === 'cr'
                ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 800; color: #A78BFA; background: rgba(167, 139, 250, 0.12); border: 1px solid #A78BFA;">CR</span>`
                : '';
        const strip = i % 2 === 1 ? `background: ${card};` : '';
        html += `<tr style="${strip}">
          <td style="padding: 6px 10px; color: ${textTer}; font-variant-numeric: tabular-nums;">${i + 1}</td>
          <td style="padding: 6px 10px; font-weight: 600; color: ${textPri};">${escapeHtml(s.name)}${roleBadge}</td>
          <td style="padding: 6px 10px; color: ${textSec}; font-family: 'SF Mono', Consolas, monospace; font-size: 10px;">${escapeHtml(extractStudentId(s))}</td>
          <td style="padding: 6px 10px; color: ${textSec}; font-family: 'SF Mono', Consolas, monospace; font-size: 10px;">${escapeHtml(s.awid || createAwid(s.department) || '—')}</td>
          <td style="padding: 6px 10px; color: ${textTer};">${escapeHtml(s.email || '—')}</td>
          <td style="padding: 6px 10px; color: ${textSec}; text-align: center;">${escapeHtml(s.labSection || s.section || '—')}</td>
          <td style="padding: 6px 10px; color: ${textSec}; text-align: center;">${escapeHtml(s.bloodGroup || '—')}</td>
          <td style="padding: 6px 10px; color: ${textSec};">${escapeHtml(s.batch || s.batchName || s.batchNo || '—')}</td>
        </tr>`;
      });
    }

    html += '</tbody>';
    table.innerHTML = html;
    wrap.appendChild(table);
    container.appendChild(wrap);

    // ─── Footer ───
    const footer = document.createElement('div');
    footer.style.cssText = `padding: 10px 22px 0; font-size: 9px; color: ${textTer}; display: flex; justify-content: space-between;`;
    footer.innerHTML = `<span>Department of ${dept} · Semester ${sem}</span><span>Exported from AUSTWise</span>`;
    container.appendChild(footer);

    return container;
  };

  const handleExport = async (dept, sem, format) => {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'), import('html2canvas-pro')
    ]);
    const key = `${dept}-${sem}`;
    setExportOpen(null);
    setExporting(key);

    const node = buildExportNode(dept, sem);
    document.body.appendChild(node);

    const root = document.documentElement;
    const bg = (getComputedStyle(root).getPropertyValue('--bg-primary') || '#0A0A0C').trim();
    const base = `${dept}-Sem${sem}-Students`;

    try {
      const canvas = await html2canvas(node, {
        scale: 2, useCORS: true, backgroundColor: bg,
        logging: false, width: node.scrollWidth, height: node.scrollHeight,
      });

      if (format === 'jpg') {
        const link = document.createElement('a');
        link.download = `${base}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageW = 210, pageH = 297;
        const margin = 10;
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height * imgW) / canvas.width;
        const usableH = pageH - margin * 2;
        const pages = Math.max(1, Math.ceil(imgH / usableH));
        // Fill each page with the theme background so dark documents tile cleanly.
        const hex = bg.replace('#', '');
        for (let i = 0; i < pages; i++) {
          if (i > 0) pdf.addPage();
          if (hex.length >= 6) {
            pdf.setFillColor(parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16));
            pdf.rect(0, 0, pageW, pageH, 'F');
          }
          pdf.addImage(imgData, 'JPEG', margin, margin - i * usableH, imgW, imgH);
        }
        pdf.save(`${base}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      document.body.removeChild(node);
      setExporting(null);
    }
  };

  return (
    <div className="student-dir member-directory">
      {/* Masthead */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <GraduationCap size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <div className="schedule-title">Student Directory</div>
            <span className="schedule-subtitle">Find classmates, SRs &amp; CRs — sorted by name.</span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions student-dir-controls">
          <div className="student-dir-filter-select-wrap">
            <select
              className="input alumni-select"
              value={activeDept}
              onChange={(event) => setActiveDept(event.target.value)}
              aria-label="Filter students by department"
            >
              <option value="all">All departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({deptStats[dept]?.total || 0})
                </option>
              ))}
            </select>
          </div>
          <div className="search-box alumni-search student-dir-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search name / ID"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search students by name or ID"
            />
          </div>
        </div>
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* Content */}
      {displayDepts.length === 0 ? (
        <div className="student-dir-empty">
          <div className="student-dir-empty-icon">
            <Users size={28} />
          </div>
          <h3>No students found</h3>
          <p>{searchTerm.trim()
            ? `No students match “${searchTerm.trim()}”. Try another name or ID.`
            : "No student accounts are registered in the directory yet. When classmates sign up, they'll appear here grouped by department and semester."}</p>
        </div>
      ) : (
        <div className="alumni-groups">
          {displayDepts.map(dept => {
            // Higher semesters first — highest semester on top, lower below.
            const sems = Object.keys(grouped[dept]).sort((a, b) => Number(b) - Number(a));

            return (
              <div key={dept}>
                <DirectoryDepartmentHeader
                  label={getDepartmentLabel(dept)}
                  count={deptStats[dept]?.total || 0}
                  expanded={Boolean(expandedDepts[dept])}
                  onToggle={() => toggleDept(dept)}
                  contentId={`student-department-${dept}`}
                />

                {expandedDepts[dept] && <div id={`student-department-${dept}`} className="student-dir-dept-body">
                {/* ═══ Department Executive Slots (VP · GS) ═══ */}
                <div className="student-dir-exec-section">
                  <div className="student-dir-exec-label">
                    <Crown size={13} />
                    <span>Department Executive</span>
                  </div>
                  <div className="student-dir-exec-row">
                    {[{ role: 'vp', label: 'Vice President', icon: <Crown size={15} /> },
                      { role: 'gs', label: 'General Secretary', icon: <Briefcase size={15} /> }].map(({ role, label, icon }) => {
                      const exec = deptExecs[dept]?.[role];
                      return (
                        <div key={role} className={`student-dir-exec-slot${exec ? '' : ' vacant'}`}>
                          <button
                            type="button"
                            className={`student-dir-exec-avatar ${role === 'vp' ? 'stu-avatar-vp' : 'stu-avatar-gs'}`}
                            disabled={!exec}
                            onClick={() => exec && navigate(`/members/${exec.id}`)}
                            title={exec ? `View ${exec.name}'s profile / ID` : undefined}
                            aria-label={exec ? `View ${exec.name}'s profile` : undefined}
                            style={{ padding: 0, border: 'none', background: 'transparent', cursor: exec ? 'pointer' : 'default' }}
                          >
                            {exec?.avatar ? (
                              <img src={exec.avatar} alt="" style={AVATAR_IMG_STYLE} />
                            ) : icon}
                          </button>
                          <div className="student-dir-slot-info">
                            {exec ? (
                              <span className="student-dir-slot-name">{exec.name}</span>
                            ) : (
                              <span className="student-dir-slot-name-vacant">— Vacant —</span>
                            )}
                            <span className="student-dir-slot-sub">{label}</span>
                          </div>
                          {exec && (
                            <span className={`stu-badge ${role === 'vp' ? 'badge-vp' : 'badge-gs'}`}>
                              {role === 'vp' ? 'VP' : 'GS'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="student-dir-sem-list">
                  {sems.map(sem => {
                    const semKey = `${dept}-${sem}`;
                    const isExpanded = Boolean(expandedSems[semKey]);
                    const data = grouped[dept][sem];
                    const { srs, crs, regulars } = data;
                    // regulars already includes SRs & CRs, so it's the unique count.
                    const totalInSem = data.regulars.length;
                    // Density by student count — 0 → emerald · 1 → cyan · 2 → amber · 3+ → rose
                    const densityClass = totalInSem >= 3 ? 'is-rose' : totalInSem === 2 ? 'is-amber' : totalInSem === 1 ? 'is-cyan' : 'is-emerald';

                    // Map SRs to slots
                    const srSlotMap = {};
                    for (const sr of srs) {
                      const sec = getSectionLetter(sr.section);
                      srSlotMap[sec] = sr;
                    }

                    // Map CRs to slots
                    const crSlotMap = {};
                    for (const cr of crs) {
                      const lab = cr.labSection || cr.section;
                      crSlotMap[lab] = cr;
                    }

                    const isLastSem = sem === sems[sems.length - 1];

                    return (
                      <div key={semKey} className={`student-dir-sem-card ${densityClass}`}>
                        <div className="student-dir-sem-head-row">
                          <button
                            className="student-dir-sem-header"
                            onClick={() => toggleSem(dept, sem)}
                            aria-expanded={isExpanded}
                          >
                            <div className="student-dir-sem-header-left">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <Layers size={16} />
                              <span className="student-dir-sem-label">
                                Year {formatSemesterLabel(Number(sem))} (Semester {sem})
                              </span>
                            </div>
                          </button>
                          <div
                            className={`student-dir-sem-export${isLastSem ? ' opens-up' : ''}`}
                            ref={exportOpen === semKey ? exportRef : null}
                          >
                            <button
                              className="student-dir-export-trigger"
                              onClick={() => setExportOpen(exportOpen === semKey ? null : semKey)}
                              aria-label={`Export ${dept} Semester ${sem} student list`}
                              aria-haspopup="true"
                              disabled={exporting === semKey}
                              title="Export student list"
                            >
                              {exporting === semKey ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                            </button>
                            {exportOpen === semKey && (
                              <div className="student-dir-export-menu">
                                <button
                                  className="student-dir-export-item"
                                  onClick={() => handleExport(dept, sem, 'jpg')}
                                  disabled={exporting === semKey}
                                >
                                  <Download size={13} /> Save as JPG
                                </button>
                                <button
                                  className="student-dir-export-item"
                                  onClick={() => handleExport(dept, sem, 'pdf')}
                                  disabled={exporting === semKey}
                                >
                                  <FileDown size={13} /> Save as PDF
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="student-dir-sem-body">
                            {/* ═══ SR Row ═══ */}
                            <div className="student-dir-role-section">
                              <div className="student-dir-role-label">
                                <Star size={14} />
                                <span>Student Representatives (SR)</span>
                              </div>
                              <div className="student-dir-slot-row">
                                {SR_SLOTS.map(slot => {
                                  const sr = srSlotMap[slot.section];
                                  const uniq = `sr-${dept}-${sem}-${slot.section}`;
                                  return sr ? (
                                    <div key={uniq} className="student-dir-slot-card student-dir-slot-sr">
                                      <button
                                        type="button"
                                        className="student-dir-slot-avatar stu-avatar-sr"
                                        onClick={() => navigate(`/members/${sr.id}`)}
                                        title={`View ${sr.name}'s profile / ID`}
                                        aria-label={`View ${sr.name}'s profile`}
                                        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                      >
                                        {sr.avatar ? (
                                          <img src={sr.avatar} alt="" style={AVATAR_IMG_STYLE} />
                                        ) : <Star size={15} />}
                                      </button>
                                      <div className="student-dir-slot-info">
                                        <span className="student-dir-slot-name">{sr.name}</span>
                                        <span className="student-dir-slot-sub">{slot.label}</span>
                                      </div>
                                      <span className="stu-badge stu-badge-sr">SR</span>
                                    </div>
                                  ) : (
                                    <div key={uniq} className="student-dir-slot-card student-dir-slot-vacant">
                                      <div className="student-dir-slot-avatar stu-avatar-vacant">
                                        <Star size={14} />
                                      </div>
                                      <div className="student-dir-slot-info">
                                        <span className="student-dir-slot-name-vacant">— Vacant —</span>
                                        <span className="student-dir-slot-sub">{slot.label}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* ═══ CR Row ═══ */}
                            <div className="student-dir-role-section">
                              <div className="student-dir-role-label">
                                <BadgeCheck size={14} />
                                <span>Class Representatives (CR)</span>
                              </div>
                              <div className="student-dir-slot-row">
                                {CR_SLOTS.map(slot => {
                                  const cr = crSlotMap[slot.lab];
                                  const uniq = `cr-${dept}-${sem}-${slot.lab}`;
                                  return cr ? (
                                    <div key={uniq} className="student-dir-slot-card student-dir-slot-cr">
                                      <button
                                        type="button"
                                        className="student-dir-slot-avatar stu-avatar-cr"
                                        onClick={() => navigate(`/members/${cr.id}`)}
                                        title={`View ${cr.name}'s profile / ID`}
                                        aria-label={`View ${cr.name}'s profile`}
                                        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                      >
                                        {cr.avatar ? (
                                          <img src={cr.avatar} alt="" style={AVATAR_IMG_STYLE} />
                                        ) : <BadgeCheck size={15} />}
                                      </button>
                                      <div className="student-dir-slot-info">
                                        <span className="student-dir-slot-name">{cr.name}</span>
                                        <span className="student-dir-slot-sub">{slot.label}</span>
                                      </div>
                                      <span className="stu-badge stu-badge-cr">{slot.lab}</span>
                                    </div>
                                  ) : (
                                    <div key={uniq} className="student-dir-slot-card student-dir-slot-vacant">
                                      <div className="student-dir-slot-avatar stu-avatar-vacant">
                                        <BadgeCheck size={14} />
                                      </div>
                                      <div className="student-dir-slot-info">
                                        <span className="student-dir-slot-name-vacant">— Vacant —</span>
                                        <span className="student-dir-slot-sub">{slot.label}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* ═══ Students — same card rows as the Alumni Directory ═══ */}
                            {regulars.length > 0 && (
                              <div className="student-dir-role-section student-dir-regular-list">
                                <div className="student-dir-role-label">
                                  <Users size={14} />
                                  <span>Students</span>
                                </div>
                                <div className="alumni-grid-inner">
                                  {regulars.map((student) => {
                                    const isMe = student.id === user?.id;
                                    const austId = extractStudentId(student);
                                    const awid = student.awid || createAwid(student.department);
                                    const lab = student.labSection || student.section;
                                    const batch = student.batch || student.batchName || student.batchNo;
                                    const roleTag = ROLE_TAGS[student.role];
                                    return (
                                      <DirectoryMemberCard
                                        key={student.id}
                                        member={student}
                                        roleLabel={roleTag?.label || 'Student'}
                                        isMe={isMe}
                                        badges={roleTag && (
                                          <span className={`alumni-card-you alumni-card-role is-${student.role}`}>{roleTag.short}</span>
                                        )}
                                        onOpenProfile={() => navigate(`/members/${student.id}`)}
                                        deptLine={[student.department, batch, lab && `Lab ${lab}`].filter(Boolean).join(' · ')}
                                        metaItems={[austId && `ID ${austId}`, awid, student.bloodGroup]}
                                        email={student.email}
                                        previewStats={[
                                          ['Department', getDepartmentLabel(student.department)],
                                          ['AUST ID', austId],
                                          ['AWID', awid],
                                          ['Semester', `Year ${formatSemesterLabel(Number(sem))} (Semester ${sem})`],
                                          ['Lab', lab],
                                          ['Batch', batch],
                                          ['Blood', student.bloodGroup],
                                        ]}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {regulars.length === 0 && (
                              <div className="student-dir-role-section">
                                <div className="student-dir-role-label">
                                  <Users size={14} />
                                  <span>Students</span>
                                </div>
                                <div className="student-dir-table-empty">No students in this semester.</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
