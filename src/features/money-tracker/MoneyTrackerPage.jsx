import { useState, useMemo, useEffect, useCallback } from 'react';
import { DollarSign, MoreVertical, Plus, Trash2, Home, Wifi, Wallet, CalendarDays, Calendar, CalendarRange, ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, X, PencilLine } from 'lucide-react';
import './MoneyTrackerPage.css';
import '../aust-bhara/AustBharaPage.css';
import { useTakaGeloKoi, sumFixed, sumDaily, remaining, dailyLimit, dailySpent, getMonthDays, todayKey30, fmtMoney, addFixed, removeFixed, updateBudget, addDaily, removeDaily } from './takaGeloKoiStorage';

function fmtDateShort(d){ return d.toLocaleDateString('en-GB',{day:'2-digit', month:'short'}); }

export default function MoneyTrackerPage() {
  const [doc, update]=useTakaGeloKoi();

  // Semester View er moto Daily/Weekly/Monthly view — localStorage + URL param
  const [viewMode, setViewMode]=useState(()=>{
    try{
      const v=new URLSearchParams(window.location.search).get('tgkView');
      if(v && ['daily','weekly','monthly'].includes(v)) return v;
      const s=localStorage.getItem('aust-tgk-view');
      if(s && ['daily','weekly','monthly'].includes(s)) return s;
    }catch{}
    return 'monthly';
  });
  useEffect(()=>{
    try{ localStorage.setItem('aust-tgk-view', viewMode); }catch{}
    try{
      const url=new URL(window.location.href);
      url.searchParams.set('tgkView', viewMode);
      window.history.replaceState({},'',url);
    }catch{}
  },[viewMode]);

  const [calDate, setCalDate]=useState(()=> new Date());
  const getWeekDates=useCallback((ref)=>{
    const s=new Date(ref); s.setDate(ref.getDate() - ((ref.getDay()-5+7)%7));
    return Array.from({length:7},(_,i)=>{ const d=new Date(s); d.setDate(s.getDate()+i); return d; });
  },[]);
  const weekDates=useMemo(()=> getWeekDates(calDate),[calDate,getWeekDates]);
  const monthGrid=useMemo(()=>{
    const y=calDate.getFullYear(), m=calDate.getMonth();
    const first=new Date(y,m,1), last=new Date(y,m+1,0);
    const pad=(first.getDay()-5+7)%7;
    const arr=[]; for(let i=0;i<pad;i++) arr.push(null);
    for(let d=1; d<=last.getDate(); d++) arr.push(new Date(y,m,d));
    // also add 30-day fixed fallback if needed, but use monthGrid for semester-like view
    return arr;
  },[calDate]);
  // For 30-day fixed calendar (used in monthly), keep old 30 days from month start
  const year=calDate.getFullYear(), month=calDate.getMonth();
  const days=useMemo(()=> getMonthDays(year,month,30),[year,month]);

  const now=new Date();
  const totalFixed=sumFixed(doc);
  const totalDaily=sumDaily(doc);
  const rem=remaining(doc);
  const baseDaily=dailyLimit(doc,30);
  // dynamic daily limit for remaining days (today onward)
  const todayIdx=now.getDate()-1; // 0-based
  const daysLeft=Math.max(1,30 - todayIdx);
  const dynamicDaily=Math.max(0, Math.floor(rem / daysLeft));

  const [budgetInput,setBudgetInput]=useState(String(doc.budget||''));
  const [fixedName,setFixedName]=useState('');
  const [fixedAmt,setFixedAmt]=useState('');
  const [fixedNote,setFixedNote]=useState('');
  const [dayModal,setDayModal]=useState(null); // dateKey
  const [dayTitle,setDayTitle]=useState('');
  const [dayAmt,setDayAmt]=useState('');
  const [dayNote,setDayNote]=useState('');

  const handleBudgetSave=()=>{
    const v=Number(budgetInput)||0;
    update(d=> updateBudget(d,v));
  };

  const handleAddFixed=()=>{
    if(!fixedName.trim()||!fixedAmt) return;
    update(d=> addFixed(d,{title:fixedName, amount: fixedAmt, note: fixedNote}));
    setFixedName(''); setFixedAmt(''); setFixedNote('');
  };

  const openDay=(key)=>{
    setDayModal(key);
    setDayTitle('');
    setDayAmt('');
    setDayNote('');
  };

  const handleAddDay=()=>{
    if(!dayModal||!dayTitle.trim()||!dayAmt) return;
    update(d=> addDaily(d,dayModal,{title: dayTitle, amount: dayAmt, note: dayNote}));
    setDayModal(null);
  };

  const isOverBudget=rem<0;
  const exceedDaily = (spent, limit)=> spent>limit;

  return (
    <div className="glass-card-static schedule-widget mt-widget animate-fadeInUp">
      {/* Masthead */}
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <DollarSign size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Daily Life</span>
            <p className="schedule-title">TakaGeloKoi</p>
            <span className="schedule-subtitle">Monthly budget & daily spending</span>
          </div>
        </div>
        <div className="schedule-actions">
          <span className={`tgk-badge ${isOverBudget?'tgk-badge-rose':'tgk-badge-amber'}`} style={{fontSize:11, padding:'6px 10px'}}>
            {fmtMoney(rem)} remaining
          </span>
        </div>
      </div>
      <div className="schedule-dotted-divider" />

      {/* Budget */}
      <div className="lp-panel tgk-panel">
        <h4 className="lp-panel-title"><Wallet size={14}/> Monthly Budget</h4>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <input className="input" type="number" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} placeholder="e.g., 20000" style={{flex:'1 1 140px', height:36}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleBudgetSave} style={{height:36}}>Save</button>
          <span style={{fontSize:12, color:'var(--text-tertiary)'}}>Budget: <strong style={{color:'var(--text-primary)'}}>{fmtMoney(doc.budget||0)}</strong></span>
        </div>
      </div>

      {/* Fixed expenses — Title + Amount ek row, Note niche row */}
      <div className="lp-panel tgk-panel">
        <h4 className="lp-panel-title"><Home size={14}/> Fixed Expenses <span style={{fontWeight:400, color:'var(--text-tertiary)', fontSize:11}}>(Title + Amount ek row, Note niche — optional)</span></h4>
        <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
          <input className="input" value={fixedName} onChange={e=>setFixedName(e.target.value)} placeholder="Title e.g., Home Rent" style={{flex:1, height:36}} />
          <input className="input" type="number" value={fixedAmt} onChange={e=>setFixedAmt(e.target.value)} placeholder="Amount" style={{flex:1, height:36}} />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAddFixed} style={{height:36}}><Plus size={14}/> Add</button>
        </div>
        <div style={{marginBottom:10}}>
          <input className="input" value={fixedNote} onChange={e=>setFixedNote(e.target.value)} placeholder="Note (optional)" style={{width:'100%', height:36}} />
        </div>
        {doc.fixed.length===0 ? (
          <p style={{fontSize:12, color:'var(--text-tertiary)'}}>No fixed expenses yet — add Title, Amount, Note optional (e.g., Home Rent / 8000 / 2-bed)</p>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {doc.fixed.map(f=>(
              <div key={f.id} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg-tertiary)', border:'1px solid var(--border-primary)', borderRadius:10}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.title||f.name}</div>
                  {f.note && <div style={{fontSize:11, color:'var(--text-tertiary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.note}</div>}
                </div>
                <span className="lp-badge lp-badge-rose">{fmtMoney(f.amount)}</span>
                <button type="button" className="lp-icon-btn" onClick={()=> update(d=> removeFixed(d,f.id))} aria-label="Remove"><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="lp-panel tgk-panel">
        <h4 className="lp-panel-title"><TrendingUp size={14}/> Summary</h4>
        <div className="lp-stats" style={{marginBottom:0}}>
          <div className="lp-stat"><div className="lp-stat-icon"><Wallet size={16}/></div><div><div className="lp-stat-value">{fmtMoney(doc.budget||0)}</div><div className="lp-stat-label">Budget</div></div></div>
          <div className="lp-stat"><div className="lp-stat-icon rose"><Home size={16}/></div><div><div className="lp-stat-value">{fmtMoney(totalFixed)}</div><div className="lp-stat-label">Fixed</div></div></div>
          <div className="lp-stat"><div className="lp-stat-icon cyan"><CalendarDays size={16}/></div><div><div className="lp-stat-value">{fmtMoney(rem)}</div><div className="lp-stat-label">Remaining</div></div></div>
          <div className="lp-stat"><div className="lp-stat-icon green"><DollarSign size={16}/></div><div><div className="lp-stat-value">{fmtMoney(baseDaily)}/day</div><div className="lp-stat-label">Daily limit (30d)</div></div></div>
        </div>
        <div style={{marginTop:10, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <span className={`lp-badge ${isOverBudget?'lp-badge-rose':'lp-badge-cyan'}`}><TrendingUp size={10}/> Dynamic daily (remaining/{daysLeft}d): {fmtMoney(dynamicDaily)}</span>
          {isOverBudget && <span className="lp-badge lp-badge-rose"><AlertTriangle size={10}/> Over budget!</span>}
          {totalDaily>0 && <span style={{fontSize:11, color:'var(--text-tertiary)'}}>Daily spent total: {fmtMoney(totalDaily)}</span>}
        </div>
      </div>

      {/* Calendar — Semester View er moto Daily / Weekly / Monthly */}
      <div className="lp-panel tgk-panel">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:12}}>
          <h4 className="lp-panel-title" style={{margin:0}}><CalendarDays size={14}/> Calendar — click box to add/remove</h4>
          <div style={{display:'flex', gap:6}}>
            <button type="button" className={`lp-badge ${viewMode==='daily'?'lp-badge-amber':'lp-badge-muted'}`} style={{cursor:'pointer'}} onClick={()=> setViewMode('daily')}><Calendar size={12}/> Daily</button>
            <button type="button" className={`lp-badge ${viewMode==='weekly'?'lp-badge-amber':'lp-badge-muted'}`} style={{cursor:'pointer'}} onClick={()=> setViewMode('weekly')}><CalendarRange size={12}/> Weekly</button>
            <button type="button" className={`lp-badge ${viewMode==='monthly'?'lp-badge-amber':'lp-badge-muted'}`} style={{cursor:'pointer'}} onClick={()=> setViewMode('monthly')}><CalendarDays size={12}/> Monthly</button>
          </div>
        </div>
        <div className="schedule-week-nav" style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:12}}>
          <button type="button" className="schedule-nav-btn" onClick={()=>{ const d=new Date(calDate); if(viewMode==='daily') d.setDate(d.getDate()-1); else if(viewMode==='weekly') d.setDate(d.getDate()-7); else d.setMonth(d.getMonth()-1); setCalDate(d); }}><ChevronLeft size={16}/></button>
          <span className="schedule-week-pill" style={{minWidth:160, textAlign:'center', padding:'6px 14px', background:'var(--accent-amber-glow)', border:'1px solid color-mix(in srgb, var(--accent-amber) 20%, transparent)', borderRadius:999, fontSize:12, fontWeight:700, color:'var(--accent-amber)'}}>
            {viewMode==='daily' ? calDate.toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'short', year:'numeric'}) : viewMode==='weekly' ? `${fmtDateShort(weekDates[0])} – ${fmtDateShort(weekDates[6])}` : calDate.toLocaleDateString('en-GB',{month:'long', year:'numeric'})}
          </span>
          <button type="button" className="schedule-nav-btn" onClick={()=>{ const d=new Date(calDate); if(viewMode==='daily') d.setDate(d.getDate()+1); else if(viewMode==='weekly') d.setDate(d.getDate()+7); else d.setMonth(d.getMonth()+1); setCalDate(d); }}><ChevronRight size={16}/></button>
        </div>
        {viewMode==='daily' ? (
          <div style={{display:'flex', width:'100%'}}>
            {(() => {
              const d=calDate; const key=todayKey30(d); const spent=dailySpent(doc,key); const limitForDay= isOverBudget ? dynamicDaily : baseDaily; const isExceed= exceedDaily(spent, limitForDay);
              return (
                <button type="button" className={`tgk-day ${todayKey30(new Date())===key?'tgk-day-today':''} ${isExceed?'tgk-day-exceed':''}`} onClick={()=> openDay(key)} style={{width:'100%', minHeight:140, padding:'16px'}}>
                  <span className="tgk-day-num">{String(d.getDate()).padStart(2,'0')}</span>
                  <span className="tgk-day-date">{d.toLocaleDateString('en-GB',{weekday:'long', month:'long', year:'numeric'})}</span>
                  <span className="tgk-day-limit">{fmtMoney(limitForDay)} limit</span>
                  <span className={`tgk-day-spent ${isExceed?'exceed':''}`}>{spent? fmtMoney(spent): '— No expense'}</span>
                  {spent>0 && <span className="tgk-day-bar"><i style={{width: `${Math.min(100, Math.round((spent/Math.max(1,limitForDay))*100))}%`, background: isExceed?'var(--accent-rose)':'var(--accent-emerald)'}} /></span>}
                  <span className="tgk-day-add"><Plus size={10}/> Add expense</span>
                </button>
              );
            })()}
          </div>
        ) : viewMode==='weekly' ? (
          <div className="tgk-cal" style={{gridTemplateColumns:'repeat(7, 1fr)'}}>
            {weekDates.map((d)=>{
              const key=todayKey30(d); const spent=dailySpent(doc,key); const isToday= todayKey30(new Date())===key; const limitForDay= isOverBudget ? dynamicDaily : baseDaily; const isExceed= exceedDaily(spent, limitForDay);
              return (
                <button key={key} type="button" className={`tgk-day ${isToday?'tgk-day-today':''} ${isExceed?'tgk-day-exceed':''}`} onClick={()=> openDay(key)}>
                  <span className="tgk-day-num">{String(d.getDate()).padStart(2,'0')}</span>
                  <span className="tgk-day-date">{d.toLocaleDateString('en-GB',{weekday:'short'})} • {fmtDateShort(d)}</span>
                  <span className="tgk-day-limit">{fmtMoney(limitForDay)}</span>
                  <span className={`tgk-day-spent ${isExceed?'exceed':''}`}>{spent? fmtMoney(spent): '—'}</span>
                  {spent>0 && <span className="tgk-day-bar"><i style={{width: `${Math.min(100, Math.round((spent/Math.max(1,limitForDay))*100))}%`, background: isExceed?'var(--accent-rose)':'var(--accent-emerald)'}} /></span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="tgk-cal">
            {monthGrid.map((d,idx)=>{
              if(!d) return <div key={`pad-${idx}`} />;
              const key=todayKey30(d); const spent=dailySpent(doc,key); const isToday= todayKey30(new Date())===key; const limitForDay= isOverBudget ? dynamicDaily : baseDaily; const isExceed= exceedDaily(spent, limitForDay);
              return (
                <button key={key} type="button" className={`tgk-day ${isToday?'tgk-day-today':''} ${isExceed?'tgk-day-exceed':''}`} onClick={()=> openDay(key)} style={{minHeight:86}}>
                  <span className="tgk-day-num">{String(d.getDate()).padStart(2,'0')}</span>
                  <span className="tgk-day-date">{fmtDateShort(d)}</span>
                  <span className="tgk-day-limit">{fmtMoney(limitForDay)}</span>
                  <span className={`tgk-day-spent ${isExceed?'exceed':''}`}>{spent? fmtMoney(spent): '—'}</span>
                </button>
              );
            })}
          </div>
        )}
        <p style={{fontSize:11, color:'var(--text-tertiary)', marginTop:8}}>Semester View er moto Daily / Weekly / Monthly switch — Weekly te Fri–Thu (semester week), Monthly te pura mash er grid. Box e click kore expense add/remove, exceed hole daily limit dynamically kombe.</p>
      </div>

      {/* Day modal */}
      {dayModal && (
        <div className="bhara-details-overlay" onClick={()=> setDayModal(null)}>
          <div className="bhara-details-panel" onClick={e=>e.stopPropagation()} style={{maxWidth:380}}>
            <div className="bhara-details-head">
              <span className="bhara-details-title"><PencilLine size={13}/> {dayModal} — Daily Expense</span>
              <button type="button" className="bhara-details-close" onClick={()=> setDayModal(null)}><X size={12}/></button>
            </div>
            <p className="bhara-details-hint">Title, Amount, Note (optional) — e.g., Lunch / 120৳ / canteen (optional)</p>
            <div style={{display:'flex', gap:8, marginBottom:8}}>
              <input className="input" value={dayTitle} onChange={e=>setDayTitle(e.target.value)} placeholder="Title e.g., Lunch" style={{flex:1, height:36}} autoFocus />
              <input className="input" type="number" value={dayAmt} onChange={e=>setDayAmt(e.target.value)} placeholder="Amount" style={{flex:1, height:36}} />
            </div>
            <div style={{marginBottom:8}}>
              <input className="input" value={dayNote} onChange={e=>setDayNote(e.target.value)} placeholder="Note (optional)" style={{width:'100%', height:36}} />
            </div>
            <div style={{display:'flex', gap:8}}>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddDay} style={{flex:1}} disabled={!dayTitle.trim()||!dayAmt}>Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=> setDayModal(null)} style={{flex:1}}>Close</button>
            </div>
            {(doc.daily[dayModal]||[]).length>0 && (
              <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:6}}>
                <span style={{fontSize:11, fontWeight:700, color:'var(--text-tertiary)'}}>This day expenses:</span>
                {(doc.daily[dayModal]||[]).map(e=>(
                  <div key={e.id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 8px', background:'var(--bg-tertiary)', borderRadius:8, border:'1px solid var(--border-primary)'}}>
                    <span style={{flex:1, fontSize:12, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                      <strong>{e.title || e.note || 'Expense'}</strong> — {fmtMoney(e.amount)} {e.note && (e.title ? (e.note!==e.title ? <span style={{color:'var(--text-tertiary)'}}>• {e.note}</span> : null) : null)}
                    </span>
                    <button type="button" className="lp-icon-btn" onClick={()=> update(d=> removeDaily(d,dayModal,e.id))}><Trash2 size={12}/></button>
                  </div>
                ))}
                <div style={{fontSize:11, color:'var(--text-tertiary)'}}>Spent: {fmtMoney(dailySpent(doc,dayModal))} / Limit: {fmtMoney(baseDaily)} {exceedDaily(dailySpent(doc,dayModal), baseDaily) && <span style={{color:'var(--accent-rose)'}}>(exceed — daily limit dynamically kombe)</span>}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
