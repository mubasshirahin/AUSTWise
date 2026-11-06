import { useState, useMemo } from 'react';
import {
  GraduationCap, Plus, Trash2, Pencil, BookOpen,
  Building2, User, Clock, Link2, Tag, StickyNote, ExternalLink,
  ChevronRight, ChevronDown, ArrowUp, ArrowDown, Layers, Sparkles, X,
  Copy, Check, Upload, MessageSquare, FileText, Video, Dumbbell,
  Settings, CheckSquare, Play, ListChecks
} from 'lucide-react';
import { LpEmpty, LpModal, LpConfirm } from './LifePlannerUI';
import {
  useCourses, createCourse, updateCourse, deleteCourse, COURSE_COLORS,
  useCourseNodes, createCourseNode, updateCourseNode, deleteCourseNode,
  toggleCourseNodeCollapse, toggleCourseNodeDone, moveCourseNode, getCourseNodes, countCourseNodes, NODE_TYPES,
  updateCourseNodeComment, toggleCourseNodeCheck, DEFAULT_CHECKLIST_TEMPLATES
} from './coursesStorage';
import { COURSE_AI_MASTER_PROMPT } from './courseAiPrompt';
import { validateCourseAiJson, importCourseFromAiJson } from './courseAiImport';
import './CourseStructure.css';

const EMPTY_DRAFT = {
  title: '', provider: '', instructor: '', duration: '', category: '', link: '', notes: '',
  description: '', language: '', level: '' };

