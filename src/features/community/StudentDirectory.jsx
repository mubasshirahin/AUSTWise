import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users, Filter, X, ChevronDown, ChevronRight,
  GraduationCap, BookOpen, Layers,
  BadgeCheck, Star, Download, FileDown, Loader2,
  Crown, Briefcase,
} from 'lucide-react';
import logoLight from '../../assets/vector1-1.svg';
import logoDark from '../../assets/vector1-1.svg';
import { getAllAccounts, createAwid } from '../../utils/authStorage';
import { useAuth } from '../../context/AuthContext';
import { formatSemesterLabel, getSemesterCountForDepartment } from '../../utils/semester';

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
  const [activeDept, setActiveDept] = useState('all');
  const [expandedSems, setExpandedSems] = useState({});
  const [directoryAccounts, setDirectoryAccounts] = useState(() => getAllAccounts());

  // Role approvals happen server-side. Refresh the sanitized public directory
  // list so VP/GS appointments appear for other users without relying on each
  // browser's stale local account cache.
  useEffect(() => {
    let cancelled = false;
    const syncDirectory = async () => {
      try {
        const res = await fetch('/api/presence/members');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.members) || cancelled) return;
        const localById = new Map(getAllAccounts().map((account) => [account.id, account]));
        setDirectoryAccounts(data.members.map((member) => ({
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

  // Get all accounts and group them by dept → sem.
  // Every semester slot (1 → total for the dept) is always created so the full
  // academic structure renders — whether or not students are registered yet.
  const { grouped, deptStats, deptExecs } = useMemo(() => {
    const allAccounts = directoryAccounts;
    const students = allAccounts.filter(a => ['student', 'cr', 'sr', 'vp', 'gs'].includes(a.role));

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
  }, [directoryAccounts]);

  // Every department is listed — the directory renders the full semester
  // structure even for departments that have no students yet.
  const displayDepts = useMemo(() => {
    return activeDept === 'all'
      ? DEPARTMENTS
      : (DEPARTMENTS.includes(activeDept) ? [activeDept] : []);
  }, [activeDept]);

  // First visible semester is expanded by default (until the user toggles it).
  // Semesters are ordered senior → junior, so the senior-most starts expanded.
  const defaultExpandedKey = displayDepts.length > 0
    ? `${displayDepts[0]}-${Object.keys(grouped[displayDepts[0]]).sort((a, b) => Number(b) - Number(a))[0]}`
    : null;

  const totalStudents = useMemo(() => {
    return Object.values(deptStats).reduce((sum, s) => sum + s.total, 0);
  }, [deptStats]);

  // Toggle semester expansion
  const toggleSem = (dept, sem) => {
    setExpandedSems(prev => ({
      ...prev,
      [`${dept}-${sem}`]: !prev[`${dept}-${sem}`],
    }));
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
    const themeAttr = root.getAttribute('data-theme') || 'dark';
    const lightSet = new Set(['light','swiss','newsprint','sketchbook','minimalist-monochrome','industrial']);
    const logoUrl = lightSet.has(themeAttr) ? logoLight : logoDark;
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
    <div className="student-dir">
      {/* Masthead */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="student-dir-header-icon">
            <GraduationCap size={26} />
          </div>
          <div>
            <span className="schedule-overline">Community</span>
            <h2 className="student-dir-header-title">Student Directory</h2>
            <p className="student-dir-header-subtitle">
              Find classmates, SRs &amp; CRs — sorted by name.
            </p>
          </div>
        </div>

        <div className="schedule-masthead-center">
          <div className="schedule-stats">
            <div className="schedule-stat">
              <span className="schedule-stat-value">{DEPARTMENTS.length}</span>
              <span className="schedule-stat-label">Departments</span>
            </div>
            <div className="schedule-stat">
              <span className="schedule-stat-value">{totalStudents}</span>
              <span className="schedule-stat-label">Students</span>
            </div>
          </div>
        </div>

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" style={{ marginTop: 0 }} />

      {/* Filter bar */}
      <div className="student-dir-controls">
        <div className="student-dir-filter-group">
          <Filter size={14} />
          <button
            className={`student-dir-filter-btn ${activeDept === 'all' ? 'active' : ''}`}
            onClick={() => setActiveDept('all')}
          >
            All
            {totalStudents > 0 && (
              <span className="student-dir-filter-count">{totalStudents}</span>
            )}
          </button>
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              className={`student-dir-filter-btn ${activeDept === dept ? 'active' : ''}`}
              onClick={() => setActiveDept(dept)}
            >
              {dept}
              {deptStats[dept]?.total > 0 && (
                <span className="student-dir-filter-count">{deptStats[dept].total}</span>
              )}
            </button>
          ))}
        </div>

        {activeDept !== 'all' && (
          <button className="student-dir-clear-filter" onClick={() => setActiveDept('all')}>
            <X size={12} /> Clear filter
          </button>
        )}
      </div>

      {/* Content */}
      {displayDepts.length === 0 ? (
        <div className="student-dir-empty">
          <div className="student-dir-empty-icon">
            <Users size={28} />
          </div>
          <h3>No students found</h3>
          <p>No student accounts are registered in the directory yet. When classmates sign up, they'll appear here grouped by department and semester.</p>
        </div>
      ) : (
        <div className="student-dir-content">
          {displayDepts.map(dept => {
            // Seniors first — highest semester on top, juniors below.
            const sems = Object.keys(grouped[dept]).sort((a, b) => Number(b) - Number(a));

            return (
              <div key={dept} className="student-dir-dept-section">
                <div className="student-dir-dept-header">
                  <div className="student-dir-dept-icon">
                    <BookOpen size={18} />
                  </div>
                  <div className="student-dir-dept-info">
                    <h3 className="student-dir-dept-name">
                      Department of {DEPT_FULL_NAMES[dept] || dept}
                    </h3>
                    <span className="student-dir-dept-meta">
                      {deptStats[dept]?.total || 0} students · {deptStats[dept]?.semesters || 0} of {deptStats[dept]?.totalSemesters || 0} semesters
                    </span>
                  </div>
                  <span className="student-dir-dept-count">{deptStats[dept]?.total || 0}</span>
                </div>

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
                          <div className={`student-dir-exec-avatar ${role === 'vp' ? 'stu-avatar-vp' : 'stu-avatar-gs'}`}>
                            {exec?.avatar ? (
                              <img src={exec.avatar} alt="" style={AVATAR_IMG_STYLE} />
                            ) : icon}
                          </div>
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
                    // User toggles override the default; otherwise the first
                    // visible semester starts expanded.
                    const isExpanded = expandedSems[semKey] ?? semKey === defaultExpandedKey;
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
                            <div className="student-dir-sem-header-right">
                              <span
                                className={`student-dir-sem-count${totalInSem >= 3 ? ' hot' : ''}`}
                                title={`${totalInSem} student${totalInSem !== 1 ? 's' : ''}`}
                              >
                                {totalInSem}
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
                                      <div className="student-dir-slot-avatar stu-avatar-sr">
                                        {sr.avatar ? (
                                          <img src={sr.avatar} alt="" style={AVATAR_IMG_STYLE} />
                                        ) : <Star size={15} />}
                                      </div>
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
                                      <div className="student-dir-slot-avatar stu-avatar-cr">
                                        {cr.avatar ? (
                                          <img src={cr.avatar} alt="" style={AVATAR_IMG_STYLE} />
                                        ) : <BadgeCheck size={15} />}
                                      </div>
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

                            {/* ═══ Student Table ═══ */}
                            {regulars.length > 0 && (
                              <div className="student-dir-role-section">
                                <div className="student-dir-role-label">
                                  <Users size={14} />
                                  <span>Students ({regulars.length})</span>
                                </div>
                                <div className="student-dir-table-wrapper">
                                  <table className="student-dir-table">
                                    <thead>
                                      <tr>
                                        <th className="stu-th-name">Name</th>
                                        <th className="stu-th-id">AUST ID</th>
                                        <th className="stu-th-awid">AWID</th>
                                        <th className="stu-th-email">Email</th>
                                        <th className="stu-th-lab">Lab</th>
                                        <th className="stu-th-blood">Blood</th>
                                        <th className="stu-th-batch">Batch</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {regulars.map(student => (
                                        <tr
                                          key={student.id}
                                          className={`student-dir-table-row${student.id === user?.id ? ' is-me' : ''}`}
                                        >
                                          <td className="stu-td-name">
                                            <span className="student-dir-student-avatar" style={{
                                              background: student.avatar ? 'transparent' : 'var(--accent-amber-glow)',
                                              color: 'var(--accent-amber)',
                                              width: '28px',
                                              height: '28px',
                                              fontSize: '9px',
                                              overflow: 'hidden',
                                            }}>
                                              {student.avatar ? (
                                                <img src={student.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                              ) : (
                                                student.initials || student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
                                              )}
                                            </span>
                                            <span className="student-dir-table-stu-name">{student.name}</span>
                                            {student.role === 'vp' && (
                                              <span className="student-dir-role-badge is-vp">VP</span>
                                            )}
                                            {student.role === 'gs' && (
                                              <span className="student-dir-role-badge is-gs">GS</span>
                                            )}
                                            {student.role === 'sr' && (
                                              <span className="student-dir-role-badge is-sr">SR</span>
                                            )}
                                            {student.role === 'cr' && (
                                              <span className="student-dir-role-badge is-cr">CR</span>
                                            )}
                                            {student.id === user?.id && (
                                              <span className="student-dir-you-badge">You</span>
                                            )}
                                          </td>
                                          <td className="stu-td-id">
                                            <code className="student-dir-id-code">{extractStudentId(student)}</code>
                                          </td>
                                          <td className="stu-td-awid">
                                            <code className="student-dir-id-code" style={{ fontSize: '9px' }}>{student.awid || createAwid(student.department) || '—'}</code>
                                          </td>
                                          <td className="stu-td-email">
                                            <span className="student-dir-email">{student.email || '—'}</span>
                                          </td>
                                          <td className="stu-td-lab">{student.labSection || student.section || '—'}</td>
                                          <td className="stu-td-blood">
                                            <span className={`student-dir-blood ${student.bloodGroup ? 'has-blood' : ''}`}>
                                              {student.bloodGroup || '—'}
                                            </span>
                                          </td>
                                          <td className="stu-td-batch">{student.batch || student.batchName || student.batchNo || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
