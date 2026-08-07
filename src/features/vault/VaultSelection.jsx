import React, { useMemo, useState, useCallback } from 'react';
import { BookOpen, Building2, GraduationCap, Library, ArrowLeft, ChevronRight } from 'lucide-react';
import {
  heatmapDepartments,
  departmentLabels,
  getDepartmentPaperCount,
  getSemesterPaperCount,
  getCourseCategories,
  getYearSemOptions,
} from './vaultUtils';
import AddVaultCourse from './AddVaultCourse';
import VaultMasthead from './VaultMasthead';

const deptAccents = {
  CSE: 'vault-dept-cse',
  EEE: 'vault-dept-eee',
  CE: 'vault-dept-ce',
  ME: 'vault-dept-me',
  IPE: 'vault-dept-ipe',
  TE: 'vault-dept-te',
  ARCH: 'vault-dept-arch',
  BBA: 'vault-dept-bba',
};

export default function VaultSelection({
  department,
  yearSem,
  selectionStep,
  onSelectDepartment,
  onSelectYearSem,
  onSelectCourse,
  onBackToDepartments,
  onBackToSemesters,
  progress,
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshCourses = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const yearSemOptions = useMemo(
    () => (department ? getYearSemOptions(department) : []),
    [department],
  );

  const courseCategories = useMemo(() => {
    if (!department || !yearSem) return [];
    return getCourseCategories(department, yearSem);
  }, [department, yearSem, refreshKey]);

  if (!department) {
    return (
      <section className="vault-panel vault-panel-enter">
        <VaultMasthead department={department} yearSem={yearSem} />

        {progress}

        <div className="vault-dept-grid">
          {heatmapDepartments.map((dept, index) => {
            const paperCount = getDepartmentPaperCount(dept);
            return (
              <button
                key={dept}
                type="button"
                className={`vault-dept-card ${deptAccents[dept] || ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => onSelectDepartment(dept)}
              >
                <span className="vault-dept-card-glow" aria-hidden="true" />
                <span className="vault-dept-code">{dept}</span>
                <span className="vault-dept-name">{departmentLabels[dept] || dept}</span>
                {paperCount > 0 && (
                  <span className="vault-dept-meta">
                    {paperCount} papers
                    <ChevronRight size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (!yearSem) {
    return (
      <section className="vault-panel vault-panel-enter">
        <VaultMasthead department={department} yearSem={yearSem} />

        {progress}

        <div className="vault-sem-slider-wrap">
          <div className="vault-sem-slider">
            {yearSemOptions.map((sem, index) => {
              const paperCount = getSemesterPaperCount(department, sem);
              const [year, term] = sem.split('.');
              return (
                <button
                  key={sem}
                  type="button"
                  className="vault-sem-slide"
                  style={{ animationDelay: `${index * 40}ms` }}
                  onClick={() => onSelectYearSem(sem)}
                >
                  <span className="vault-sem-year">Y{year}</span>
                  <span className="vault-sem-term">{term}</span>
                  <span className="vault-sem-label">{sem}</span>
                  {paperCount > 0 && (
                    <span className="vault-sem-count">
                      {paperCount} papers
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="vault-panel vault-panel-enter">
      <div className="vault-panel-header">
        <div className="vault-panel-heading">
          <button
            type="button"
            className="vault-back-btn"
            onClick={onBackToSemesters}
            title="Back to semesters"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="vault-panel-icon vault-panel-icon-emerald">
            <Library size={20} />
          </div>
          <div>
            <h2 className="vault-panel-title">Select Course</h2>
            <p className="vault-panel-desc">
              Semester <strong>{yearSem}</strong> — tap a course to open the vault
            </p>
          </div>
        </div>

        <div className="vault-pill-select-row">
          <div className="vault-pill-select">
            <span className="vault-pill-select-label">Dept</span>
            <select
              className="vault-pill-select-input"
              value={department}
              onChange={(e) => onSelectDepartment(e.target.value)}
            >
              {heatmapDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="vault-pill-select">
            <span className="vault-pill-select-label">Sem</span>
            <select
              className="vault-pill-select-input"
              value={yearSem}
              onChange={(e) => onSelectYearSem(e.target.value)}
            >
              {yearSemOptions.map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {courseCategories.length === 0 ? (
        <div className="vault-empty-state">
          <BookOpen size={36} />
          <p>No courses for {department} — Semester {yearSem}</p>
          <span>Tap + below to add your first course</span>
        </div>
      ) : (
        <div className="vault-course-grid">
          {courseCategories.map((courseItem, index) => (
            <button
              key={courseItem.course}
              type="button"
              className="vault-course-card"
              style={{ animationDelay: `${index * 55}ms` }}
              onClick={() => onSelectCourse(courseItem.course, courseItem.name, courseItem.courseType)}
            >
              <div className="vault-course-card-top">
                <span className="vault-course-code">{courseItem.course}</span>
                <span className={`vault-course-type ${courseItem.courseType === 'Lab' ? 'lab' : 'theory'}`}>
                  {courseItem.courseType || 'Theory'}
                </span>
              </div>
              <span className="vault-course-name">{courseItem.name}</span>
              {courseItem.paperCount > 0 && (
                <span className="vault-course-count">{courseItem.paperCount} papers uploaded</span>
              )}
              <span className="vault-course-arrow">
                <ChevronRight size={16} />
              </span>
            </button>
          ))}
        </div>
      )}

      <AddVaultCourse
        department={department}
        yearSem={yearSem}
        onAdded={refreshCourses}
      />
    </section>
  );
}
