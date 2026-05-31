import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, AlertTriangle, ChevronRight, ShieldCheck, Wrench, GripHorizontal } from 'lucide-react';

const API = '';

const DEFAULT_POS = { x: 260, y: 16 };

function loadPosition() {
  try {
    const saved = localStorage.getItem('djcp_mascot_pos');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { ...DEFAULT_POS };
}

export default function RectificationMascot({ token }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [bounce, setBounce] = useState(false);
  const ref = useRef(null);
  const intervalRef = useRef(null);

  // Drag state
  const [pos, setPos] = useState(loadPosition);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  // Popover direction: auto-calculated from position
  const [popDir, setPopDir] = useState({ v: 'down', h: 'right' });

  const calcPopDir = useCallback((p) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      v: p.y > vh - 420 ? 'up' : 'down',
      h: p.x > vw - 400 ? 'left' : 'right',
    };
  }, []);

  // Reset position on window resize
  useEffect(() => {
    const onResize = () => {
      setPos(p => {
        const n = {
          x: Math.max(0, Math.min(window.innerWidth - 400, p.x)),
          y: Math.max(0, Math.min(window.innerHeight - 60, p.y)),
        };
        return n;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = async () => {
    try {
      const res = await fetch(API + '/api/rectifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const pendingList = data.filter(r => r.status === 'pending' || r.status === 'in_progress');
      const today = new Date().toISOString().slice(0, 10);
      const overdueList = pendingList.filter(r => r.plan_end_date && r.plan_end_date < today);
      setPending(pendingList);
      setOverdue(overdueList);
    } catch (e) {}
  };

  useEffect(() => {
    if (!token) return;
    load();
    intervalRef.current = setInterval(load, 60000);
    return () => clearInterval(intervalRef.current);
  }, [token]);

  useEffect(() => {
    if (pending.length > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(t);
    }
  }, [pending.length]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Drag handlers
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    setOpen(false);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      setDragging(false);
      setPos(p => {
        localStorage.setItem('djcp_mascot_pos', JSON.stringify(p));
        setPopDir(calcPopDir(p));
        return p;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, calcPopDir]);

  // Calc pop direction on open
  useEffect(() => { if (open) setPopDir(calcPopDir(pos)); }, [open, pos, calcPopDir]);

  const total = pending.length;
  const urgent = overdue.length;

  let mood, moodEmoji, moodColor;
  if (total === 0) {
    mood = '一切正常'; moodEmoji = '🛡️'; moodColor = '#34C759';
  } else if (urgent > 0) {
    mood = `${urgent}项逾期`; moodEmoji = '🚨'; moodColor = '#FF3B30';
  } else if (total <= 3) {
    mood = `${total}项待处理`; moodEmoji = '🤔'; moodColor = '#FF9500';
  } else {
    mood = `${total}项待处理`; moodEmoji = '😰'; moodColor = '#FF3B30';
  }

  const PRIORITY_MAP = { urgent: '紧急', high: '高', medium: '中', low: '低' };
  const PRIORITY_COLOR = { urgent: '#FF3B30', high: '#FF9500', medium: '#007AFF', low: '#8E8E93' };
  const goRect = () => { navigate('/rectification'); setOpen(false); };

  const isUp = popDir.v === 'up';
  const isLeft = popDir.h === 'left';

  // Dynamic border-radius for seamless button→popover connection
  const btnRadius = open
    ? (isUp ? '0 0 14px 14px' : '14px 14px 0 0')
    : '22px';
  const popRadius = isUp ? '14px 14px 0 0' : '0 0 14px 14px';
  const popBorder = isUp ? 'none' : '1px solid rgba(60,60,67,0.12)';
  const popBorderBt = isUp ? '1px solid rgba(60,60,67,0.12)' : 'none';

  return (
    <div ref={ref} style={{
      position: 'fixed',
      top: pos.y,
      left: pos.x,
      zIndex: 1000,
      userSelect: 'none',
    }}>
      {/* Collapsed bubble when there are pending and not open */}
      {!open && total > 0 && (
        <button
          onClick={() => setOpen(true)}
          onMouseDown={onDragStart}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#FFFFFF',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(60,60,67,0.12)',
            borderRadius: '22px', padding: '6px 14px',
            cursor: dragging ? 'grabbing' : 'grab',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            animation: bounce ? 'mascotBounce 0.6s ease' : 'none',
            outline: 'none',
          }}>
          <span style={{ fontSize: '20px', lineHeight: 1, animation: 'mascotFloat 2s ease-in-out infinite' }}>
            {moodEmoji}
          </span>
          <span style={{
            minWidth: '20px', height: '20px', borderRadius: '10px',
            background: moodColor, color: '#fff', fontSize: '12px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
          }}>{total}</span>
          <GripHorizontal size={10} color="var(--text-tertiary)" style={{ marginLeft: '2px', opacity: 0.5 }} />
        </button>
      )}

      {/* Main button */}
      {!(total > 0 && !open) && (
        <button
          onClick={() => setOpen(!open)}
          onMouseDown={onDragStart}
          title={dragging ? '拖动中...' : '整改助手 · 可拖动'}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#FFFFFF',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(60,60,67,0.12)',
            borderRadius: btnRadius,
            padding: '7px 14px',
            cursor: dragging ? 'grabbing' : 'grab',
            boxShadow: open ? '0 2px 12px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.08)',
            outline: 'none',
            animation: bounce && !open ? 'mascotBounce 0.6s ease' : 'none',
          }}
          onMouseEnter={e => {
            if (!dragging) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={e => {
            if (!dragging) e.currentTarget.style.boxShadow = open ? '0 2px 12px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.08)';
          }}
        >
          <span style={{
            fontSize: '22px', lineHeight: 1, pointerEvents: 'none',
            animation: total > 0 ? 'mascotFloat 2s ease-in-out infinite' : 'none',
          }}>{moodEmoji}</span>

          <div style={{ textAlign: 'left', lineHeight: 1.3, pointerEvents: 'none' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>整改助手</div>
            <div style={{ fontSize: '12px', color: moodColor, fontWeight: 600 }}>{mood}</div>
          </div>

          {total > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              minWidth: '18px', height: '18px', borderRadius: '9px',
              background: moodColor, color: '#fff', fontSize: '11px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px', animation: 'badgePulse 2s ease-in-out infinite',
            }}>{total}</span>
          )}

          <GripHorizontal size={10} color="var(--text-tertiary)" style={{ marginLeft: '2px', opacity: 0.5 }} />
        </button>
      )}

      {/* Popover — smart direction */}
      {open && (
        <div style={{
          position: 'absolute',
          ...(isUp
            ? { bottom: '100%', top: 'auto' }
            : { top: '100%', bottom: 'auto' }),
          ...(isLeft
            ? { right: '0', left: 'auto' }
            : { left: '0', right: 'auto' }),
          width: '380px',
          maxHeight: '480px',
          background: '#FFFFFF',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: popRadius,
          border: popBorder,
          borderTop: popBorderBt,
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: isUp ? 'popoverUp 0.2s ease-out' : 'popoverDown 0.2s ease-out',
        }}>
          <div style={{ overflowY: 'auto', maxHeight: '400px', padding: '8px 12px' }}>
            {total === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={40} color="#34C759" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 500 }}>太棒了！所有整改任务已完成</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>保持高标准的等保合规水平</div>
              </div>
            ) : (
              <>
                {overdue.length > 0 && (
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#FF3B30', padding: '6px 4px 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> 已逾期 ({overdue.length}项)
                  </div>
                )}
                {overdue.map(r => (
                  <div key={`od-${r.id}`} onClick={goRect} style={{
                    padding: '10px 12px', margin: '2px 0', borderRadius: '10px',
                    background: 'rgba(255,59,48,0.04)', border: '1px solid rgba(255,59,48,0.1)',
                    display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
                  }}>
                    <AlertTriangle size={16} color="#FF3B30" style={{ marginTop: '1px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '3px' }}>
                        {r.system_name && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginRight: '6px' }}>[{r.system_name}]</span>}
                        {r.title}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: `${PRIORITY_COLOR[r.priority]}18`, color: PRIORITY_COLOR[r.priority] }}>
                          {PRIORITY_MAP[r.priority]}
                        </span>
                        {r.responsible_person && <span>👤 {r.responsible_person}</span>}
                        {r.plan_end_date && <span style={{ color: '#FF3B30', fontWeight: 600 }}><Clock size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />{r.plan_end_date}</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  </div>
                ))}

                {pending.filter(r => { const t = new Date().toISOString().slice(0, 10); return !r.plan_end_date || r.plan_end_date >= t; }).length > 0 && (
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', padding: overdue.length > 0 ? '8px 4px 4px' : '6px 4px 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Bell size={12} /> 进行中
                  </div>
                )}
                {pending.filter(r => { const t = new Date().toISOString().slice(0, 10); return !r.plan_end_date || r.plan_end_date >= t; }).map(r => (
                  <div key={`pd-${r.id}`} onClick={goRect} style={{
                    padding: '10px 12px', margin: '2px 0', borderRadius: '10px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Bell size={16} color={PRIORITY_COLOR[r.priority]} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '3px' }}>
                        {r.system_name && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginRight: '6px' }}>[{r.system_name}]</span>}
                        {r.title}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: `${PRIORITY_COLOR[r.priority]}18`, color: PRIORITY_COLOR[r.priority] }}>
                          {PRIORITY_MAP[r.priority]}
                        </span>
                        {r.responsible_person && <span>👤 {r.responsible_person}</span>}
                        {r.plan_end_date && <span>📅 {r.plan_end_date}</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(60,60,67,0.08)' }}>
            <button onClick={goRect} style={{
              border: 'none', background: '#007AFF', color: '#fff',
              padding: '8px 0', borderRadius: '10px', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer', width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <Wrench size={14} />
              前往整改管理 {total > 0 ? `· ${total} 项待处理` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
