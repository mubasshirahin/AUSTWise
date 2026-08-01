/**
 * Routine Templates Storage System
 * Global templates that admin can manage and users can load
 */

const TEMPLATES_STORAGE_KEY = 'aust-routine-templates-v1';

// Load all templates from storage
export function loadTemplates() {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // No stored templates yet
    return [];
  } catch {
    return [];
  }
}

// Save all templates to storage
export function saveTemplates(templates) {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage error
  }
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