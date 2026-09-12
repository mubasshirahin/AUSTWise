import { createCourse, COURSE_COLORS, createCourseNode } from './coursesStorage';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateCourseAiJson(parsed) {
  const errors = [];
  const warnings = [];

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Root must be a JSON object'], warnings, stats: null };
  }

  if (!isNonEmptyString(parsed.courseTitle)) {
    errors.push('Missing or empty "courseTitle" (string required)');
  }

  if (parsed.structure !== undefined && !Array.isArray(parsed.structure)) {
    errors.push('"structure" must be an array if provided');
  }

  const structure = Array.isArray(parsed.structure) ? parsed.structure : [];

  let totalNodes = 0;
  let emptyTitles = 0;

  function walk(nodes, path) {
    if (!Array.isArray(nodes)) {
      errors.push(`Expected array at ${path}`);
      return;
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const curPath = `${path}[${i}]`;
      if (!n || typeof n !== 'object') {
        errors.push(`Invalid node at ${curPath}: must be an object with "title"`);
        continue;
      }
      if (!isNonEmptyString(n.title)) {
        emptyTitles += 1;
        // don't error hard — we will skip empty titles with warning
      } else {
        totalNodes += 1;
      }
      if (n.type !== undefined && typeof n.type !== 'string') {
        errors.push(`"type" at ${curPath} must be a string`);
      }
      if (n.children !== undefined) {
        if (!Array.isArray(n.children)) {
          errors.push(`"children" at ${curPath} must be an array`);
        } else {
          walk(n.children, `${curPath}.children`);
        }
      }
    }
  }

  walk(structure, 'structure');

  if (emptyTitles > 0) {
    warnings.push(`${emptyTitles} node(s) with empty title will be skipped`);
  }

  const stats = {
    chapters: structure.length,
    totalNodes,
  };

  return { valid: errors.length === 0, errors, warnings, stats };
}

function getUniqueTitle(courses, base) {
  const existing = new Set(courses.map((c) => c.title.trim().toLowerCase()));
  const trimmed = base.trim();
  if (!existing.has(trimmed.toLowerCase())) return trimmed;
  let i = 1;
  while (true) {
    const candidate = `${trimmed} (${i})`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
    i += 1;
  }
}

export function importCourseFromAiJson(courses, nodes, jsonString) {
  let parsed;
  try {
    // Allow json wrapped in ```json code block — extract inner
    const trimmed = jsonString.trim();
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const toParse = codeBlockMatch ? codeBlockMatch[1] : trimmed;
    parsed = JSON.parse(toParse);
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${e.message}` };
  }

  const validation = validateCourseAiJson(parsed);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('; '), validation };
  }

  const warnings = [...validation.warnings];

  // 1:1 mappings per decisions
  const rawTitle = parsed.courseTitle.trim();
  const title = getUniqueTitle(courses, rawTitle);
  if (title !== rawTitle) warnings.push(`Title "${rawTitle}" exists — renamed to "${title}"`);

  const provider = (parsed.platform || '').toString().trim();
  const instructor = (parsed.instructor || '').toString().trim();
  const duration = (parsed.totalDuration || '').toString().trim();

  // Create course
  const color = COURSE_COLORS[courses.length % COURSE_COLORS.length];
  let newCourses = createCourse(courses, {
    title,
    provider,
    instructor,
    duration,
    category: '',
    link: '',
    notes: '',
    color,
  });
  const newCourse = newCourses[newCourses.length - 1];

  // Bulk-create nodes depth-first, preserving order, single-pass accumulation
  let accNodes = [...nodes];
  let created = 0;

  function walkCreate(list, parentId) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || !isNonEmptyString(item.title)) continue;
      const type = (item.type || 'custom').toString().trim().toLowerCase() || 'custom';
      const beforeLen = accNodes.length;
      accNodes = createCourseNode(accNodes, newCourse.id, parentId, {
        title: item.title.trim(),
        type,
      });
      const createdNode = accNodes[accNodes.length - 1];
      created += 1;
      if (Array.isArray(item.children) && item.children.length > 0) {
        walkCreate(item.children, createdNode.id);
      }
      // safety guard for huge structures
      if (created > 2000) {
        warnings.push('Structure truncated at 2000 nodes');
        break;
      }
    }
  }

  const structure = Array.isArray(parsed.structure) ? parsed.structure : [];
  walkCreate(structure, null);

  return {
    ok: true,
    course: newCourse,
    courses: newCourses,
    nodes: accNodes,
    nodeCount: created,
    warnings,
    validation,
  };
}
