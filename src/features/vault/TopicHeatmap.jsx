import React from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { topicFrequency } from '../../data/mockData';

export default function TopicHeatmap({ vaultContext }) {
  const { course, courseName } = vaultContext;
  const currentData = topicFrequency[course] || null;

  const getHeatColor = (freq) => {
    switch (freq) {
      case 3: return 'var(--accent-rose)';
      case 2: return 'var(--accent-orange)';
      case 1: return 'var(--accent-blue)';
      default: return 'transparent';
    }
  };

  const getHeatOpacity = (freq) => {
    switch (freq) {
      case 3: return 0.9;
      case 2: return 0.75;
      case 1: return 0.5;
      default: return 0.05;
    }
  };

  // Compute 'hot topics' (topics with high frequency counts)
  const hotTopics = React.useMemo(() => {
    if (!currentData || !currentData.topics || !currentData.data) return [];
    const list = currentData.topics.map((t, idx) => {
      const freqSum = currentData.data[idx] ? currentData.data[idx].reduce((a, b) => a + b, 0) : 0;
      return { topic: t, totalFreq: freqSum };
    });
    // Sort descending
    list.sort((a, b) => b.totalFreq - a.totalFreq);
    return list.slice(0, 3);
  }, [course, currentData]);

  return (
    <div className="glass-card-static schedule-widget topic-heatmap-container animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <TrendingUp size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Vault</span>
            <div className="schedule-title">Topic Analysis</div>
            <span className="schedule-subtitle">
              {courseName} — exam topic frequency over the years
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" />

      {!currentData ? (
        <div className="glass-card-static" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>No topic analysis available for {courseName} yet.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          
          {/* Heatmap Grid */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Header row: Years */}
              <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(5, 1fr)', gap: '6px', marginBottom: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                <div>Core Topics</div>
                {currentData.years && currentData.years.map(yr => (
                  <div key={yr}>{yr}</div>
                ))}
              </div>

              {/* Matrix rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {currentData.topics && currentData.topics.map((topic, topicIdx) => (
                  <div key={topic} style={{ display: 'grid', gridTemplateColumns: '150px repeat(5, 1fr)', gap: '6px', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {topic}
                    </div>
                    
                    {currentData.data[topicIdx] && currentData.data[topicIdx].map((freq, yrIdx) => (
                      <div 
                        key={yrIdx}
                        className="heatmap-cell tooltip-wrapper"
                        style={{
                          backgroundColor: getHeatColor(freq) || 'var(--bg-input)',
                          opacity: getHeatOpacity(freq),
                          height: '28px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: freq > 0 ? '#fff' : 'var(--text-tertiary)'
                        }}
                      >
                        {freq > 0 ? `${freq}x` : '0'}
                        <div className="tooltip">
                          {topic} in {currentData.years[yrIdx]}: {freq} exam question occurrences
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hot Topics Summary list */}
          <div className="glass-card-static" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-primary)', height: 'fit-content' }}>
            <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--accent-rose)' }} /> High Yield Topics
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hotTopics.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ maxWidth: '75%' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Rank #{idx+1}</span>
                    <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.topic}</p>
                  </div>
                  <span className="badge badge-rose" style={{ fontSize: '10px', padding: '3px 8px' }}>{item.totalFreq} Hits</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
