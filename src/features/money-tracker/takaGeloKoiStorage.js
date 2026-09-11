import { useLiveValue } from '../../utils/liveStore';

export const TGK_KEY = 'aust-takagelokoi-v1';

export const TGK_EMPTY = {
  budget: 0,
  fixed: [], // {id, title, name, amount, note}
  daily: {}, // { 'YYYY-MM-DD': [{id, title, amount, note}] }
};

function uid() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

export function todayKey30(d=new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function getMonthDays(year, month, count=30) {
  const days=[];
  for(let i=1;i<=count;i++) {
    const d=new Date(year, month, i);
    // ensure month overflow handled but we fixed 30 days starting from 1st of current month
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

export function addFixed(doc, {title, name, amount, note}){ const t=(title||name||'').trim(); return {...doc, fixed:[...doc.fixed, {id:uid(), title:t, name:t, amount:Number(amount)||0, note:(note||'').trim()||null}]}; }
export function removeFixed(doc, id){ return {...doc, fixed: doc.fixed.filter(x=>x.id!==id)}; }
export function updateBudget(doc, budget){ return {...doc, budget: Number(budget)||0}; }
export function addDaily(doc, dateKey, {title, amount, note}){ const cur=doc.daily?.[dateKey]||[]; const next={...doc.daily, [dateKey]: [...cur, {id:uid(), title:(title||'').trim(), amount:Number(amount)||0, note:(note||'').trim()||null}]}; return {...doc, daily: next}; }
export function removeDaily(doc, dateKey, id){ const cur=doc.daily?.[dateKey]||[]; const next={...doc.daily, [dateKey]: cur.filter(x=>x.id!==id)}; if(next[dateKey].length===0) delete next[dateKey]; return {...doc, daily: next}; }

export function fmtMoney(n){ const sign=n<0?'−':''; return `${sign}${Math.abs(Math.round(n)).toLocaleString('en-US')}৳`; }
