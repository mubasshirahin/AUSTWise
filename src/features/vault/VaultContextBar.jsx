import { useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import {
  heatmapDepartments,
  departmentLabels,
  getCourseCategories,
  getYearSemOptions,
} from './vaultUtils';

export default function VaultContextBar({
  department,
  yearSem,
  course,
  courseName,
  onBackToCourses,
  onDepartmentChange,
  onYearSemChange,
  onCourseChange,
}) {
  const yearSemOptions = useMemo(() => getYearSemOptions(department), [department]);
  const courseOptions = useMemo(
    () => getCourseCategories(department, yearSem),
    [department, yearSem],
  );

  return (
    <div className="vault-context-bar">
      <button
        type="button"
        className="vault-back-btn"
        onClick={onBackToCourses}
        title="Change course"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="vault-context-breadcrumb">
        <span className="vault-crumb">{department}</span>
        <ChevronRight size={12} className="vault-crumb-sep" />
        <span className="vault-crumb">{yearSem}</span>
        <ChevronRight size={12} className="vault-crumb-sep" />
        <span className="vault-crumb vault-crumb-active">{course}</span>
      </div>

      <div className="vault-context-info">
        <h2 className="vault-context-title">{courseName}</h2>
        <p className="vault-context-sub">{departmentLabels[department]}</p>
      </div>

      <div className="vault-context-pills">
        <label className="vault-pill-select vault-pill-select-compact">
          <span className="vault-pill-select-label">Dept</span>
          <select
            className="vault-pill-select-input"
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            {heatmapDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </label>
        <label className="vault-pill-select vault-pill-select-compact">
          <span className="vault-pill-select-label">Sem</span>
          <select
            className="vault-pill-select-input"
            value={yearSem}
            onChange={(e) => onYearSemChange(e.target.value)}
          >
            {yearSemOptions.map((sem) => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>
        </label>
        <label className="vault-pill-select vault-pill-select-compact vault-pill-select-wide">
          <span className="vault-pill-select-label">Course</span>
          <select
            className="vault-pill-select-input"
            value={course}
            onChange={(e) => onCourseChange(e.target.value)}
          >
            {courseOptions.map((item) => (
              <option key={item.course} value={item.course}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
