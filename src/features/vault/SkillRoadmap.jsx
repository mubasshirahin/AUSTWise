import React, { useState, useMemo } from 'react';
import { Route, Milestone, Award, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { skillRoadmaps } from '../../data/mockData';

export default function SkillRoadmap({ vaultContext }) {
  const { course, courseName } = vaultContext;
  const filteredRoadmaps = useMemo(
    () => (course
      ? skillRoadmaps.filter((roadmap) => !roadmap.course || roadmap.course === course)
      : skillRoadmaps),
    [course],
  );
  const [roadmaps, setRoadmaps] = useState(filteredRoadmaps);
  const [expandedId, setExpandedId] = useState(null);

  React.useEffect(() => {
    setRoadmaps(filteredRoadmaps);
    setExpandedId(null);
  }, [filteredRoadmaps]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleStep = (roadmapId, stepIdx) => {
    setRoadmaps(prev => prev.map(rm => {
      if (rm.id === roadmapId) {
        // Create simulation checking off steps
        const isCurrentlyCompleted = stepIdx < rm.completedSteps;
        let newCompleted = rm.completedSteps;
        
        if (isCurrentlyCompleted) {
          // Toggle off (can only toggle last completed step off)
          if (stepIdx === rm.completedSteps - 1) {
            newCompleted = rm.completedSteps - 1;
          }
        } else {
          // Toggle on (can only toggle next uncompleted step on)
          if (stepIdx === rm.completedSteps) {
            newCompleted = rm.completedSteps + 1;
          }
        }

        const progress = Math.round((newCompleted / rm.steps.length) * 100);

        return {
          ...rm,
          completedSteps: newCompleted,
          progress
        };
      }
      return rm;
    }));
  };

  return (
    <div className="glass-card-static schedule-widget skill-roadmaps animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Route size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Vault</span>
            <div className="schedule-title">Career Roadmaps</div>
            <span className="schedule-subtitle">
              {courseName} — track skills and career milestones
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" />

      {roadmaps.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <Route size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            No career roadmaps linked to {courseName} yet.
          </p>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {roadmaps.map(rm => {
          const isExpanded = expandedId === rm.id;

          return (
            <div 
              key={rm.id}
              style={{
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'var(--bg-card)'
              }}
            >
              {/* Header card info */}
              <div 
                onClick={() => toggleExpand(rm.id)}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--bg-input)' : 'transparent',
                  transition: 'background var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                  <span style={{ fontSize: '28px' }}>{rm.icon}</span>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>{rm.title} Roadmap</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="progress-bar" style={{ width: '120px' }}>
                        <div className="progress-bar-fill" style={{ width: `${rm.progress}%` }} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{rm.progress}% complete</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4" style={{ marginRight: '16px' }}>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                    {rm.completedSteps} / {rm.steps.length} Steps
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>

              {/* Steps timeline expansion */}
              {isExpanded && (
                <div className="animate-fadeIn" style={{ borderTop: '1px solid var(--border-primary)', padding: '24px 20px', background: 'var(--bg-secondary)' }}>
                  <div className="steps-flow-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                    {/* Vertical timeline connector */}
                    <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '11px', width: '2px', background: 'var(--border-primary)', zIndex: 1 }} />

                    {rm.steps.map((step, idx) => {
                      const isStepCompleted = idx < rm.completedSteps;
                      const isNextStep = idx === rm.completedSteps;

                      return (
                        <div 
                          key={step} 
                          className="flex items-center gap-4"
                          onClick={() => handleToggleStep(rm.id, idx)}
                          style={{ 
                            position: 'relative', 
                            zIndex: 2, 
                            cursor: 'pointer',
                            opacity: (isStepCompleted || isNextStep) ? 1 : 0.4
                          }}
                        >
                          <div 
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: isStepCompleted ? 'var(--accent-emerald)' : isNextStep ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                              border: isNextStep ? '2px solid var(--accent-blue)' : '2px solid var(--border-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isStepCompleted ? '#fff' : isNextStep ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}
                          >
                            {isStepCompleted ? <CheckCircle size={14} /> : (idx + 1)}
                          </div>

                          <div style={{ flex: 1 }}>
                            <span 
                              style={{ 
                                fontSize: '13px', 
                                fontWeight: isNextStep ? 'bold' : 'normal',
                                textDecoration: isStepCompleted ? 'line-through' : 'none',
                                color: isStepCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)'
                              }}
                            >
                              {step}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
