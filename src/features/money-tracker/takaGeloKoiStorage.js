import { useLiveValue } from '../../utils/liveStore';

export const TGK_KEY = 'aust-takagelokoi-v1';

export const TGK_EMPTY = {
  budget: 0,
  fixed: [], // {id, title, name, amount, note}
  daily: {}, // { 'YYYY-MM-DD': [{id, title, amount, note}] }
};

/* ── Expense categories (shared by fixed + daily entries) ── */
export const TGK_CATEGORIES = [
  { id: 'food',      label: 'Food',         color: 'var(--accent-amber)' },
  { id: 'transport', label: 'Transport',    color: 'var(--accent-cyan)' },
  { id: 'bills',     label: 'Rent & Bills', color: 'var(--accent-rose)' },
  { id: 'shopping',  label: 'Shopping',     color: 'var(--accent-purple)' },
  { id: 'study',     label: 'Study',        color: 'var(--accent-emerald)' },
  { id: 'other',     label: 'Other',        color: 'var(--text-tertiary)' },
];

const CAT_IDS = new Set(TGK_CATEGORIES.map(c => c.id));
export function normCat(id) { return CAT_IDS.has(id) ? id : 'other'; }
export function catMeta(id) { return TGK_CATEGORIES.find(c => c.id === normCat(id)) || TGK_CATEGORIES[TGK_CATEGORIES.length - 1]; }

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

export function todayKey30(d=new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function getMonthDays(year, month, count=30) {
  const days=[];
  for(let i=1;i<=count;i++) {
    // Use current month's 1st as base
    const base=new Date(year, month, 1);
    const cur=new Date(base);
    cur.setDate(i);
    days.push(cur);
  }
  return days;
}

export function useTakaGeloKoi() {
  const [raw, setRaw]=useLiveValue('user', TGK_KEY, null);
  const doc = raw && typeof raw==='object' ? { ...TGK_EMPTY, ...raw, daily: raw.daily||{} } : { ...TGK_EMPTY, daily:{} };
  const update=(fn)=> setRaw(prev=>{
    const base = prev && typeof prev==='object' ? { ...TGK_EMPTY, ...prev, daily: prev.daily||{} } : { ...TGK_EMPTY, daily:{} };
    const next = typeof fn==='function'? fn(base): {...base, ...fn};
    return next;
  });
  return [doc, update];
}

export function sumFixed(doc){ return (doc.fixed||[]).reduce((s,e)=> s+(Number(e.amount)||0),0); }
export function sumDaily(doc){
  let s=0;
  for(const arr of Object.values(doc.daily||{})) for(const e of arr) s+= Number(e.amount)||0;
  return s;
}
export function remaining(doc){ return (Number(doc.budget)||0) - sumFixed(doc) - sumDaily(doc); }
export function dailyLimit(doc, days=30){
  const rem=remaining(doc);
  if(days<=0) return 0;
  return Math.floor(rem/days);
}
export function dailySpent(doc, key){ const arr=doc.daily?.[key]||[]; return arr.reduce((s,e)=>s+(Number(e.amount)||0),0); }

export function addFixed(doc, {title, name, amount, note, cat}){ const t=(title||name||'').trim(); return {...doc, fixed:[...doc.fixed, {id:uid(), title:t, name:t, amount:Number(amount)||0, note:(note||'').trim()||null, cat:normCat(cat)}]}; }
export function removeFixed(doc, id){ return {...doc, fixed: doc.fixed.filter(x=>x.id!==id)}; }
export function updateBudget(doc, budget){ return {...doc, budget: Number(budget)||0}; }
export function addDaily(doc, dateKey, {title, amount, note, cat}){ const cur=doc.daily?.[dateKey]||[]; const next={...doc.daily, [dateKey]: [...cur, {id:uid(), title:(title||'').trim(), amount:Number(amount)||0, note:(note||'').trim()||null, cat:normCat(cat)}]}; return {...doc, daily: next}; }
export function removeDaily(doc, dateKey, id){ const cur=doc.daily?.[dateKey]||[]; const next={...doc.daily, [dateKey]: cur.filter(x=>x.id!==id)}; if(next[dateKey].length===0) delete next[dateKey]; return {...doc, daily: next}; }

/* ── Category totals (fixed + daily) with share % ── */
export function catTotals(doc){
  const map=new Map();
  const bump=(id, amt)=>{
    const key=normCat(id);
    map.set(key, (map.get(key)||0) + (Number(amt)||0));
  };
  for(const e of doc.fixed||[]) bump(e.cat, e.amount);
  for(const arr of Object.values(doc.daily||{})) for(const e of arr) bump(e.cat, e.amount);
  let total=0;
  for(const v of map.values()) total+=v;
  return TGK_CATEGORIES
    .map(c=>({ ...c, total: map.get(c.id)||0, pct: total>0 ? Math.round(((map.get(c.id)||0)/total)*100) : 0 }))
    .filter(c=>c.total>0)
    .sort((a,b)=>b.total-a.total);
}

/* ── Most recent daily entries, newest first ── */
export function recentDaily(doc, limit=6){
  const out=[];
  for(const [dateKey, arr] of Object.entries(doc.daily||{})){
    for(const e of arr) out.push({ ...e, dateKey });
  }
  out.sort((a,b)=> a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0);
  return out.slice(0, limit);
}

export function fmtMoney(n){ const sign=n<0?'−':''; return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}৳`; }
