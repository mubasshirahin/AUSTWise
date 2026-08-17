import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { addVaultCourse } from '../../utils/vaultCourseStorage';
import { inferCourseTypeFromCode } from './vaultExamTypes';

const defaultForm = {
  course: '',
  name: '',
};

export default function AddVaultCourse({ department, yearSem, onAdded }) {
  const { user, isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const detectedType = form.course ? inferCourseTypeFromCode(form.course) : null;

  const resetForm = () => {
    setForm({ ...defaultForm });
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
    setError('');
  };

  const handleOpen = () => {
    if (!isAuthenticated || user?.isGuest) {
      setError('Sign in to add courses.');
      setMessage('');
      setShowForm(false);
      return;
    }
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const entry = addVaultCourse({
        department,
        yearSem,
        course: form.course,
        name: form.name,
      });
      resetForm();
      setShowForm(false);
      setMessage('Course added successfully.');
      onAdded?.(entry);
      setTimeout(() => setMessage(''), 3000);
    } catch (submitError) {
      setError(submitError.message || 'Could not add course.');
    }
  };

  return (
    <>
      {message && !showForm && (
        <div className="qb-fab-toast qb-fab-toast-success">{message}</div>
      )}
      {error && !showForm && (
        <div className="qb-fab-toast qb-fab-toast-error">{error}</div>
      )}

      {showForm && (
        <div className="qb-add-modal-backdrop" onClick={closeForm}>
          <form
            className="qb-add-form glass-card-static"
            onSubmit={handleSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="qb-add-form-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>Add Course</h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                  {department} · Semester {yearSem}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <label className="qb-add-field">
              <span>Course Code</span>
              <CourseAutocomplete
                value={form.course}
                placeholder="e.g. CSE3101"
                type="code"
                department={department}
                onCourseSelect={(selected) => {
                  if (!selected) return;
                  if (selected.partialUpdate) {
                    setForm((current) => ({ ...current, course: selected.code }));
                  } else {
                    setForm({ course: selected.code, name: selected.name });
                  }
                }}
              />
              {detectedType && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  Auto-detected: {detectedType} (odd code = Theory, even code = Lab)
                </span>
              )}
            </label>

            <label className="qb-add-field">
              <span>Course Name</span>
              <CourseAutocomplete
                value={form.name}
                placeholder="e.g. Database Systems"
                type="name"
                department={department}
                onCourseSelect={(selected) => {
                  if (!selected) return;
                  if (selected.partialUpdate) {
                    setForm((current) => ({ ...current, name: selected.name }));
                  } else {
                    setForm({ course: selected.code, name: selected.name });
                  }
                }}
              />
            </label>

            {error && (
              <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)' }}>{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                <Plus size={14} /> Add Course
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        className="qb-fab qb-fab-emerald"
        onClick={showForm ? closeForm : handleOpen}
        aria-label={showForm ? 'Close add course form' : 'Add course'}
      >
        {showForm ? <X size={22} /> : <Plus size={22} />}
      </button>
    </>
  );
}
