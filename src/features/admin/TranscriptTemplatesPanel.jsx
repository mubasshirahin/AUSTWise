import { useState, useCallback } from 'react';
import { FileText, Plus, Trash2, Edit3, Save, X } from 'lucide-react';
import { loadTemplates, addTemplate, updateTemplate, deleteTemplate } from '../../utils/transcriptTemplates';
import CourseAutocomplete from '../../components/CourseAutocomplete';

export default function TranscriptTemplatesPanel() {
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorForm, setEditorForm] = useState({
    name: '',
    semester: '1-1',
    department: 'CSE',
    year: new Date().getFullYear().toString(),
    courses: []
  });

  const refreshTemplates = useCallback(() => {
    const loaded = loadTemplates();
    setTemplates(loaded);
  }, []);

  const openAddTemplate = () => {
    setEditingTemplate(null);
    setEditorForm({
      name: '',
      semester: '1-1',
      department: 'CSE',
      year: new Date().getFullYear().toString(),
      courses: []
    });
    setShowEditor(true);
  };

  const openEditTemplate = (template) => {
    setEditingTemplate(template.id);
    setEditorForm({
      name: template.name,
      semester: template.semester,
      department: template.department,
      year: template.year,
      courses: template.courses.map(c => ({ ...c }))
    });
    setShowEditor(true);
  };

  const handleSaveTemplate = () => {
    if (!editorForm.name.trim() || editorForm.courses.length === 0) {
      alert('Please provide a name and at least one course.');
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate, editorForm);
    } else {
      addTemplate(editorForm);
    }

    refreshTemplates();
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(templateId);
      refreshTemplates();
    }
  };

  const addCourse = () => {
    setEditorForm({
      ...editorForm,
      courses: [...editorForm.courses, { code: '', name: '', credit: 3, grade: '-', point: null }]
    });
  };

  const updateCourse = (index, field, value) => {
    const updated = editorForm.courses.map((course, i) => {
      if (i !== index) return course;
      const updatedCourse = { ...course, [field]: value };
      return updatedCourse;
    });
    setEditorForm({ ...editorForm, courses: updated });
  };

  const removeCourse = (index) => {
    const updated = editorForm.courses.filter((_, i) => i !== index);
    setEditorForm({ ...editorForm, courses: updated });
  };

  const handleCourseCodeSelect = (index, selectedCourse) => {
    if (selectedCourse && selectedCourse.code) {
      const lastDigit = parseInt(selectedCourse.code.slice(-1));
      const autoCredit = !isNaN(lastDigit) && lastDigit % 2 === 1 ? 3 : 1.5;
      
      // Update all fields at once to ensure consistency
      const updated = editorForm.courses.map((course, i) => {
        if (i !== index) return course;
        return {
          ...course,
          code: selectedCourse.code,
          name: selectedCourse.name || '',
          credit: autoCredit
        };
      });
      setEditorForm({ ...editorForm, courses: updated });
    }
  };

  const semesterOptions = [
    { value: '1-1', label: '1st Semester (1-1)' },
    { value: '1-2', label: '2nd Semester (1-2)' },
    { value: '2-1', label: '3rd Semester (2-1)' },
    { value: '2-2', label: '4th Semester (2-2)' },
    { value: '3-1', label: '5th Semester (3-1)' },
    { value: '3-2', label: '6th Semester (3-2)' },
    { value: '4-1', label: '7th Semester (4-1)' },
    { value: '4-2', label: '8th Semester (4-2)' },
  ];

  const departmentOptions = ['CSE', 'EEE', 'ME', 'CE', 'IPE', 'MSE', 'MATH', 'PHY', 'HUM', 'BBA', 'ECON'];

  return (
    <div>
      <div className="glass-card-static mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>Transcript Templates</h3>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Manage course templates for different semesters. Users can load these templates to quickly populate their transcript.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddTemplate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="glass-card-static" style={{ padding: '60px', textAlign: 'center' }}>
          <FileText size={64} style={{ color: 'var(--text-tertiary)', opacity: 0.5, marginBottom: '20px' }} />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: '0 0 8px' }}>No Templates Available</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No transcript templates have been created yet.</p>
          <button className="btn btn-primary" onClick={openAddTemplate}>
            <Plus size={16} /> Create First Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {templates.map(template => (
            <div key={template.id} className="glass-card-static">
              <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>{template.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge badge-blue" style={{ fontSize: '9px', padding: '1px 4px' }}>{template.department}</span>
                    <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 4px' }}>Sem {template.semester}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{template.year}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{template.courses.length} courses</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditTemplate(template)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Edit3 size={14} /> Edit
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteTemplate(template.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>

              {/* Course List Preview */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-xs)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-primary)' }}>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'left' }}>Course Code</th>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'left' }}>Course Name</th>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'center', width: '80px' }}>Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.courses.map((course, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{course.code}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{course.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-tertiary)' }}>{course.credit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Template Modal */}
      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal glass-card-static" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', margin: 0 }}>
                {editingTemplate ? 'Edit Template' : 'Add New Template'}
              </h3>
              <button className="btn btn-icon" onClick={() => setShowEditor(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Template Info */}
              <div className="grid-2" style={{ gap: '10px' }}>
                <div>
                  <label className="input-label">Template Name *</label>
                  <input
                    type="text"
                    value={editorForm.name}
                    onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                    className="input"
                    placeholder="e.g., CSE 1st Semester - Standard Courses"
                  />
                </div>
                <div>
                  <label className="input-label">Year</label>
                  <input
                    type="text"
                    value={editorForm.year}
                    onChange={(e) => setEditorForm({ ...editorForm, year: e.target.value })}
                    className="input"
                    placeholder="e.g., 2025"
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '10px' }}>
                <div>
                  <label className="input-label">Department</label>
                  <select
                    value={editorForm.department}
                    onChange={(e) => setEditorForm({ ...editorForm, department: e.target.value })}
                    className="input"
                  >
                    {departmentOptions.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Semester</label>
                  <select
                    value={editorForm.semester}
                    onChange={(e) => setEditorForm({ ...editorForm, semester: e.target.value })}
                    className="input"
                  >
                    {semesterOptions.map(sem => (
                      <option key={sem.value} value={sem.value}>{sem.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Courses - Table Style like CGPA Calculator */}
              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
                <div className="flex justify-between items-center mb-3">
                  <label className="input-label" style={{ margin: 0 }}>Courses</label>
                  <button className="btn btn-secondary btn-sm" onClick={addCourse} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={14} /> Add Course
                  </button>
                </div>

                {editorForm.courses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
                    No courses added yet. Click "Add Course" to add courses.
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left', background: 'var(--bg-input)' }}>
                          <th style={{ padding: '10px', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semibold)' }}>Course Code</th>
                          <th style={{ padding: '10px', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semibold)' }}>Course Title</th>
                          <th style={{ padding: '10px', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semibold)', textAlign: 'center', width: '100px' }}>Credits</th>
                          <th style={{ width: '52px', padding: '10px', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semibold)', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editorForm.courses.map((course, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                            <td style={{ padding: '10px', fontWeight: 'var(--fw-semibold)', position: 'relative', overflow: 'visible', zIndex: 1000 }}>
                              <div style={{ position: 'relative', zIndex: 10001 }}>
                                <CourseAutocomplete
                                  value={course.code}
                                  onCourseSelect={(selected) => handleCourseCodeSelect(index, selected)}
                                  placeholder="Course code..."
                                  type="code"
                                />
                              </div>
                            </td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>
                              <input
                                className="input"
                                value={course.name}
                                onChange={(e) => updateCourse(index, 'name', e.target.value)}
                                placeholder="Course title"
                                style={{ minWidth: '200px' }}
                              />
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.5"
                                value={course.credit}
                                onChange={(e) => updateCourse(index, 'credit', e.target.value)}
                                style={{ width: '80px', margin: '0 auto', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <button
                                className="btn btn-secondary btn-icon"
                                onClick={() => removeCourse(index)}
                                disabled={editorForm.courses.length === 1}
                                title="Remove course"
                                style={{ width: '30px', height: '30px', opacity: editorForm.courses.length === 1 ? 0.45 : 1 }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button className="btn btn-primary flex-1" onClick={handleSaveTemplate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Save size={16} /> {editingTemplate ? 'Update Template' : 'Save Template'}
                </button>
                <button className="btn btn-secondary flex-1" onClick={() => setShowEditor(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}