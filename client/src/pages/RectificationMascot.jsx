import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, AlertTriangle, X, ChevronRight, ShieldCheck, Wrench } from 'lucide-react';

const API = '';

export default function RectificationMascot({ token }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [bounce, setBounce] = useState(false);
  const ref = useRef(null);
  const intervalRef = useRef(null);

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

  const total = pending.length;
  const urgent = overdue.length;

  let mood, moodEmoji, moodColor, moodBg;
  if (total === 0) {
    mood = '一切正常';
    moodEmoji = '🛡️';
    moodColor = '#34C759';
    moodBg = 'rgba(52,199,89,0.1)';
  } else if (urgent > 0) {
    mood = `${urgent}项逾期`;
    moodEmoji = '🚨';
    moodColor = '#FF3B30';
    moodBg = 'rgba(255,59,48,0.1)';
  } else if (total <= 3) {
    mood = `${total}项待处理`;
    moodEmoji = '🤔';
    moodColor = '#FF9500';
    moodBg = 'rgba(255,149,0,0.1)';
  } else {
    mood = `${total}项待处理`;
    moodEmoji = '😰';
    moodColor = '#FF3B30';
    moodBg = 'rgba(255,59,48,0.1)';
  }

  const PRIORITY_MAP = { urgent: '紧急', high: '高', medium: '中', low: '低' };
  const PRIORITY_COLOR = { urgent: '#FF3B30', high: '#FF9500', medium: '#007AFF', low: '#8E8E93' };

  const goRectification = () => { navigate('/rectification'); setOpen(false); };

  return (
    <div ref={ref} style={{
      position: 'fixed',
      top: '20px',
      left: '280px',
      zIndex: 1000,
    }}>
      {/* Collapsed badge when closed */}
      {!open && total > 0 && (
        <button onClick={() => setOpen(true)} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#FFFFFF',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(60,60,67,0.12)',
          borderRadius: '22px',
          padding: '6px 14px',
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          animation: bounce ? 'mascotBounce 0.6s ease' : 'none',
          outline: 'none',
          transition: 'all 0.2s ease',
        }}>
          <span style={{
            fontSize: '20px',
            lineHeight: 1,
            animation: 'mascotFloat 2s ease-in-out infinite',
          }}>{moodEmoji}</span>
          <span style={{
            minWidth: '20px',
            height: '20px',
            borderRadius: '10px',
            background: moodColor,
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
          }}>{total}</span>
        </button>
      )}

      {/* Normal mascot button */}
      <button
        onClick={() => setOpen(!open)}
        title={`整改提醒: ${mood}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: open ? '#FFFFFF' : moodBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${open ? 'rgba(60,60,67,0.15)' : moodColor + '20'}`,
          borderRadius: open ? '16px 16px 0 0' : '22px',
          padding: '8px 16px',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: open ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
          animation: bounce && !open ? 'mascotBounce 0.6s ease' : 'none',
          outline: 'none',
        }}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1.04)';
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        <span style={{
          fontSize: '24px',
          lineHeight: 1,
          animation: total > 0 && !open ? 'mascotFloat 2s ease-in-out infinite' : 'none',
        }}>{moodEmoji}</span>

        <div style={{ textAlign: 'left', lineHeight: 1.3 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>整改助手</div>
          <div style={{ fontSize: '13px', color: moodColor, fontWeight: 600 }}>{mood}</div>
        </div>

        {total > 0 && !open && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            background: moodColor,
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            animation: 'badgePulse 2s ease-in-out infinite',
          }}>{total}</span>
        )}
      </button>

      {/* Popover — opens downward */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          width: '380px',
          maxHeight: '450px',
          background: '#FFFFFF',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '0 0 16px 16px',
          border: '1px solid rgba(60,60,67,0.12)',
          borderTop: 'none',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: 'popoverDown 0.2s ease-out',
        }}>
          {/* Content */}
          <div style={{ overflowY: 'auto', maxHeight: '380px', padding: '8px 12px' }}>
            {total === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={40} color="#34C759" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 500 }}>太棒了！所有整改任务已完成</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>保持高标准的等保合规水平</div>
              </div>
            ) : (
              <>
                {/* Overdue header */}
                {overdue.length > 0 && (
                  <div style={{
                    fontSize: '11px', fontWeight: 600, color: '#FF3B30',
                    padding: '6px 4px 4px', display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <AlertTriangle size={12} /> 已逾期 ({overdue.length}项)
                  </div>
                )}
                {/* Overdue items */}
                {overdue.map(r => (
                  <div key={`od-${r.id}`} onClick={goRectification} style={{
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
                        <span style={{
                          padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                          background: `${PRIORITY_COLOR[r.priority]}18`, color: PRIORITY_COLOR[r.priority],
                        }}>{PRIORITY_MAP[r.priority]}</span>
                        {r.responsible_person && <span>👤 {r.responsible_person}</span>}
                        {r.plan_end_date && (
                          <span style={{ color: '#FF3B30', fontWeight: 600 }}>
                            <Clock size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                            {r.plan_end_date}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  </div>
                ))}

                {/* Pending header */}
                {pending.filter(r => {
                  const today = new Date().toISOString().slice(0, 10);
                  return !r.plan_end_date || r.plan_end_date >= today;
                }).length > 0 && (
                  <div style={{
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
                    padding: overdue.length > 0 ? '8px 4px 4px' : '6px 4px 4px',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <Bell size={12} /> 进行中
                  </div>
                )}
                {/* Pending items */}
                {pending.filter(r => {
                  const today = new Date().toISOString().slice(0, 10);
                  return !r.plan_end_date || r.plan_end_date >= today;
                }).map(r => (
                  <div key={`pd-${r.id}`} onClick={goRectification} style={{
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
                        <span style={{
                          padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                          background: `${PRIORITY_COLOR[r.priority]}18`, color: PRIORITY_COLOR[r.priority],
                        }}>{PRIORITY_MAP[r.priority]}</span>
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

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(60,60,67,0.08)',
          }}>
            <button onClick={goRectification} style={{
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
