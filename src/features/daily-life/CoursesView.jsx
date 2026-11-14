import { useState, useMemo } from 'react';
import {
  GraduationCap, Plus, Trash2, Pencil, BookOpen,
  Building2, User, Clock, Link2, Tag, StickyNote, ExternalLink,
  ChevronRight, ChevronDown, ArrowUp, ArrowDown, Layers, Sparkles,
  Copy, Check, Upload, MessageSquare, FileText, Video, Dumbbell,
  Settings, CheckSquare, Play, ListChecks
} from 'lucide-react';
import { LpEmpty, LpModal, LpConfirm } from './LifePlannerUI';
import {
  useCourses, createCourse, updateCourse, deleteCourse, COURSE_COLORS,
  useCourseNodes, createCourseNode, updateCourseNode, deleteCourseNode,
  toggleCourseNodeCollapse, toggleCourseNodeDone, moveCourseNode, getCourseNodes, countCourseNodes, NODE_TYPES,
  updateCourseNodeComment, toggleCourseNodeCheck, DEFAULT_CHECKLIST_TEMPLATES, moveCourseNodeTo
} from './coursesStorage';
import useCourseRowGestures, { SWIPE_TRIGGER } from './useCourseRowGestures';
import CourseHeatmap from './CourseHeatmap';
import { COURSE_AI_MASTER_PROMPT } from './courseAiPrompt';
import { validateCourseAiJson, importCourseFromAiJson } from './courseAiImport';
import './CourseStructure.css';