export default function CoursesView() {
  const [courses, updateCourses] = useCourses();
  const [nodes, updateNodes] = useCourseNodes();
  const [activeCourseId, setActiveCourseId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [aiJson, setAiJson] = useState('');
  const [aiCopied, setAiCopied] = useState(false);
  const [aiImportMsg, setAiImportMsg] = useState(null);
  // Whether the "Paste AI JSON" option is expanded below the header.
  // "Copy Prompt" never expands — it just copies and shows "Copied ✓".
  const [aiPanel, setAiPanel] = useState(null);
  const [courseDeleteTarget, setCourseDeleteTarget] = useState(null);

  const activeCourse = activeCourseId ? courses.find((c) => c.id === activeCourseId) : null;

  const openAdd = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT });
    setShowForm(true);
  };
  const openEdit = (c) => {
    setEditing(c);
    setDraft({
      title: c.title || '',
      provider: c.provider || c.code || '',
      instructor: c.instructor || '',
      duration: c.duration || '',
      category: c.category || '',
      link: c.link || '',
      notes: c.notes || '',
      description: c.description || '',
      language: c.language || '',
      level: c.level || '' });
    setShowForm(true);
  };
  const handleSave = () => {
    if (!draft.title.trim() || !draft.provider.trim()) return;
    if (editing) {
      updateCourses((prev) => updateCourse(prev, editing.id, {
        title: draft.title.trim(),
        provider: draft.provider.trim(),
        code: draft.provider.trim(),
        instructor: draft.instructor.trim(),
        duration: draft.duration.trim(),
        category: draft.category.trim(),
        link: draft.link.trim(),
        notes: draft.notes.trim(),
        description: draft.description.trim(),
        language: draft.language.trim(),
        level: draft.level.trim() }));
    } else {
      updateCourses((prev) => createCourse(prev, {
        title: draft.title,
        provider: draft.provider,
        instructor: draft.instructor,
        duration: draft.duration,
        category: draft.category,
        link: draft.link,
        notes: draft.notes,
        description: draft.description,
        language: draft.language,
        level: draft.level,
        color: COURSE_COLORS[prev.length % COURSE_COLORS.length] }));
    }
    setShowForm(false);
    setEditing(null);
  };

  const requestDeleteCourse = (c) => {
    setCourseDeleteTarget(c);
  };
  const confirmDeleteCourse = () => {
    const id = courseDeleteTarget?.id;
    if (!id) return;
    updateCourses((prev) => deleteCourse(prev, id));
    // cascade delete its hierarchy
    updateNodes((prev) => prev.filter((n) => n.courseId !== id));
    if (activeCourseId === id) setActiveCourseId(null);
    setCourseDeleteTarget(null);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(COURSE_AI_MASTER_PROMPT);
      setAiCopied(true);
      setTimeout(() => setAiCopied(false), 1800);
      setAiImportMsg({ type: 'success', text: 'Prompt copied ✓ — paste into ChatGPT/Gemini/Claude' });
      setTimeout(() => setAiImportMsg(null), 2500);
    } catch {
      setAiImportMsg({ type: 'error', text: 'Copy failed — please select the prompt and copy manually.' });
    }
  };

  // Header button: toggle the paste-AI-JSON option open/closed.
  const handlePasteBtn = () => {
    setAiPanel((prev) => (prev === 'paste' ? null : 'paste'));
  };

  const aiValidation = useMemo(() => {
    if (!aiJson.trim()) return null;
    try {
      const trimmed = aiJson.trim();
      const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const toParse = m ? m[1] : trimmed;
      const parsed = JSON.parse(toParse);
      return validateCourseAiJson(parsed);
    } catch (e) {
      return { valid: false, errors: [`JSON parse error: ${e.message}`], warnings: [], stats: null };
    }
  }, [aiJson]);

  const handleAiImport = () => {
    const res = importCourseFromAiJson(courses, nodes, aiJson);
    if (!res.ok) {
      setAiImportMsg({ type: 'error', text: res.error });
      return;
    }
    // Direct import — no review modal per decision
    updateCourses(() => res.courses);
    updateNodes(() => res.nodes);
    setActiveCourseId(res.course.id);
    setAiJson('');
    const warn = res.warnings?.length ? ` • ${res.warnings.join(' • ')}` : '';
    setAiImportMsg({ type: 'success', text: `Imported "${res.course.title}" — ${res.nodeCount} items${warn}` });
    setTimeout(() => setAiImportMsg(null), 4000);
  };

  // Course delete warning — lists everything under the course
  const courseDeleteModal = courseDeleteTarget && (
    <LpConfirm
      title="Delete this course?"
      message={`“${courseDeleteTarget.title}” and everything under it (${countCourseNodes(nodes, courseDeleteTarget.id)} structure item${countCourseNodes(nodes, courseDeleteTarget.id) === 1 ? '' : 's'}) will be permanently deleted.`}
      confirmLabel="Delete"
      onConfirm={confirmDeleteCourse}
      onCancel={() => setCourseDeleteTarget(null)}
    />
  );

  // Course Add/Edit overlay — defined once so it renders both on the
  // list view and inside the detail view (Edit Course there too).
  const courseFormModal = showForm && (
    <LpModal title={editing ? 'Edit Course' : 'Add Course'} onClose={() => setShowForm(false)} wide>
      <div className="cs-course-form">
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Course Title *</label>
          <input className="input" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Complete React Bootcamp" autoFocus />
        </div>
        <div className="cs-form-grid">
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Company / Channel / Brand *</label>
            <input className="input" value={draft.provider} onChange={(e) => setDraft((p) => ({ ...p, provider: e.target.value }))} placeholder="Udemy, YouTube..." />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Instructor</label>
            <input className="input" value={draft.instructor} onChange={(e) => setDraft((p) => ({ ...p, instructor: e.target.value }))} placeholder="e.g. Jonas Schmedtmann" />
          </div>
        </div>
        <div className="cs-form-grid">
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Duration</label>
            <input className="input" value={draft.duration} onChange={(e) => setDraft((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 40 hours" />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Category</label>
            <input className="input" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} placeholder="Development, Design..." />
          </div>
        </div>
        <div className="cs-form-grid">
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Level</label>
            <input className="input" value={draft.level} onChange={(e) => setDraft((p) => ({ ...p, level: e.target.value }))} placeholder="Beginner, Intermediate..." />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Language</label>
            <input className="input" value={draft.language} onChange={(e) => setDraft((p) => ({ ...p, language: e.target.value }))} placeholder="English, Bengali..." />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Course Link</label>
          <input className="input" value={draft.link} onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="cs-form-grid">
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="input" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="What this course covers..." rows={1} style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea className="input" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Key takeaways..." rows={1} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)} style={{ height: 28, padding: '0 10px' }}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={!draft.title.trim() || !draft.provider.trim()} style={{ height: 28, padding: '0 10px' }}> {editing ? 'Save' : 'Add'} </button>
        </div>
      </div>
    </LpModal>
  );

  // Detail view — drill into course
  if (activeCourse) {
    return (
      <>
        <CourseDetailView
          course={activeCourse}
          courses={courses}
          nodes={nodes}
          updateNodes={updateNodes}
          onBack={() => setActiveCourseId(null)}
          onEditCourse={() => openEdit(activeCourse)}
        />
        {courseFormModal}
        {courseDeleteModal}
      </>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-amber-glow)', color: 'var(--accent-amber)' }}>
            <GraduationCap size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Courses</h4>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{courses.length} extra-curricular course{courses.length === 1 ? '' : 's'} • tap card to build structure</span>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAiPanel(null); openAdd(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Course
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleCopyPrompt}
            title="Copy the AI master prompt"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: '1px solid var(--border-primary)',
              ...(aiCopied
                ? { borderColor: 'var(--accent-emerald)', background: 'color-mix(in srgb, var(--accent-emerald) 12%, transparent)', color: 'var(--accent-emerald)' }
                : {}),
            }}
          >
            {aiCopied ? <Check size={13} /> : <Copy size={13} />} {aiCopied ? 'Copied ✓' : 'Copy Prompt'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handlePasteBtn}
            aria-expanded={aiPanel === 'paste'}
            aria-controls="course-ai-paste-panel"
            title="Paste the AI output (JSON) — opens the paste/import option below"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: '1px solid var(--border-primary)',
              ...(aiPanel === 'paste'
                ? { borderColor: 'var(--accent-cyan)', background: 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)', color: 'var(--accent-cyan)' }
                : {}),
            }}
          >
            <Upload size={13} /> Paste AI JSON
          </button>
        </div>
      </div>

      {/* ── AI: Paste JSON — minimal: paste box + Import only ── */}
      {aiPanel === 'paste' && (
      <div id="course-ai-paste-panel" className="lp-panel" style={{ marginBottom: 14, padding: '12px' }}>
        <textarea
          className="input"
          value={aiJson}
          autoFocus
          onChange={(e) => setAiJson(e.target.value)}
          placeholder="Paste AI JSON here…"
          rows={4}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, resize: 'vertical' }}
        />
        {aiImportMsg && aiImportMsg.type === 'error' && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-rose)' }}>{aiImportMsg.text}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAiImport} disabled={!aiJson.trim() || (aiValidation && !aiValidation.valid)} style={{ gap: 6 }}>
            <ExternalLink size={12} /> Import
          </button>
        </div>
      </div>
      )}

      {courses.length === 0 ? (
        <LpEmpty
          icon={BookOpen}
          title="No courses yet"
          hint="Add external courses — YouTube, Udemy, Coursera, brand workshops. Each card is clickable to build its hierarchy."
          action={<button type="button" className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={14} /> Add Course</button>}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {courses.map((c) => {
            const nodeCount = countCourseNodes(nodes, c.id);
            return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCourseId(c.id)}
              className="lp-hierarchy-card cs-course-card-plain"
              style={{ padding: '14px 14px 12px', borderLeft: `3px solid ${c.color}`, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c.color}18`, color: c.color, flexShrink: 0 }}>
                    <BookOpen size={14} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, wordBreak: 'break-word' }}>{c.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="lp-icon-btn" onClick={() => openEdit(c)} title="Edit" aria-label={`Edit ${c.title}`} style={{ width: 28, height: 28 }}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" className="lp-icon-btn" onClick={() => requestDeleteCourse(c)} title="Delete" aria-label={`Delete ${c.title}`} style={{ width: 28, height: 28 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span className="lp-badge" style={{ background: `${c.color}18`, color: c.color, borderColor: `${c.color}30`, fontSize: 10, gap: 4 }}>
                  <Building2 size={10} /> {c.provider || c.code || '—'}
                </span>
                {c.category && <span className="lp-badge lp-badge-muted" style={{ fontSize: 9, gap: 4 }}><Tag size={10} />{c.category}</span>}
                {c.level && <span className="lp-badge lp-badge-muted" style={{ fontSize: 9, gap: 4 }}><GraduationCap size={10} />{c.level}</span>}
                {c.language && <span className="lp-badge lp-badge-muted" style={{ fontSize: 9, gap: 4 }}><MessageSquare size={10} />{c.language}</span>}
                <span className="lp-badge lp-badge-muted" style={{ fontSize: 9, gap: 4 }}><Layers size={10} /> {nodeCount} items</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                {c.instructor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><User size={11} style={{ opacity: 0.7 }} /> {c.instructor}</span>}
                {c.duration && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={11} style={{ opacity: 0.7 }} /> {c.duration}</span>}
                {c.link && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent-amber)', fontWeight: 600, wordBreak: 'break-all' }} onClick={(e) => e.stopPropagation()}>
                    <Link2 size={11} /> {c.link.length > 28 ? c.link.slice(0, 28) + '…' : c.link}
                  </span>
                )}
                {c.description && <span style={{ display: 'flex', gap: 5, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4, background: 'var(--bg-tertiary)', borderRadius: 8, padding: '6px 8px', marginTop: 2 }}><FileText size={11} style={{ marginTop: 2, flexShrink: 0 }} /> <span style={{ wordBreak: 'break-word' }}>{c.description.length > 80 ? c.description.slice(0, 80) + '…' : c.description}</span></span>}
                {c.notes && <span style={{ display: 'flex', gap: 5, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4, background: 'var(--bg-tertiary)', borderRadius: 8, padding: '6px 8px', marginTop: 2 }}><StickyNote size={11} style={{ marginTop: 2, flexShrink: 0 }} /> <span style={{ wordBreak: 'break-word' }}>{c.notes.length > 80 ? c.notes.slice(0, 80) + '…' : c.notes}</span></span>}
              </div>

              <span style={{ fontSize: 10, color: 'var(--accent-amber)', fontWeight: 700, marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Build structure <ChevronRight size={12} />
              </span>
            </button>
          );})}
        </div>
      )}

      {courseFormModal}
      {courseDeleteModal}
    </div>
  );
}

function CourseDetailView({ course, nodes, updateNodes, onBack, onEditCourse }) {
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', type: 'custom', notes: '', duration: '' });
  const [addingParentId, setAddingParentId] = useState(null);
  const [addDraft, setAddDraft] = useState({ title: '', type: '' });
  const [openCommentId, setOpenCommentId] = useState(null);
  const [deletingNode, setDeletingNode] = useState(null);
  const templates = DEFAULT_CHECKLIST_TEMPLATES;

  const topNodes = useMemo(() => getCourseNodes(nodes, course.id, null), [nodes, course.id]);

  const courseNodes = useMemo(() => nodes.filter((n) => n.courseId === course.id), [nodes, course.id]);
  const leafNodes = useMemo(
    () => courseNodes.filter((n) => !courseNodes.some((o) => o.parentId === n.id)),
    [courseNodes]
  );
  const doneLeafCount = leafNodes.filter((n) => n.isDone).length;
  const progressPct = leafNodes.length ? Math.round((doneLeafCount / leafNodes.length) * 100) : 0;

  const setAllCollapsed = (collapsed) => {
    updateNodes((prev) => prev.map((n) => (n.courseId === course.id ? { ...n, collapsed } : n)));
  };

  const startAdd = (parentId) => {
    setAddingParentId(parentId);
    setAddDraft({ title: '', type: '' });
    setEditingNodeId(null);
  };
  const handleAdd = (parentId) => {
    if (!addDraft.title.trim()) return;
    const realParent = parentId === '__root__' ? null : parentId;
    // Create the node, and always expand the parent so the new child is visible
    updateNodes((prev) => {
      const created = createCourseNode(prev, course.id, realParent, { title: addDraft.title, type: addDraft.type });
      if (!realParent) return created;
      return created.map((n) => (n.id === realParent ? { ...n, collapsed: false } : n));
    });
    setAddingParentId(null);
    setAddDraft({ title: '', type: '' });
  };
  const startEdit = (node) => {
    setEditingNodeId(node.id);
    setEditDraft({ title: node.title, type: node.type || '', notes: node.notes || '', duration: node.duration || '' });
    setAddingParentId(null);
  };
  const handleEditSave = (id) => {
    if (!editDraft.title.trim()) return;
    updateNodes((prev) => updateCourseNode(prev, id, { title: editDraft.title.trim(), type: editDraft.type, notes: editDraft.notes.trim(), duration: editDraft.duration.trim() }));
    setEditingNodeId(null);
  };

  // All descendants of a node (depth-first) — shown in the delete warning
  const descendantsOf = (id) => {
    const out = [];
    const walk = (pid) => {
      for (const n of courseNodes.filter((x) => x.parentId === pid)) {
        out.push(n);
        walk(n.id);
      }
    };
    walk(id);
    return out;
  };
  const deletingDescendants = deletingNode ? descendantsOf(deletingNode.id) : [];

  const confirmDeleteNode = () => {
    if (!deletingNode) return;
    updateNodes((prev) => deleteCourseNode(prev, deletingNode.id));
    if (editingNodeId === deletingNode.id) setEditingNodeId(null);
    if (openCommentId === deletingNode.id) setOpenCommentId(null);
    setDeletingNode(null);
  };

  return (
    <div>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
        <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Courses
      </button>

      <div className="cs-course-head" style={{ '--cs-course-color': course.color }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${course.color}18`, color: course.color }}>
          <BookOpen size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{course.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={11} /> {course.provider}</span>
            {course.instructor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> {course.instructor}</span>}
            {course.duration && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {course.duration}</span>}
            {course.level && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GraduationCap size={11} /> {course.level}</span>}
            {course.language && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MessageSquare size={11} /> {course.language}</span>}
          </div>
          {course.description && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word' }}>{course.description}</div>}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEditCourse} style={{ gap: 4 }}><Pencil size={12} /> Edit Course</button>
      </div>

      <div className="lp-panel">
        <div className="cs-structure-head">
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
            <Layers size={14} style={{ color: 'var(--accent-amber)' }} /> Structure
            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 999, padding: '2px 8px', color: 'var(--text-tertiary)' }}>
              {courseNodes.length} items
            </span>
          </h4>
          {courseNodes.length > 0 && (
            <div className="cs-progress">
              <div className="cs-progress-top">
                <span className="cs-progress-pct">{progressPct}%</span>
                <span className="cs-progress-cap">{doneLeafCount}/{leafNodes.length} lessons done</span>
              </div>
              <div className="cs-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Course progress ${progressPct}%`}>
                <span className="cs-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {courseNodes.length > 0 && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAllCollapsed(false)} style={{ gap: 4 }}><ChevronDown size={12} /> Expand all</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAllCollapsed(true)} style={{ gap: 4 }}><ChevronRight size={12} /> Collapse all</button>
              </>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => startAdd('__root__')} style={{ gap: 6 }}><Plus size={12} /> Add Top-Level Item</button>
          </div>
        </div>

        <div className="cs-hint">
          <Sparkles size={12} style={{ color: 'var(--accent-amber)' }} />
          <span>Manually build any hierarchy — <strong>Chapter → Module → Lesson</strong> or <strong>Part → Topic → Subtopic</strong>, totally flexible. Click <em>Add Child</em> on any item to nest deeper.</span>
        </div>
        <div className="cs-legend">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cs-legend-dot" style={{ background: 'var(--accent-amber)' }} /> Level 0</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cs-legend-dot" style={{ background: 'var(--accent-purple)' }} /> Level 1</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cs-legend-dot" style={{ background: 'var(--accent-orange)' }} /> Level 2</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cs-legend-dot" style={{ background: 'var(--accent-cyan)' }} /> Level 3</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="cs-legend-dot" style={{ background: 'var(--accent-rose)' }} /> Level 4+</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7 }}>color = depth • left border = parent</span>
        </div>

        {addingParentId === '__root__' && (
          <div className="cs-add-form">
            <input
              value={addDraft.type}
              onChange={(e) => setAddDraft((p) => ({ ...p, type: e.target.value }))}
              placeholder="Type (e.g. Chapter) — manual"
              className="input"
              style={{ height: 34, maxWidth: 150 }}
            />
            <input className="input" value={addDraft.title} onChange={(e) => setAddDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Title (e.g. Chapter 1 - Basics)" style={{ flex: '1 1 160px', height: 34 }} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAdd('__root__')} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAdd('__root__')} disabled={!addDraft.title.trim()} style={{ height: 34 }}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingParentId(null)} style={{ height: 34 }}><X size={14} /></button>
          </div>
        )}

        {topNodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '18px 12px', border: '1px dashed var(--border-primary)', borderRadius: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
            No structure yet. Add a top-level item to start — e.g. <strong>Chapter</strong>, <strong>Module</strong> or any custom section.
          </div>
        ) : (
          <div className="cs-tree">
            {topNodes.map((node, idx) => (
              <CourseNodeRow
                key={node.id}
                node={node}
                courseId={course.id}
                nodes={nodes}
                depth={0}
                index={idx}
                sibCount={topNodes.length}
                updateNodes={updateNodes}
                editingNodeId={editingNodeId}
                setEditingNodeId={setEditingNodeId}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                onEditSave={handleEditSave}
                startEdit={startEdit}
                addingParentId={addingParentId}
                setAddingParentId={setAddingParentId}
                addDraft={addDraft}
                setAddDraft={setAddDraft}
                onAdd={handleAdd}
                openCommentId={openCommentId}
                setOpenCommentId={setOpenCommentId}
                templates={templates}
                onDeleteRequest={setDeletingNode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Delete warning — lists everything under the item ── */}
      {deletingNode && (
        <LpModal title="Delete this item?" onClose={() => setDeletingNode(null)}>
          <p style={{ margin: '0 0 10px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>“{deletingNode.title}”</strong>
            {deletingDescendants.length > 0
              ? <> and everything under it will be permanently deleted:</>
              : <> will be permanently deleted.</>}
          </p>
          {deletingDescendants.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14, padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 10, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{deletingDescendants.length} item{deletingDescendants.length === 1 ? '' : 's'} under it:</div>
              <ul style={{ margin: 0, paddingLeft: 18, wordBreak: 'break-word' }}>
                {deletingDescendants.slice(0, 30).map((d) => (
                  <li key={d.id}>{d.title}</li>
                ))}
              </ul>
              {deletingDescendants.length > 30 && (
                <div style={{ marginTop: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>…and {deletingDescendants.length - 30} more</div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setDeletingNode(null)}>Cancel</button>
            <button type="button" className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={confirmDeleteNode}>
              Delete{deletingDescendants.length ? ` (${deletingDescendants.length + 1})` : ''}
            </button>
          </div>
        </LpModal>
      )}
    </div>
  );
}

// Theme-matching warm palette (amber family) — no green, so depth
// highlights sit with the app's gold theme. Orange is a theme token.
const DEPTH_COLORS = ['var(--accent-amber)', 'var(--accent-purple)', 'var(--accent-orange)', 'var(--accent-cyan)', 'var(--accent-rose)'];
const DEPTH_GLOWS = ['var(--accent-amber-glow)', 'var(--accent-purple-glow)', 'var(--accent-orange-glow)', 'var(--accent-cyan-glow)', 'var(--accent-rose-glow)'];

const TYPE_ICONS = {
  chapter: BookOpen,
  module: Layers,
  lesson: Play,
  topic: FileText,
  section: ListChecks,
  part: Layers,
  unit: BookOpen,
  custom: Sparkles,
};

function CourseNodeRow({
  node, courseId, nodes, depth, index, sibCount,
  updateNodes, editingNodeId, setEditingNodeId, editDraft, setEditDraft, onEditSave, startEdit,
  addingParentId, setAddingParentId, addDraft, setAddDraft, onAdd,
  openCommentId, setOpenCommentId, templates, onDeleteRequest
}) {
  const children = getCourseNodes(nodes, courseId, node.id);
  const hasChildren = children.length > 0;
  const isEditing = editingNodeId === node.id;
  const isAddingChild = addingParentId === node.id;
  const isCommentOpen = openCommentId === node.id;
  const indent = Math.min(depth * 18, 48);
  const depthColor = DEPTH_COLORS[depth % DEPTH_COLORS.length];
  const depthGlow = DEPTH_GLOWS[depth % DEPTH_GLOWS.length];
  const checks = { ...(node.checks || {}) };
  const hasComment = !!(node.comment && node.comment.trim());
  const totalChecks = templates ? templates.length : 0;
  const checksDone = templates ? templates.filter((t) => checks[t.id]).length : 0;

  const TypeIcon = TYPE_ICONS[(node.type || '').toLowerCase()] || Sparkles;

  return (
    <div
      className="cs-node"
      style={{
        '--cs-color': depthColor,
        '--cs-glow': depthGlow,
        '--cs-indent': `${indent}px`,
        '--cs-delay': `${Math.min(depth * 45 + index * 40, 360)}ms`,
      }}
    >
      <div className={`cs-node-card${node.isDone ? ' is-done' : ''}`}>
        {hasChildren ? (
          <button
            type="button"
            className={`cs-toggle${node.collapsed ? ' is-collapsed' : ''}`}
            onClick={() => updateNodes((prev) => toggleCourseNodeCollapse(prev, node.id))}
            aria-expanded={!node.collapsed}
            aria-label={node.collapsed ? `Expand ${node.title}` : `Collapse ${node.title}`}
            title={node.collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronDown size={13} />
          </button>
        ) : <span className="cs-toggle-spacer" />}

        {!hasChildren && (
          <input
            type="checkbox"
            className="lp-check"
            checked={!!node.isDone}
            onChange={() => updateNodes((prev) => toggleCourseNodeDone(prev, node.id))}
            aria-label={`Mark ${node.title} done`}
            title={node.isDone && node.doneAt ? `Completed ${new Date(node.doneAt).toLocaleString()}` : 'Mark done'}
            style={{ width: 18, height: 18, minWidth: 18, ['--check-color']: depthColor }}
          />
        )}
        <span className="cs-num" title={`Item ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
        <span className="cs-type-badge">
          <TypeIcon size={9} /> {(() => { const t = node.type || 'Item'; return t.charAt(0).toUpperCase() + t.slice(1); })()}
        </span>
        <span className={`cs-node-title${node.isDone ? ' is-done' : ''}`}>{node.title}</span>
        {node.duration && <span className="cs-pill" title={node.duration}><Clock size={10} />{node.duration}</span>}
        {node.notes && <span className="cs-pill notes" title={node.notes}>{node.notes}</span>}

        <div className="cs-node-actions">
          <button type="button" className="lp-icon-btn" onClick={() => setOpenCommentId(isCommentOpen ? null : node.id)} title={hasComment ? 'Edit comment' : 'Add comment'} style={{ width: 24, height: 24, background: isCommentOpen || hasComment ? depthGlow : undefined, color: isCommentOpen || hasComment ? depthColor : undefined, border: isCommentOpen ? `1px solid ${depthColor}` : undefined, position: 'relative' }}>
            <MessageSquare size={11} />
            {hasComment && !isCommentOpen && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 999, background: 'var(--accent-amber)', border: '1px solid var(--bg-card)' }} />}
          </button>
          <button type="button" className="lp-icon-btn" disabled={index === 0} onClick={() => updateNodes((prev) => moveCourseNode(prev, node.id, 'up'))} title="Move up" style={{ width: 24, height: 24 }}><ArrowUp size={11} /></button>
          <button type="button" className="lp-icon-btn" disabled={index === sibCount - 1} onClick={() => updateNodes((prev) => moveCourseNode(prev, node.id, 'down'))} title="Move down" style={{ width: 24, height: 24 }}><ArrowDown size={11} /></button>
          <button type="button" className="lp-icon-btn" onClick={() => { setAddDraft({ title: '', type: '' }); setEditingNodeId(null); setAddingParentId(node.id); }} title="Add child" aria-label={`Add child to ${node.title}`} style={{ width: 24, height: 24 }}><Plus size={11} /></button>
          <button type="button" className="lp-icon-btn" onClick={() => startEdit(node)} title="Edit" aria-label={`Edit ${node.title}`} style={{ width: 24, height: 24 }}><Pencil size={11} /></button>
          <button type="button" className="lp-icon-btn" onClick={() => onDeleteRequest(node)} title="Delete" aria-label={`Delete ${node.title}`} style={{ width: 24, height: 24 }}><Trash2 size={11} /></button>
        </div>
      </div>

      {/* ── Edit panel — 2 rows, right below the clicked box ── */}
      {isEditing && (
        <div className="cs-pop-panel as-edit-form">
          <div className="cs-edit-row">
            <input
              className="input cs-edit-input-title"
              value={editDraft.title}
              onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="Title *"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(node.id); }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onEditSave(node.id)} disabled={!editDraft.title.trim()} style={{ height: 36 }}>Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNodeId(null)} style={{ height: 36 }}><X size={13} /></button>
          </div>
          <div className="cs-edit-row">
            <input
              value={editDraft.type}
              onChange={(e) => setEditDraft((p) => ({ ...p, type: e.target.value }))}
              placeholder="Type (Chapter/Module/Lesson)"
              className="input"
              style={{ height: 34 }}
            />
            <input
              className="input"
              value={editDraft.duration}
              onChange={(e) => setEditDraft((p) => ({ ...p, duration: e.target.value }))}
              placeholder="Duration (12:30)"
              style={{ height: 34 }}
            />
            <input
              className="input"
              value={editDraft.notes}
              onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notes"
              style={{ height: 34, flex: '1 1 140px' }}
            />
          </div>
        </div>
      )}

      {isCommentOpen && (
        <div className="cs-pop-panel">
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: depthColor, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <MessageSquare size={11} /> What did you learn? — comment
            </label>
            <textarea
              className="input"
              value={node.comment || ''}
              onChange={(e) => updateNodes((prev) => updateCourseNodeComment(prev, node.id, e.target.value))}
              placeholder="Write what you learned, key takeaways, mistakes to avoid..."
              rows={3}
              style={{ resize: 'vertical', fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenCommentId(null)} style={{ height: 30 }}>Close</button>
          </div>
        </div>
      )}

      {isAddingChild && (
        <div className="cs-pop-panel as-add-form">
          <input
            value={addDraft.type}
            onChange={(e) => setAddDraft((p) => ({ ...p, type: e.target.value }))}
            placeholder="Type — manual"
            className="input"
            style={{ height: 30, maxWidth: 130 }}
          />
          <input className="input" value={addDraft.title} onChange={(e) => setAddDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Child title (e.g. Lesson 1)" style={{ flex: '1 1 140px', height: 30 }} autoFocus onKeyDown={(e) => e.key === 'Enter' && onAdd(node.id)} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onAdd(node.id)} disabled={!addDraft.title.trim()} style={{ height: 30 }}>Add</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingParentId(null)} style={{ height: 30 }}><X size={12} /></button>
        </div>
      )}

      {hasChildren && (
        <div className={`cs-children${node.collapsed ? ' is-collapsed' : ''}`}>
          <div className="cs-children-inner">
          {children.map((child, cIdx) => (
            <CourseNodeRow
              key={child.id}
              node={child}
              courseId={courseId}
              nodes={nodes}
              depth={depth + 1}
              index={cIdx}
              sibCount={children.length}
              updateNodes={updateNodes}
              editingNodeId={editingNodeId}
              setEditingNodeId={setEditingNodeId}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onEditSave={onEditSave}
              startEdit={startEdit}
              addingParentId={addingParentId}
              setAddingParentId={setAddingParentId}
              addDraft={addDraft}
              setAddDraft={setAddDraft}
              onAdd={onAdd}
              openCommentId={openCommentId}
              setOpenCommentId={setOpenCommentId}
              templates={templates}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
