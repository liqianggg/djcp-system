import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, AlertTriangle, X, ChevronRight, ShieldCheck } from 'lucide-react';

const API = '';

export default function RectificationMascot({ token }) {
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
    } catch (e) {
      // silent fail
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
    intervalRef.current = setInterval(load, 60000); // refresh every minute
    return () => clearInterval(intervalRef.current);
  }, [token]);

  // Bounce animation when count changes
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

  // Mascot state
  let mood, moodEmoji, moodColor, moodBg;
  if (total === 0) {
    mood = '一切正常';
    moodEmoji = '😊';
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Mascot Button */}
      <button
        onClick={() => setOpen(!open)}
        title={`整改提醒: ${mood}`}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: moodBg,
          border: `1px solid ${moodColor}20`,
          borderRadius: '20px',
          padding: '6px 14px 6px 8px',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: bounce ? 'mascotBounce 0.6s ease' : 'none',
          outline: 'none',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = `0 2px 12px ${moodColor}30`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Animated mascot emoji */}
        <span style={{
          fontSize: '24px',
          lineHeight: 1,
          animation: total > 0 ? 'mascotFloat 2s ease-in-out infinite' : 'none',
          filter: total === 0 ? 'grayscale(0)' : 'none',
        }}>
          {moodEmoji}
        </span>

        {/* Status text */}
        <div style={{ textAlign: 'left', lineHeight: 1.3 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            整改助手
          </div>
          <div style={{ fontSize: '13px', color: moodColor, fontWeight: 600 }}>
            {mood}
          </div>
        </div>

        {/* Notification badge */}
        {total > 0 && (
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
          }}>
            {total}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '360px',
          maxHeight: '420px',
          background: 'var(--card-bg)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'popoverIn 0.2s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>{moodEmoji}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>整改任务提醒</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {total === 0 ? '暂无待处理任务 ✅' : `共 ${total} 项待处理，${urgent} 项已逾期`}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: '4px', borderRadius: '6px',
            }}>
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div style={{ overflowY: 'auto', maxHeight: '320px', padding: '8px' }}>
            {total === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={40} color="#34C759" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 500 }}>太棒了！所有整改任务已完成</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>继续保持高标准的等保合规水平</div>
              </div>
            ) : (
              // Overdue first
              overdue.map((r, i) => (
                <div key={`od-${r.id}`} style={{
                  padding: '10px 12px',
                  margin: '4px 0',
                  borderRadius: '10px',
                  background: 'rgba(255,59,48,0.04)',
                  border: '1px solid rgba(255,59,48,0.1)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                }}
                  onClick={() => { window.location.hash = '#/rectification'; setOpen(false); }}
                >
                  <AlertTriangle size={16} color="#FF3B30" style={{ marginTop: '1px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                      {r.system_name && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginRight: '6px' }}>[{r.system_name}]</span>}
                      {r.title}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        background: `${PRIORITY_COLOR[r.priority]}18`,
                        color: PRIORITY_COLOR[r.priority],
                      }}>
                        {PRIORITY_MAP[r.priority]}
                      </span>
                      {r.responsible_person && <span>👤 {r.responsible_person}</span>}
                      {r.plan_end_date && (
                        <span style={{ color: '#FF3B30', fontWeight: 600 }}>
                          <Clock size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                          截止 {r.plan_end_date}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} color="var(--text-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                </div>
              ))
            )}

            {/* Pending (not overdue) */}
            {pending.filter(r => {
              const today = new Date().toISOString().slice(0, 10);
              return !r.plan_end_date || r.plan_end_date >= today;
            }).map((r, i) => (
              <div key={`pd-${r.id}`} style={{
                padding: '10px 12px',
                margin: '4px 0',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
              }}
                onClick={() => { window.location.hash = '#/rectification'; setOpen(false); }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Bell size={16} color={PRIORITY_COLOR[r.priority]} style={{ marginTop: '1px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>
                    {r.system_name && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginRight: '6px' }}>[{r.system_name}]</span>}
                    {r.title}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: `${PRIORITY_COLOR[r.priority]}18`,
                      color: PRIORITY_COLOR[r.priority],
                    }}>
                      {PRIORITY_MAP[r.priority]}
                    </span>
                    {r.responsible_person && <span>👤 {r.responsible_person}</span>}
                    {r.plan_end_date && <span>📅 {r.plan_end_date}</span>}
                  </div>
                </div>
                <ChevronRight size={14} color="var(--text-secondary)" style={{ marginTop: '2px', flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center',
          }}>
            <button
              onClick={() => { window.location.hash = '#/rectification'; setOpen(false); }}
              style={{
                border: 'none',
                background: '#007AFF',
                color: '#fff',
                padding: '6px 20px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              前往整改管理 → 共 {total} 项待处理
            </button>
          </div>

          {/* Arrow */}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '12px',
            height: '12px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderLeft: 'none',
          }} />
        </div>
      )}
    </div>
  );
}