/** e.g. "14 Nov 2026, 3:45 pm" — when a lesson was ticked done. */
function fmtDoneAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

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
          <label className="pb-form-label">Course Title *</label>
          <input className="input" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Complete React Bootcamp" autoFocus />
        </div>
        <div className="cs-form-grid">
          <div>
            <label className="pb-form-label">Company / Channel / Brand *</label>
            <input className="input" value={draft.provider} onChange={(e) => setDraft((p) => ({ ...p, provider: e.target.value }))} placeholder="Udemy, YouTube..." />
          </div>
          <div>
            <label className="pb-form-label">Instructor</label>
            <input className="input" value={draft.instructor} onChange={(e) => setDraft((p) => ({ ...p, instructor: e.target.value }))} placeholder="e.g. Jonas Schmedtmann" />
          </div>
        </div>
        <div className="cs-form-grid">
          <div>
            <label className="pb-form-label">Duration</label>
            <input className="input" value={draft.duration} onChange={(e) => setDraft((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 40 hours" />
          </div>
          <div>
            <label className="pb-form-label">Category</label>
            <input className="input" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} placeholder="Development, Design..." />
          </div>
        </div>
        <div className="cs-form-grid">
          <div>
            <label className="pb-form-label">Level</label>
            <input className="input" value={draft.level} onChange={(e) => setDraft((p) => ({ ...p, level: e.target.value }))} placeholder="Beginner, Intermediate..." />
          </div>
          <div>
            <label className="pb-form-label">Language</label>
            <input className="input" value={draft.language} onChange={(e) => setDraft((p) => ({ ...p, language: e.target.value }))} placeholder="English, Bengali..." />
          </div>
        </div>
        <div>
          <label className="pb-form-label">Course Link</label>
          <input className="input" value={draft.link} onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))} placeholder="https://..." />
        </div>
        <div className="cs-form-grid">
          <div>
            <label className="pb-form-label">Description</label>
            <textarea className="input" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="What this course covers..." rows={1} style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label className="pb-form-label">Notes</label>
            <textarea className="input" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Key takeaways..." rows={1} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="lp-modal-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={!draft.title.trim() || !draft.provider.trim()}>{editing ? 'Save' : 'Add'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
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
    <div className="pb-stack">
      <section className="pb-card">
        <header className="pb-head pb-head-wrap">
          <h3 className="pb-title">Courses</h3>
          <span className="pb-count">{courses.length}</span>
          <span className="pb-meta pb-head-hint">Extra-curricular learning — open a course to build its structure</span>
          <div className="pb-head-actions">
            <button type="button" className={`pb-btn-soft${aiCopied ? ' is-ok' : ''}`} onClick={handleCopyPrompt} title="Copy the AI master prompt">
              {aiCopied ? <Check size={13} /> : <Copy size={13} />} {aiCopied ? 'Copied' : 'Copy prompt'}
            </button>
            <button
              type="button"
              className={`pb-btn-soft${aiPanel === 'paste' ? ' is-on' : ''}`}
              onClick={handlePasteBtn}
              aria-expanded={aiPanel === 'paste'}
              aria-controls="course-ai-paste-panel"
              title="Paste the AI output (JSON)"
            >
              <Upload size={13} /> Paste AI JSON
            </button>
            <button type="button" className="btn btn-primary btn-sm pb-btn" onClick={() => { setAiPanel(null); openAdd(); }}>
              <Plus size={14} /> Add course
            </button>
          </div>
        </header>

        {aiPanel === 'paste' && (
          <div id="course-ai-paste-panel" className="pb-paste">
            <textarea
              className="input pb-mono"
              value={aiJson}
              autoFocus
              onChange={(e) => setAiJson(e.target.value)}
              placeholder="Paste AI JSON here…"
              rows={4}
            />
            <div className="pb-paste-foot">
              {aiImportMsg && aiImportMsg.type === 'error' ? <span className="pb-note-text is-alert">{aiImportMsg.text}</span> : <span />}
              <button type="button" className="btn btn-primary btn-sm pb-btn" onClick={handleAiImport} disabled={!aiJson.trim() || (aiValidation && !aiValidation.valid)}>
                <ExternalLink size={12} /> Import
              </button>
            </div>
          </div>
        )}
        {aiImportMsg && aiImportMsg.type === 'success' && <p className="pb-note-text is-ok">{aiImportMsg.text}</p>}

        {courses.length === 0 ? (
          <LpEmpty
            icon={BookOpen}
            title="No courses yet"
            hint="Add external courses — YouTube, Udemy, Coursera, workshops — then open one to map its chapters and lessons."
            action={<button type="button" className="btn btn-primary btn-sm pb-btn" onClick={openAdd}><Plus size={14} /> Add course</button>}
          />
        ) : (
          <div className="pb-course-grid">
            {courses.map((c) => {
              const nodeCount = countCourseNodes(nodes, c.id);
              const cNodes = nodes.filter((n) => n.courseId === c.id);
              const leaves = cNodes.filter((n) => !cNodes.some((o) => o.parentId === n.id));
              const pct = leaves.length ? Math.round((leaves.filter((n) => n.isDone).length / leaves.length) * 100) : 0;
              const meta = [c.instructor, c.duration, c.level, c.language].filter(Boolean);
              return (
                <article key={c.id} className="pb-course">
                  <button type="button" className="pb-course-open" onClick={() => setActiveCourseId(c.id)} aria-label={`Open ${c.title}`} />
                  <div className="pb-course-top">
                    <span className="pb-course-icon"><BookOpen size={15} /></span>
                    <span className="pb-label">{c.provider || c.code || 'Course'}</span>
                    <span className="pb-course-actions">
                      <button type="button" className="pb-icon is-sm" onClick={() => openEdit(c)} title="Edit" aria-label={`Edit ${c.title}`}><Pencil size={13} /></button>
                      <button type="button" className="pb-icon is-sm is-danger" onClick={() => requestDeleteCourse(c)} title="Delete" aria-label={`Delete ${c.title}`}><Trash2 size={13} /></button>
                    </span>
                  </div>
                  <h4 className="pb-course-title">{c.title}</h4>
                  {meta.length > 0 && <p className="pb-course-meta">{meta.join(' · ')}</p>}
                  {c.description && <p className="pb-course-desc">{c.description}</p>}
                  <div className="pb-course-tags">
                    {c.category && <span className="pb-tag"><Tag size={10} /> {c.category}</span>}
                    {c.link && <span className="pb-tag"><Link2 size={10} /> Link</span>}
                    {c.notes && <span className="pb-tag" title={c.notes}><StickyNote size={10} /> Notes</span>}
                  </div>
                  <div className="pb-course-foot">
                    <span className="pb-bar"><span style={{ width: `${pct}%` }} /></span>
                    <span className="pb-meta">{nodeCount ? `${pct}% · ${nodeCount} items` : 'No structure yet'}</span>
                    <ChevronRight size={15} className="pb-chev" aria-hidden="true" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
  const progressPct = leafNodes.length ? (doneLeafCount / leafNodes.length) * 100 : 0;
  const progressLabel = progressPct.toFixed(2); // e.g. "33.33"

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

  const metaBits = [
    course.provider && { icon: Building2, text: course.provider },
    course.instructor && { icon: User, text: course.instructor },
    course.duration && { icon: Clock, text: course.duration },
    course.level && { icon: GraduationCap, text: course.level },
    course.language && { icon: MessageSquare, text: course.language },
  ].filter(Boolean);

  return (
    <div className="pb-stack">
      <nav className="pb-crumbs" aria-label="Course path">
        <button type="button" className="pb-crumb" onClick={onBack}>Courses</button>
        <ChevronRight size={13} className="pb-crumb-sep" aria-hidden="true" />
        <span className="pb-crumb is-current is-static" title={course.title}>{course.title}</span>
      </nav>

      <section className="pb-card pb-context">
        <div className="pb-context-top">
          <span className="pb-label"><BookOpen size={11} /> Course</span>
          <button type="button" className="pb-btn-soft" onClick={onEditCourse}><Pencil size={12} /> Edit</button>
        </div>
        <h2 className="pb-context-title">{course.title}</h2>
        {metaBits.length > 0 && (
          <p className="pb-course-meta is-row">
            {metaBits.map(({ icon: Icon, text }) => <span key={text}><Icon size={12} /> {text}</span>)}
          </p>
        )}
        {course.description && <p className="pb-context-desc">{course.description}</p>}
        {courseNodes.length > 0 && (
          <div className="pb-context-progress">
            <span className="pb-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Course progress ${progressLabel}%`}>
              <span style={{ width: `${progressPct}%` }} />
            </span>
            <strong>{progressLabel}%</strong>
            <span className="pb-meta">{doneLeafCount}/{leafNodes.length} lessons done</span>
          </div>
        )}
      </section>

      <section className="pb-card">
        <header className="pb-head pb-head-wrap">
          <h3 className="pb-title">Structure</h3>
          <span className="pb-count">{courseNodes.length}</span>
          <div className="pb-head-actions">
            {courseNodes.length > 0 && (
              <>
                <button type="button" className="pb-btn-soft" onClick={() => setAllCollapsed(false)}><ChevronDown size={13} /> Expand</button>
                <button type="button" className="pb-btn-soft" onClick={() => setAllCollapsed(true)}><ChevronRight size={13} /> Collapse</button>
              </>
            )}
            <button type="button" className="btn btn-primary btn-sm pb-btn" onClick={() => startAdd('__root__')}><Plus size={13} /> Add item</button>
          </div>
        </header>

        {addingParentId === '__root__' && (
          <div className="cs-pop-panel as-add-form is-root" role="group" aria-label="Add top-level item">
            <span className="cs-pop-title"><Plus size={11} /> Add top-level item</span>
            <div className="cs-pop-row">
              <input
                className="input cs-pop-input is-type"
                value={addDraft.type}
                onChange={(e) => setAddDraft((p) => ({ ...p, type: e.target.value }))}
                placeholder="Type (Chapter…)"
              />
              <input
                className="input cs-pop-input is-title"
                value={addDraft.title}
                onChange={(e) => setAddDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="Title (e.g. Chapter 1)"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd('__root__'); if (e.key === 'Escape') setAddingParentId(null); }}
              />
            </div>
            <div className="cs-pop-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAdd('__root__')} disabled={!addDraft.title.trim()}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingParentId(null)}>Cancel</button>
            </div>
          </div>
        )}

        {topNodes.length === 0 ? (
          <p className="pb-empty-line is-boxed">No structure yet. Add a top-level item — e.g. <strong>Chapter</strong> or <strong>Module</strong>.</p>
        ) : (
          <div className="cs-tree pb-list-scroll">
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
      </section>

      {/* ── Activity heatmap — which days lessons were ticked done ── */}
      {leafNodes.length > 0 && <CourseHeatmap lessons={leafNodes} />}

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
          <div className="lp-modal-actions">
            <button type="button" className="btn btn-danger btn-sm" onClick={confirmDeleteNode}>
              Delete{deletingDescendants.length ? ` (${deletingDescendants.length + 1})` : ''}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeletingNode(null)}>Cancel</button>
          </div>
        </LpModal>
      )}
    </div>
  );
}

// Theme-matching warm palette (amber family) — no green, so depth
// highlights sit with the app's gold theme. Orange is a theme token.
// One theme accent for every depth — hierarchy reads from indentation + guide lines.
const DEPTH_COLORS = ['var(--accent-amber)'];
const DEPTH_GLOWS = ['var(--accent-amber-glow)'];

// Touch phones/tablets get swipe + long-press gestures on structure rows
const IS_TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;

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

  const startAddChild = () => { setAddDraft({ title: '', type: '' }); setEditingNodeId(null); setAddingParentId(node.id); };
  const { bindCard, dx: swipeDx, open: swipeOpen, holding, dragging, close: closeSwipe } = useCourseRowGestures({
    enabled: IS_TOUCH,
    index,
    onDelete: () => onDeleteRequest(node),
    onComment: () => { setEditingNodeId(null); setAddingParentId(null); setOpenCommentId(node.id); },
    onReorder: (to) => updateNodes((prev) => moveCourseNodeTo(prev, node.id, to)),
  });
  const showSwipeBg = IS_TOUCH && (swipeDx !== 0 || swipeOpen);

  return (
    <div
      className={`cs-node${dragging ? ' is-lifted' : ''}`}
      style={{
        '--cs-color': depthColor,
        '--cs-glow': depthGlow,
        '--cs-indent': `${indent}px`,
        '--cs-delay': `${Math.min(depth * 45 + index * 40, 360)}ms`,
      }}
    >
      <div className={`cs-swipe${IS_TOUCH ? ' is-swipeable' : ''}`}>
      {showSwipeBg && (
        <div className="cs-swipe-bg">
          <span className={`cs-swipe-action is-delete${swipeDx >= SWIPE_TRIGGER ? ' is-armed' : ''}`} style={{ opacity: swipeDx > 0 ? 1 : 0 }} aria-hidden="true">
            <Trash2 size={14} /> Delete
          </span>
          <span className="cs-swipe-btns" style={{ opacity: swipeDx < 0 ? 1 : 0 }}>
            <button type="button" className="cs-swipe-btn" tabIndex={-1} onClick={() => { closeSwipe(); startEdit(node); }}>
              <Pencil size={13} /> Edit
            </button>
            <button type="button" className="cs-swipe-btn is-add" tabIndex={-1} onClick={() => { closeSwipe(); startAddChild(); }} aria-label={`Add inside ${node.title}`}>
              <Plus size={15} />
            </button>
          </span>
        </div>
      )}
      <div
        ref={bindCard}
        className={`cs-node-card${node.isDone ? ' is-done' : ''}${swipeDx ? ' is-swiping' : ''}${holding || dragging ? ' is-held' : ''}`}
        style={swipeDx ? { transform: `translateX(${swipeDx}px)` } : undefined}
      >
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
        {node.isDone && node.doneAt && !hasChildren && (
          <span className="cs-pill cs-done-at" title={`Completed ${fmtDoneAt(node.doneAt)}`}>
            <Check size={10} />{fmtDoneAt(node.doneAt)}
          </span>
        )}
        {node.duration && <span className="cs-pill" title={node.duration}><Clock size={10} />{node.duration}</span>}
        {node.notes && <span className="cs-pill notes" title={node.notes}>{node.notes}</span>}

        <div className="cs-node-actions">
          <button type="button" className="lp-icon-btn" onClick={() => setOpenCommentId(isCommentOpen ? null : node.id)} title={hasComment ? 'Edit comment' : 'Add comment'} data-on={isCommentOpen || hasComment || undefined}>
            <MessageSquare size={11} />
            {hasComment && !isCommentOpen && <span className="cs-comment-dot" />}
          </button>
          <button type="button" className="lp-icon-btn" disabled={index === 0} onClick={() => updateNodes((prev) => moveCourseNode(prev, node.id, 'up'))} title="Move up"><ArrowUp size={11} /></button>
          <button type="button" className="lp-icon-btn" disabled={index === sibCount - 1} onClick={() => updateNodes((prev) => moveCourseNode(prev, node.id, 'down'))} title="Move down"><ArrowDown size={11} /></button>
          <button type="button" className="lp-icon-btn" onClick={startAddChild} title="Add child" aria-label={`Add child to ${node.title}`} data-on={isAddingChild || undefined}><Plus size={11} /></button>
          <button type="button" className="lp-icon-btn" onClick={() => startEdit(node)} title="Edit" aria-label={`Edit ${node.title}`} data-on={isEditing || undefined}><Pencil size={11} /></button>
          <button type="button" className="lp-icon-btn" onClick={() => onDeleteRequest(node)} title="Delete" aria-label={`Delete ${node.title}`}><Trash2 size={11} /></button>
        </div>
      </div>
      </div>

      {/* ── Edit panel — 2 rows, right below the clicked box ── */}
      {isEditing && (
        <div className="cs-pop-panel as-edit-form" role="group" aria-label={`Edit ${node.title}`}>
          <span className="cs-pop-title"><Pencil size={11} /> Edit item</span>
          <input
            className="input cs-pop-input cs-edit-input-title"
            value={editDraft.title}
            onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Title *"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(node.id); if (e.key === 'Escape') setEditingNodeId(null); }}
          />
          <div className="cs-pop-row">
            <input
              className="input cs-pop-input is-type"
              value={editDraft.type}
              onChange={(e) => setEditDraft((p) => ({ ...p, type: e.target.value }))}
              placeholder="Type (Chapter…)"
            />
            <input
              className="input cs-pop-input is-duration"
              value={editDraft.duration}
              onChange={(e) => setEditDraft((p) => ({ ...p, duration: e.target.value }))}
              placeholder="Duration"
            />
            <input
              className="input cs-pop-input is-notes"
              value={editDraft.notes}
              onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notes"
            />
          </div>
          <div className="cs-pop-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onEditSave(node.id)} disabled={!editDraft.title.trim()}>Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNodeId(null)}>Cancel</button>
          </div>
        </div>
      )}

      {isCommentOpen && (
        <div className="cs-pop-panel as-comment" role="group" aria-label={`Comment on ${node.title}`}>
          <span className="cs-pop-title"><MessageSquare size={11} /> What did you learn?</span>
          <textarea
            className="input cs-pop-textarea"
            value={node.comment || ''}
            onChange={(e) => updateNodes((prev) => updateCourseNodeComment(prev, node.id, e.target.value))}
            placeholder="Key takeaways, mistakes to avoid…"
            rows={3}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Escape') setOpenCommentId(null); }}
          />
          <div className="cs-pop-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenCommentId(null)}>Done</button>
            <span className="cs-pop-note">Saves as you type</span>
          </div>
        </div>
      )}

      {isAddingChild && (
        <div className="cs-pop-panel as-add-form" role="group" aria-label={`Add item inside ${node.title}`}>
          <span className="cs-pop-title"><Plus size={11} /> Add inside “{node.title}”</span>
          <div className="cs-pop-row">
            <input
              className="input cs-pop-input is-type"
              value={addDraft.type}
              onChange={(e) => setAddDraft((p) => ({ ...p, type: e.target.value }))}
              placeholder="Type (Lesson…)"
            />
            <input
              className="input cs-pop-input is-title"
              value={addDraft.title}
              onChange={(e) => setAddDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="Title (e.g. Lesson 1)"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') onAdd(node.id); if (e.key === 'Escape') setAddingParentId(null); }}
            />
          </div>
          <div className="cs-pop-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onAdd(node.id)} disabled={!addDraft.title.trim()}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingParentId(null)}>Cancel</button>
          </div>
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
