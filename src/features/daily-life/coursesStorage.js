import { useLiveValue } from '../../utils/liveStore';

export const COURSES_STORE_KEY = 'aust-life-courses-v1';

export function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const COURSE_COLORS = [
  '#F5A623', '#3ECF8E', '#3AC1D9', '#8b7e74', '#F0554A',
  '#b58cf5', '#5d9bf5', '#f5d15d', '#FF7A7A', '#4ECDC4',
];

export function useCourses() {
  const [raw, setRaw] = useLiveValue('user', COURSES_STORE_KEY, []);
  const courses = Array.isArray(raw) ? raw : [];
  const update = (fn) =>
    setRaw((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = typeof fn === 'function' ? fn(base) : fn;
      return next;
    });
  return [courses, update];
}

export function createCourse(courses, { title, provider, code, instructor, duration, link, category, level, status, price, startDate, endDate, certificateLink, notes, color }) {
  const course = {
    id: uid(),
    title: title.trim(),
    provider: (provider || code || '').trim(),
    instructor: instructor?.trim() || '',
    duration: duration?.trim() || '',
    link: link?.trim() || '',
    category: category?.trim() || '',
    level: level || 'beginner',
    status: status || 'planned',
    price: price?.trim() || '',
    startDate: startDate || null,
    endDate: endDate || null,
    certificateLink: certificateLink?.trim() || '',
    notes: notes?.trim() || '',
    // keep legacy code for backward compat
    code: (provider || code || '').trim(),
    color: color || COURSE_COLORS[courses.length % COURSE_COLORS.length],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return [...courses, course];
}

export function updateCourse(courses, id, patch) {
  return courses.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c));
}

export function deleteCourse(courses, id) {
  return courses.filter((c) => c.id !== id);
}

// ── Course hierarchy (manual flexible tree) ────────────────────────────────

export const COURSE_NODES_KEY = 'aust-life-course-nodes-v1';

export const COURSE_CHECKLIST_TEMPLATES_KEY = 'aust-life-course-checklist-templates-v1';

export const DEFAULT_CHECKLIST_TEMPLATES = [
  { id: 'tutorial', label: 'Tutorial', icon: 'Video' },
  { id: 'notes', label: 'Notes', icon: 'FileText' },
  { id: 'practice', label: 'Practice', icon: 'Dumbbell' },
];

export function useChecklistTemplates() {
  const [raw, setRaw] = useLiveValue('user', COURSE_CHECKLIST_TEMPLATES_KEY, null);
  const templates = raw === null || raw === undefined
    ? [...DEFAULT_CHECKLIST_TEMPLATES]
    : Array.isArray(raw) ? raw : [...DEFAULT_CHECKLIST_TEMPLATES];
  // init defaults on first load
  const update = (fn) =>
    setRaw((prev) => {
      const base = Array.isArray(prev) ? prev : (prev === null ? [...DEFAULT_CHECKLIST_TEMPLATES] : []);
      const effective = base.length === 0 ? [...DEFAULT_CHECKLIST_TEMPLATES] : base;
      const next = typeof fn === 'function' ? fn(effective) : fn;
      return next;
    });
  // if raw is null (first time), persist defaults
  if (raw === null) {
    // do not call setRaw during render; let caller init via effect if needed
  }
  return [templates.length === 0 ? [...DEFAULT_CHECKLIST_TEMPLATES] : templates, update];
}

export function createChecklistTemplate(templates, label) {
  const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `chk_${Date.now()}`;
  // ensure unique
  let unique = id;
  let c = 1;
  while (templates.some((t) => t.id === unique)) {
    unique = `${id}_${c++}`;
  }
  return [...templates, { id: unique, label: label.trim(), icon: 'CheckSquare' }];
}

export function updateChecklistTemplate(templates, id, patch) {
  return templates.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

export function deleteChecklistTemplate(templates, id) {
  return templates.filter((t) => t.id !== id);
}

export const NODE_TYPES = [
  { value: 'chapter', label: 'Chapter' },
  { value: 'module', label: 'Module' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'topic', label: 'Topic' },
  { value: 'section', label: 'Section' },
  { value: 'part', label: 'Part' },
  { value: 'unit', label: 'Unit' },
  { value: 'custom', label: 'Custom' },
];

export function useCourseNodes() {
  const [raw, setRaw] = useLiveValue('user', COURSE_NODES_KEY, []);
  const nodes = Array.isArray(raw) ? raw : [];
  const update = (fn) =>
    setRaw((prev) => {
      const base = Array.isArray(prev) ? prev : [];
      const next = typeof fn === 'function' ? fn(base) : fn;
      return next;
    });
  return [nodes, update];
}

function nextNodeOrder(nodes, courseId, parentId) {
  const siblings = nodes.filter((n) => n.courseId === courseId && (n.parentId || null) === (parentId || null));
  return siblings.reduce((m, n) => Math.max(m, n.order || 0), -1) + 1;
}

export function createCourseNode(nodes, courseId, parentId, { title, type = 'custom', notes = '' }) {
  const node = {
    id: uid(),
    courseId,
    parentId: parentId || null,
    title: title.trim(),
    type: type || 'custom',
    notes: notes?.trim() || '',
    order: nextNodeOrder(nodes, courseId, parentId),
    collapsed: false,
    isDone: false,
    doneAt: null,
    comment: '',
    checks: {},
    createdAt: new Date().toISOString(),
  };
  // if parent was a leaf and was marked done, adding a child makes it non-leaf — clear its done state
  const cleared = parentId ? nodes.map((n) => (n.id === parentId && n.isDone ? { ...n, isDone: false, doneAt: null } : n)) : nodes;
  return [...cleared, node];
}

export function updateCourseNode(nodes, id, patch) {
  return nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
}

export function deleteCourseNode(nodes, id) {
  // cascade delete children recursively
  const toDelete = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        changed = true;
      }
    }
  }
  return nodes.filter((n) => !toDelete.has(n.id));
}

export function toggleCourseNodeCollapse(nodes, id) {
  return nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n));
}

export function toggleCourseNodeDone(nodes, id) {
  return nodes.map((n) =>
    n.id === id ? { ...n, isDone: !n.isDone, doneAt: !n.isDone ? new Date().toISOString() : null } : n
  );
}

export function updateCourseNodeComment(nodes, id, comment) {
  return nodes.map((n) => (n.id === id ? { ...n, comment: comment || '' } : n));
}

export function toggleCourseNodeCheck(nodes, id, checkKey) {
  return nodes.map((n) => {
    if (n.id !== id) return n;
    const checks = { ...(n.checks || {}) };
    checks[checkKey] = !checks[checkKey];
    return { ...n, checks };
  });
}

export function moveCourseNode(nodes, id, dir) {
  const node = nodes.find((n) => n.id === id);
  if (!node) return nodes;
  const siblings = nodes
    .filter((n) => n.courseId === node.courseId && (n.parentId || null) === (node.parentId || null))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const idx = siblings.findIndex((s) => s.id === id);
  const swap = dir === 'up' ? siblings[idx - 1] : siblings[idx + 1];
  if (!swap) return nodes;
  return nodes.map((n) => {
    if (n.id === node.id) return { ...n, order: swap.order };
    if (n.id === swap.id) return { ...n, order: node.order };
    return n;
  });
}

export function getCourseNodes(nodes, courseId, parentId = null) {
  return nodes
    .filter((n) => n.courseId === courseId && (n.parentId || null) === (parentId || null))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function countCourseNodes(nodes, courseId) {
  return nodes.filter((n) => n.courseId === courseId).length;
}
