import { useState, useRef, useMemo } from 'react';
import { Plus, X, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { addQuestionPaper, readQuestionPaperFile, MAX_QUESTION_PAPER_BYTES } from '../../utils/questionBankStorage';
import { getExamTypesForCourseType } from './vaultUtils';

const createDefaultForm = (courseType) => ({
  type: getExamTypesForCourseType(courseType)[0],
  paperNo: '',
  solved: false,
  fileName: '',
  fileData: '',
  fileType: 'pdf',
});

export default function AddQuestionPaper({ vaultContext, selectedTerm, onAdded }) {
  const { user, isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const { department, yearSem, course, courseName, courseType = 'Theory' } = vaultContext;
  const examTypes = useMemo(() => getExamTypesForCourseType(courseType), [courseType]);
  const [form, setForm] = useState(() => createDefaultForm(courseType));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setForm(createDefaultForm(courseType));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
    setError('');
  };

  const handleOpen = () => {
    if (!isAuthenticated || user?.isGuest) {
      setError('Sign in to upload question papers.');
      setMessage('');
      setShowForm(false);
      return;
    }
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    try {
      const uploaded = await readQuestionPaperFile(file);
      setForm((current) => ({ ...current, ...uploaded }));
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload file.');
      setForm((current) => ({ ...current, fileName: '', fileData: '', fileType: 'pdf' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setForm((current) => ({ ...current, fileName: '', fileData: '', fileType: 'pdf' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedTerm) {
      setError('Select an academic term first.');
      return;
    }

    try {
      await addQuestionPaper({
        department,
        yearSem,
        course,
        name: courseName,
        type: form.type,
        year: selectedTerm.year,
        semester: selectedTerm.season,
        paperNo: form.paperNo,
        solved: form.solved,
        fileName: form.fileName,
        fileData: form.fileData,
        fileType: form.fileType,
      });
      resetForm();
      setShowForm(false);
      setMessage('Question paper uploaded successfully.');
      onAdded?.();
      setTimeout(() => setMessage(''), 3000);
    } catch (submitError) {
      setError(submitError.message || 'Could not upload question paper.');
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
                <h3 style={{ margin: 0, fontSize: 'var(--fs-md)' }}>Upload Question Paper</h3>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                  {courseName} · {selectedTerm?.label} · {course}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="grid-2" style={{ gap: '12px' }}>
              <label className="qb-add-field">
                <span>Exam Type</span>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
                >
                  {examTypes.map((examType) => (
                    <option key={examType} value={examType}>
                      {examType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="qb-add-field">
                <span>No.</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder={form.type ? `e.g. 1 → ${form.type} 1` : 'e.g. 1'}
                  value={form.paperNo}
                  onChange={(e) => setForm((current) => ({ ...current, paperNo: e.target.value }))}
                  required
                />
              </label>
            </div>

            <label className="qb-add-checkbox">
              <input
                type="checkbox"
                checked={form.solved}
                onChange={(e) => setForm((current) => ({ ...current, solved: e.target.checked }))}
              />
              <span>Mark as solved (solution available)</span>
            </label>

            <div className="qb-add-upload">
              <span className="input-label">
                Question Paper File (PDF or image, max {Math.round(MAX_QUESTION_PAPER_BYTES / (1024 * 1024))} MB)
              </span>
              {form.fileName ? (
                <div className="qb-upload-preview">
                  <span>{form.fileName}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveFile}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <label className="qb-upload-dropzone">
                  <Upload size={18} />
                  <span>Click to upload PDF / JPG / PNG</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    hidden
                  />
                </label>
              )}
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)' }}>{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-secondary btn-sm" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                <Upload size={14} /> Publish Paper
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        className="qb-fab"
        onClick={showForm ? closeForm : handleOpen}
        aria-label={showForm ? 'Close upload form' : 'Add question paper'}
      >
        {showForm ? <X size={22} /> : <Plus size={22} />}
      </button>
    </>
  );
}
