import React, { useMemo, useState } from 'react';
import { Video, Play } from 'lucide-react';
import { playlists } from '../../data/mockData';

export default function PlaylistPlayer({ vaultContext }) {
  const { course, courseName } = vaultContext;

  const coursePlaylists = useMemo(
    () => playlists.filter((playlist) => !playlist.course || playlist.course === course),
    [course],
  );

  const [selectedPlaylist, setSelectedPlaylist] = useState(coursePlaylists[0] || null);

  React.useEffect(() => {
    setSelectedPlaylist(coursePlaylists[0] || null);
  }, [coursePlaylists]);

  return (
    <div className="glass-card-static schedule-widget playlists-container animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Video size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Vault</span>
            <div className="schedule-title">YouTube Playlists</div>
            <span className="schedule-subtitle">
              {courseName} — curated lecture videos and references
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions" />
      </div>

      <div className="schedule-dotted-divider" />

      {coursePlaylists.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
          <Video size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            No playlists linked for {courseName} yet.
          </p>
        </div>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {coursePlaylists.map((pl) => {
              const isSelected = selectedPlaylist?.id === pl.id;

              return (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl)}
                  style={{
                    background: isSelected ? 'var(--accent-blue-glow)' : 'var(--bg-input)',
                    border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'all var(--transition-base)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '24px',
                      background: 'var(--bg-secondary)',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pl.thumbnail}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="badge badge-blue" style={{ fontSize: '9px', marginBottom: '4px' }}>
                      {pl.course}
                    </span>
                    <h4
                      style={{
                        fontSize: '13px',
                        fontWeight: 'var(--fw-bold)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {pl.title}
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {pl.channel} • {pl.videos} clips
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="glass-card-static"
            style={{
              background: '#000',
              borderRadius: 'var(--radius-xl)',
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {selectedPlaylist ? (
              <div style={{ textAlign: 'center', color: '#fff', zIndex: 2, padding: '24px' }}>
                <Video size={64} style={{ color: 'var(--accent-blue)', margin: '0 auto 16px auto', display: 'block' }} />
                <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold' }}>{selectedPlaylist.title}</h3>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Curated content by {selectedPlaylist.channel}
                </p>

                <button
                  className="btn btn-primary mt-6"
                  onClick={() => alert(`Launching YouTube video embed playlist: ${selectedPlaylist.title}`)}
                  style={{ borderRadius: 'var(--radius-full)' }}
                >
                  <Play size={16} fill="currentColor" /> Play Playlist
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <Video size={48} />
                <p>Select a playlist from the left panel</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
