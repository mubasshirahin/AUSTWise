import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRoleAccessMap } from '../hooks/useRoleAccess';
import { getAccessRole } from '../utils/accessRole';
import './GliderTabs.css';

export default function GliderTabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  compact = false,
}) {
  const trackRef = useRef(null);
  const activeRef = useRef(null);
  const { user } = useAuth();
  const accessMap = useRoleAccessMap();
  const accessRole = getAccessRole(user);
  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const visibleTabs = useMemo(() => tabs.filter((tab) => {
    if (!tab.accessKey || isStaff) return true;
    const config = accessMap?.[tab.accessKey];
    if (!config) return true; // Keep visible until its access config is loaded.
    return config.enabled !== false && !(config.featureHidden || []).includes(accessRole);
  }), [tabs, accessMap, accessRole, isStaff]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.id === activeTab)) {
      onChange(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab, onChange]);

  useEffect(() => {
    const track = trackRef.current;
    const active = activeRef.current;
    if (!track || !active) return;

    const trackRect = track.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    track.style.setProperty('--glider-x', `${activeRect.left - trackRect.left}px`);
    track.style.setProperty('--glider-w', `${activeRect.width}px`);
  }, [activeTab, visibleTabs, compact]);

  return (
    <div className={`glider-tabs-wrap glider-tabs-${variant} ${compact ? 'glider-tabs-compact' : ''}`}>
      <div className="glider-tabs-track" ref={trackRef} role="tablist">
        <div className="glider-tabs-glider" aria-hidden="true" />
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : null}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`glider-tab ${isActive ? 'active' : ''} ${tab.color ? `glider-tab-${tab.color}` : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {Icon && (
                <span className="glider-tab-icon">
                  <Icon size={compact ? 15 : 16} />
                </span>
              )}
              <span className="glider-tab-text">
                <span className="glider-tab-label">{tab.label}</span>
                {tab.desc && !compact && (
                  <span className="glider-tab-desc">{tab.desc}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
