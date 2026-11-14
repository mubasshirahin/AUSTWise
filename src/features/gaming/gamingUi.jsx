import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Gamepad2, Crosshair, Target, Flame, Swords, Trophy, Crown, Pickaxe, Rocket, Dice5, MoreVertical, X,
} from 'lucide-react';

const GAME_ICONS = {
  gamepad: Gamepad2, crosshair: Crosshair, target: Target, flame: Flame, swords: Swords,
  trophy: Trophy, crown: Crown, pickaxe: Pickaxe, rocket: Rocket, dice: Dice5,
};

export function GameIcon({ iconKey, size = 16, ...rest }) {
  const Icon = GAME_ICONS[iconKey] || Gamepad2;
  return <Icon size={size} {...rest} />;
}

/** Masthead (skill-style §2) with optional ⋮ menu items. */
export function GzMasthead({ icon: Icon = Gamepad2, iconKey, overline, title, subtitle, stats = [], menu = [] }) {
  return (
    <header className={`dl-head gmz-head${menu.length ? ' has-actions' : ''}`}>
      <div className="dl-head-title">
        <div className="dl-head-tile" aria-hidden="true">
          {iconKey ? <GameIcon iconKey={iconKey} size={20} strokeWidth={2.1} /> : <Icon size={20} strokeWidth={2.1} />}
        </div>
        <div className="dl-head-text">
          <span className="dl-head-overline">{overline}</span>
          <h2 className="dl-head-name">{title}</h2>
          {subtitle && <span className="dl-head-subtitle">{subtitle}</span>}
        </div>
      </div>
      {stats.length > 0 && (
        <dl className="dl-head-stats">
          {stats.map((stat) => (
            <div key={stat.label} className={`dl-head-stat${stat.alert ? ' is-alert' : ''}`}>
              <dt>{stat.label}</dt>
              <dd className={stat.small ? 'is-small' : undefined}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {menu.length > 0 && (
        <div className="dl-head-actions">
          <GzMenu items={menu} />
        </div>
      )}
    </header>
  );
}

export function GzMenu({ items, label = 'Options' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="lp-menu gmz-menu" ref={ref}>
      <button type="button" className="gmz-menu-btn" aria-label={label} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="lp-menu-list gmz-menu-list" role="menu">
          {items.map((item) => (item.separator ? <div key={item.key} className="gmz-menu-sep" /> : (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`gmz-menu-item${item.danger ? ' is-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect(); }}
            >
              {item.icon && <item.icon size={14} />} {item.label}
            </button>
          )))}
        </div>
      )}
    </div>
  );
}

/** Segmented switcher; one sideways-scrolling row on phones (§4). */
export function GzPills({ items, value, onChange, label }) {
  return (
    <div className="gmz-pills" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`gmz-pill${value === item.id ? ' is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <item.icon size={12} />} {item.label}
          {item.count != null && <span className="gmz-pill-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function GzEmpty({ icon: Icon, hint, actionLabel, actionIcon: ActionIcon, onAction }) {
  return (
    <div className="gmz-empty">
      <span className="gmz-empty-icon"><Icon size={16} /></span>
      <p className="gmz-empty-hint">{hint}</p>
      {actionLabel && onAction && (
        <button type="button" className="gmz-empty-action" onClick={onAction}>
          {ActionIcon && <ActionIcon size={13} />} {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Day-modal style overlay, portalled to <body> (§7). */
export function GzModal({ title, icon: Icon, onClose, children, summary, wide = false }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay gmz-overlay" onClick={onClose}>
      <div className={`modal gmz-modal${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="gmz-modal-head">
          <span className="gmz-modal-title">{Icon && <Icon size={13} />} {title}</span>
          <button type="button" className="gmz-modal-close" aria-label="Close" onClick={onClose}><X size={12} /></button>
        </div>
        {summary && <div className="gmz-modal-summary">{summary}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Badge({ tone = 'muted', children, title }) {
  return <span className={`lp-badge lp-badge-${tone} gmz-badge`} title={title}>{children}</span>;
}

/** size: 'sm' (22px) | 'md' (28px) | 'lg' (36px) — sized in CSS. */
export function Avatar({ user, size = 'md' }) {
  const name = user?.name || '?';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <span className={`gmz-avatar is-${size}`} aria-hidden="true">
      {user?.avatar ? <img src={user.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initials}
    </span>
  );
}

export const TIER_LABEL = { gaming_mod: 'Gaming Mod', staff: 'Staff', faculty: 'Faculty' };

export function UserLine({ user, extra }) {
  if (!user) return <span className="gmz-user-name">Unknown player</span>;
  return (
    <span className="gmz-user-line">
      <span className="gmz-user-name">{user.name}</span>
      {TIER_LABEL[user.tier] && <span className="gmz-user-tier">{TIER_LABEL[user.tier]}</span>}
      {extra}
    </span>
  );
}

/** One-line status message under a toolbar or form. */
export function useFlash() {
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);
  const show = useCallback((text, tone = 'error') => {
    clearTimeout(timer.current);
    setFlash(text ? { text, tone } : null);
    if (text) timer.current = setTimeout(() => setFlash(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = flash ? <p className={`gmz-flash is-${flash.tone}`} role={flash.tone === 'error' ? 'alert' : 'status'}>{flash.text}</p> : null;
  return [node, show];
}

export function statusBadge(room) {
  if (room.status === 'in_game') return <Badge tone="amber">In game</Badge>;
  if (room.status === 'full') return <Badge tone="rose">Full</Badge>;
  if (room.status === 'closed') return <Badge>Closed</Badge>;
  return <Badge tone="emerald">Open</Badge>;
}

export function rankRange(room) {
  if (room.rankMin && room.rankMax) return room.rankMin === room.rankMax ? room.rankMin : `${room.rankMin} – ${room.rankMax}`;
  if (room.rankMin) return `${room.rankMin}+`;
  if (room.rankMax) return `Up to ${room.rankMax}`;
  return 'Any rank';
}
