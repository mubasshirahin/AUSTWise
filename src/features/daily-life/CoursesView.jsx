import { useState, useMemo } from 'react';
import {
  GraduationCap, Plus, Trash2, Pencil, BookOpen,
  Building2, User, Clock, Link2, Tag, StickyNote, ExternalLink,
  ChevronRight, ChevronDown, ArrowUp, ArrowDown, Layers, Sparkles, X,
  Copy, Check, Upload, MessageSquare, FileText, Video, Dumbbell,
  Settings, CheckSquare
} from 'lucide-react';
import { LpEmpty, LpModal } from './LifePlannerUI';
import {
  useCourses, createCourse, updateCourse, deleteCourse, COURSE_COLORS,
  useCourseNodes, createCourseNode, updateCourseNode, deleteCourseNode,
  toggleCourseNodeCollapse, toggleCourseNodeDone, moveCourseNode, getCourseNodes, countCourseNodes, NODE_TYPES,
  updateCourseNodeComment, toggleCourseNodeCheck, DEFAULT_CHECKLIST_TEMPLATES
} from './coursesStorage';
import { COURSE_AI_MASTER_PROMPT } from './courseAiPrompt';
import { validateCourseAiJson, importCourseFromAiJson } from './courseAiImport';

const EMPTY_DRAFT = {
  title: '', provider: '', instructor: '', duration: '', category: '', link: '', notes: '' };

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
      notes: c.notes || '' });
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
        notes: draft.notes.trim() }));
    } else {
      updateCourses((prev) => createCourse(prev, {
        title: draft.title,
        provider: draft.provider,
        instructor: draft.instructor,
        duration: draft.duration,
        category: draft.category,
        link: draft.link,
        notes: draft.notes,
        color: COURSE_COLORS[prev.length % COURSE_COLORS.length] }));
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDeleteCourse = (id) => {
    updateCourses((prev) => deleteCourse(prev, id));
    // cascade delete its hierarchy
    updateNodes((prev) => prev.filter((n) => n.courseId !== id));
    if (activeCourseId === id) setActiveCourseId(null);
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

  const handleAiFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAiJson(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  // Detail view — drill into course
  if (activeCourse) {
    return (
      <CourseDetailView
        course={activeCourse}
        courses={courses}
        nodes={nodes}
        updateNodes={updateNodes}
        onBack={() => setActiveCourseId(null)}
        onEditCourse={() => openEdit(activeCourse)}
      />
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
        <button type="button" className="btn btn-primary btn-sm" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Course
        </button>
      </div>

      {/* ── AI: Generate Course Structure with AI ── */}
      <div className="lp-panel" style={{ marginBottom: 12, borderLeft: '3px solid var(--accent-amber)', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
            <Sparkles size={14} style={{ color: 'var(--accent-amber)' }} /> Generate Course Structure with AI
          </h4>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyPrompt} style={{ gap: 6 }}>
            {aiCopied ? <Check size={13} /> : <Copy size={13} />} {aiCopied ? 'Copied ✓' : 'Copy Prompt'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
          1. Copy prompt → paste into ChatGPT/Gemini/Claude &nbsp; 2. Answer AI’s questions &nbsp; 3. Copy the returned <code>JSON</code> &nbsp; 4. Paste below & Import
        </div>
        <pre style={{
          maxHeight: 180, overflow: 'auto', margin: 0, padding: '10px 12px',
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 10,
          fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)'
        }}>{COURSE_AI_MASTER_PROMPT}</pre>
      </div>

      {/* ── AI: Paste / Upload JSON ── */}
      <div className="lp-panel" style={{ marginBottom: 14, padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
            <Upload size={14} style={{ color: 'var(--accent-cyan)' }} /> Paste AI JSON
          </h4>
          <label className="btn btn-ghost btn-sm" style={{ gap: 6, cursor: 'pointer', border: '1px dashed var(--border-primary)' }}>
            <Upload size={12} /> Upload .json
            <input type="file" accept=".json,application/json" onChange={handleAiFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
        <textarea
          className="input"
          value={aiJson}
          onChange={(e) => setAiJson(e.target.value)}
          placeholder={'Paste the AI JSON here — e.g.\n{\n  "courseTitle": "React Bootcamp",\n  "platform": "Udemy",\n  "instructor": "Jonas",\n  "totalDuration": "40hr",\n  "structure": [ { "title": "Chapter 1: Intro", "type": "chapter", "children": [...] } ]\n}'}
          rows={7}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, resize: 'vertical', borderColor: aiValidation && !aiValidation.valid ? 'var(--accent-rose)' : undefined, background: aiValidation && !aiValidation.valid ? 'color-mix(in srgb, var(--accent-rose) 6%, transparent)' : undefined }}
        />
        {aiValidation && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 11 }}>
            {aiValidation.valid ? (
              <span className="lp-badge lp-badge-emerald" style={{ gap: 4 }}><Check size={11} /> Valid — {aiValidation.stats.chapters} chapter(s), {aiValidation.stats.totalNodes} items</span>
            ) : (
              <span className="lp-badge lp-badge-rose" style={{ gap: 4, maxWidth: '100%', wordBreak: 'break-word' }}><X size={11} /> {aiValidation.errors[0]}</span>
            )}
            {aiValidation.warnings.map((w, i) => <span key={i} className="lp-badge lp-badge-amber" style={{ fontSize: 10 }}>{w}</span>)}
          </div>
        )}
        {aiImportMsg && (
          <div style={{
            marginTop: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.4,
            background: aiImportMsg.type === 'success' ? 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' : 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
            border: `1px solid ${aiImportMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
            color: aiImportMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}>{aiImportMsg.text}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAiJson(''); setAiImportMsg(null); }}>Clear</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAiImport} disabled={!aiJson.trim() || (aiValidation && !aiValidation.valid)} style={{ gap: 6 }}>
            <ExternalLink size={12} /> Import — Direct
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.4 }}>
          Direct import — no review step. Duplicate title → auto-renamed to <code>Title (1)</code>. Platform → provider, totalDuration → duration (1:1).
        </div>
      </div>

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
              className="lp-hierarchy-card"
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
                  <button type="button" className="lp-icon-btn" onClick={() => handleDeleteCourse(c.id)} title="Delete" aria-label={`Delete ${c.title}`} style={{ width: 28, height: 28 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span className="lp-badge" style={{ background: `${c.color}18`, color: c.color, borderColor: `${c.color}30`, fontSize: 10, gap: 4 }}>
                  <Building2 size={10} /> {c.provider || c.code || '—'}
                </span>
                {c.category && <span className="lp-badge lp-badge-muted" style={{ fontSize: 9, gap: 4 }}><Tag size={10} />{c.category}</span>}
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
                {c.notes && <span style={{ display: 'flex', gap: 5, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4, background: 'var(--bg-tertiary)', borderRadius: 8, padding: '6px 8px', marginTop: 2 }}><StickyNote size={11} style={{ marginTop: 2, flexShrink: 0 }} /> <span style={{ wordBreak: 'break-word' }}>{c.notes.length > 80 ? c.notes.slice(0, 80) + '…' : c.notes}</span></span>}
              </div>

              <span style={{ fontSize: 10, color: 'var(--accent-amber)', fontWeight: 700, marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Build structure <ChevronRight size={12} />
              </span>
            </button>
          );})}
        </div>
      )}

      {showForm && (
        <LpModal title={editing ? 'Edit Course' : 'Add Course'} onClose={() => setShowForm(false)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Course Title *</label>
              <input className="input" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Complete React Bootcamp" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Company / Channel / Brand *</label>
              <input className="input" value={draft.provider} onChange={(e) => setDraft((p) => ({ ...p, provider: e.target.value }))} placeholder="Udemy, YouTube - freeCodeCamp, Coursera..." />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Instructor</label>
              <input className="input" value={draft.instructor} onChange={(e) => setDraft((p) => ({ ...p, instructor: e.target.value }))} placeholder="e.g. Jonas Schmedtmann" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Duration</label>
                <input className="input" value={draft.duration} onChange={(e) => setDraft((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 40 hours" />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Category</label>
                <input className="input" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} placeholder="Development, Design..." />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Course Link</label>
              <input className="input" value={draft.link} onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea className="input" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Key takeaways..." rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={!draft.title.trim() || !draft.provider.trim()}> {editing ? 'Save' : 'Add'} </button>
            </div>
          </div>
        </LpModal>
      )}
    </div>
  );
}

function CourseDetailView({ course, nodes, updateNodes, onBack, onEditCourse }) {
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', type: 'custom', notes: '' });
  const [addingParentId, setAddingParentId] = useState(null);
  const [addDraft, setAddDraft] = useState({ title: '', type: '' });
  const [openCommentId, setOpenCommentId] = useState(null);
  const templates = DEFAULT_CHECKLIST_TEMPLATES;

  const topNodes = useMemo(() => getCourseNodes(nodes, course.id, null), [nodes, course.id]);

  const startAdd = (parentId) => {
    setAddingParentId(parentId);
    setAddDraft({ title: '', type: '' });
    setEditingNodeId(null);
  };
  const handleAdd = (parentId) => {
    if (!addDraft.title.trim()) return;
    const realParent = parentId === '__root__' ? null : parentId;
    updateNodes((prev) => createCourseNode(prev, course.id, realParent, { title: addDraft.title, type: addDraft.type }));
    setAddingParentId(null);
  };
  const startEdit = (node) => {
    setEditingNodeId(node.id);
    setEditDraft({ title: node.title, type: node.type || '', notes: node.notes || '' });
    setAddingParentId(null);
  };
  const handleEditSave = (id) => {
    if (!editDraft.title.trim()) return;
    updateNodes((prev) => updateCourseNode(prev, id, { title: editDraft.title.trim(), type: editDraft.type, notes: editDraft.notes.trim() }));
    setEditingNodeId(null);
  };

  return (
    <div>
      <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
        <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Courses
      </button>

      <div className="lp-panel" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${course.color}18`, color: course.color }}>
          <BookOpen size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{course.title}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={11} /> {course.provider}</span>
            {course.instructor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={11} /> {course.instructor}</span>}
            {course.duration && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {course.duration}</span>}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEditCourse} style={{ gap: 4 }}><Pencil size={12} /> Edit Course</button>
      </div>

      <div className="lp-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
            <Layers size={14} style={{ color: 'var(--accent-amber)' }} /> Structure
            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 999, padding: '2px 8px', color: 'var(--text-tertiary)' }}>
              {nodes.filter((n) => n.courseId === course.id).length} items
            </span>
          </h4>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => startAdd('__root__')} style={{ gap: 6 }}><Plus size={12} /> Add Top-Level Item</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8, padding: '8px 10px', background: 'color-mix(in srgb, var(--accent-amber) 8%, transparent)', border: '1px dashed color-mix(in srgb, var(--accent-amber) 22%, transparent)', borderRadius: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
          <Sparkles size={12} style={{ color: 'var(--accent-amber)' }} />
          <span>Manually build any hierarchy — <strong>Chapter → Module → Lesson</strong> or <strong>Part → Topic → Subtopic</strong>, totally flexible. Click <em>Add Child</em> on any item to nest deeper.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, padding: '6px 10px', background: 'color-mix(in srgb, var(--bg-tertiary) 55%, transparent)', border: '1px solid var(--border-primary)', borderRadius: 999, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent-amber)', display: 'inline-block' }} /> Level 0</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent-purple)', display: 'inline-block' }} /> Level 1</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent-emerald)', display: 'inline-block' }} /> Level 2</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent-cyan)', display: 'inline-block' }} /> Level 3</span>
          <span style={{ opacity: 0.3 }}>→</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent-rose)', display: 'inline-block' }} /> Level 4+</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.7 }}>color = depth • left border = parent</span>
        </div>

        {addingParentId === '__root__' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

const DEPTH_COLORS = ['var(--accent-amber)', 'var(--accent-purple)', 'var(--accent-emerald)', 'var(--accent-cyan)', 'var(--accent-rose)'];
const DEPTH_GLOWS = ['var(--accent-amber-glow)', 'var(--accent-purple-glow)', 'var(--accent-emerald-glow)', 'var(--accent-cyan-glow)', 'var(--accent-rose-glow)'];

function CourseNodeRow({
  node, courseId, nodes, depth, index, sibCount,
  updateNodes, editingNodeId, setEditingNodeId, editDraft, setEditDraft, onEditSave, startEdit,
  addingParentId, setAddingParentId, addDraft, setAddDraft, onAdd,
  openCommentId, setOpenCommentId, templates
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <div
        className="lp-panel"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 0,
          marginLeft: indent, borderLeft: `4px solid ${depthColor}`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${depthColor} 10%, var(--bg-card)), var(--bg-card))`,
          boxShadow: `0 2px 10px color-mix(in srgb, ${depthColor} 10%, transparent)`,
          position: 'relative', overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: depthColor, opacity: 0.9 }} />
        {hasChildren ? (
          <button type="button" className="lp-icon-btn" onClick={() => updateNodes((prev) => toggleCourseNodeCollapse(prev, node.id))} style={{ width: 22, height: 22, flexShrink: 0, background: depthGlow, color: depthColor, border: `1px solid color-mix(in srgb, ${depthColor} 22%, transparent)` }}>
            {node.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : <span style={{ width: 22, flexShrink: 0 }} />}

        {!isEditing ? (
          <>
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
            <span className="lp-badge" style={{ fontSize: 9, textTransform: 'capitalize', flexShrink: 0, background: `color-mix(in srgb, ${depthColor} 14%, transparent)`, color: depthColor, border: `1px solid color-mix(in srgb, ${depthColor} 24%, transparent)`, gap: 4 }}>
              <Layers size={9} /> {(node.type || 'Item')}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: node.isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', wordBreak: 'break-word', textDecoration: node.isDone ? 'line-through' : 'none', opacity: node.isDone ? 0.7 : 1 }}>{node.title}</span>
            {node.notes && <span title={node.notes} style={{ fontSize: 10, color: 'var(--text-tertiary)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg-tertiary)', borderRadius: 999, padding: '2px 7px', border: '1px solid var(--border-primary)' }}>{node.notes}</span>}

            <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
              <button type="button" className="lp-icon-btn" onClick={() => setOpenCommentId(isCommentOpen ? null : node.id)} title={hasComment ? 'Edit comment' : 'Add comment'} style={{ width: 24, height: 24, background: isCommentOpen || hasComment ? depthGlow : undefined, color: isCommentOpen || hasComment ? depthColor : undefined, border: isCommentOpen ? `1px solid ${depthColor}` : undefined, position: 'relative' }}>
                <MessageSquare size={11} />
                {hasComment && !isCommentOpen && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 999, background: 'var(--accent-amber)', border: '1px solid var(--bg-card)' }} />}
              </button>
              <button type="button" className="lp-icon-btn" disabled={index === 0} onClick={() => updateNodes((prev) => moveCourseNode(prev, node.id, 'up'))} title="Move up" style={{ width: 24, height: 24 }}><ArrowUp size={11} /></button>
              <button type="button" className="lp-icon-btn" disabled={index === sibCount - 1} onClick={() => updateNodes((prev) => moveCourseNode(prev, node.id, 'down'))} title="Move down" style={{ width: 24, height: 24 }}><ArrowDown size={11} /></button>
              <button type="button" className="lp-icon-btn" onClick={() => setAddingParentId(node.id)} title="Add child" style={{ width: 24, height: 24 }}><Plus size={11} /></button>
              <button type="button" className="lp-icon-btn" onClick={() => startEdit(node)} title="Edit" style={{ width: 24, height: 24 }}><Pencil size={11} /></button>
              <button type="button" className="lp-icon-btn" onClick={() => updateNodes((prev) => deleteCourseNode(prev, node.id))} title="Delete" style={{ width: 24, height: 24 }}><Trash2 size={11} /></button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
            <input
              value={editDraft.type}
              onChange={(e) => setEditDraft((p) => ({ ...p, type: e.target.value }))}
              placeholder="Type — manual"
              className="input"
              style={{ height: 30, maxWidth: 130 }}
            />
            <input className="input" value={editDraft.title} onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))} style={{ flex: '1 1 140px', height: 30 }} autoFocus />
            <input className="input" value={editDraft.notes} onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" style={{ flex: '1 1 120px', height: 30 }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onEditSave(node.id)} disabled={!editDraft.title.trim()} style={{ height: 30 }}>Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNodeId(null)} style={{ height: 30 }}><X size={12} /></button>
          </div>
        )}
      </div>

      {isCommentOpen && (
        <div style={{ marginLeft: indent + 28, padding: '10px 12px', background: 'var(--bg-card)', border: `1px solid color-mix(in srgb, ${depthColor} 18%, var(--border-primary))`, borderLeft: `3px solid ${depthColor}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: `0 2px 8px color-mix(in srgb, ${depthColor} 8%, transparent)` }}>
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginLeft: indent + 28, padding: '8px 10px', background: 'var(--bg-tertiary)', border: '1px dashed var(--border-primary)', borderRadius: 10 }}>
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

      {!node.collapsed && hasChildren && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: indent + 12, borderLeft: `2px solid color-mix(in srgb, ${depthColor} 28%, transparent)`, paddingLeft: 10, position: 'relative' }}>
          <div style={{ position: 'absolute', left: -2, top: 6, bottom: 6, width: 2, background: `linear-gradient(to bottom, ${depthColor}, transparent)`, opacity: 0.35, borderRadius: 999 }} />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
