import { liveLoad, liveSave } from './liveStorage';
/**
 * Routine Templates Storage System
 * Global templates that admin can manage and users can load
 */

const TEMPLATES_STORAGE_KEY = 'aust-routine-templates-v1';

// Load all templates from storage
export function loadTemplates() {
  // Shared (global) templates managed by admins — server-backed so every user
  // sees the same set. localStorage stays as the fast offline cache.
  return liveLoad('shared', TEMPLATES_STORAGE_KEY, []);
}

export function saveTemplates(templates) {
  liveSave('shared', TEMPLATES_STORAGE_KEY, templates);
}

// Get a single template by ID
export function getTemplateById(templateId) {
  const templates = loadTemplates();
  return templates.find(t => t.id === templateId) || null;
}

// Add a new template
export function addTemplate(template) {
  const templates = loadTemplates();
  const newTemplate = {
    ...template,
    id: `template-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
}

// Update an existing template
export function updateTemplate(templateId, updates) {
  const templates = loadTemplates();
  const index = templates.findIndex(t => t.id === templateId);
  if (index !== -1) {
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveTemplates(templates);
    return templates[index];
  }
  return null;
}

// Delete a template
export function deleteTemplate(templateId) {
  const templates = loadTemplates();
  const filtered = templates.filter(t => t.id !== templateId);
  if (filtered.length !== templates.length) {
    saveTemplates(filtered);
    return true;
  }
  return false;
}

// Get templates by department
export function getTemplatesByDepartment(department) {
  const templates = loadTemplates();
  return templates.filter(t => t.department === department);
}

// Get templates by semester
export function getTemplatesBySemester(semester) {
  const templates = loadTemplates();
  return templates.filter(t => t.semester === semester);
}

// Merge multiple semester templates into one combined weekly routine.
// Returns { routine, weekDays } or null when there is nothing to merge.
// Class ids are regenerated so classes from different templates never collide.
export function mergeTemplatesToRoutine(templates) {
  if (!templates || templates.length === 0) return null;

  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const days = [...new Set([...dayOrder, ...templates.flatMap(t => t.weekDays || [])])];

  const routine = {};
  days.forEach(day => {
    routine[day] = templates.flatMap((t, tIdx) =>
      (t.routine && t.routine[day]) ? t.routine[day].map((cls, cIdx) => ({
        ...cls,
        id: `${t.id || 'tpl'}-${day}-${tIdx}-${cIdx}`,
      })) : []
    );
  });

  return { routine, weekDays: days };
}