import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

// ============================================================
//  PageShell — 统一的 Apple 风格页面外壳
//  title: 页面标题 (不带 emoji，自己放)
//  actions: 右侧操作按钮区域
// ============================================================
export function PageShell({ title, actions, children }) {
  return (
    <div>
      <div className="page-header">
        <h2>{title}</h2>
        {actions && <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>}
      </div>
      <div className="page-body">{children}</div>
    </div>
  );
}

// ============================================================
//  Toolbar — 搜索 + 筛选 + 操作栏
//  searchPlaceholder / searchValue / onSearchChange
//  filters: ReactNode for additional filter controls
// ============================================================
export function Toolbar({ searchPlaceholder, searchValue, onSearchChange, filters, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      marginBottom: '16px', flexWrap: 'wrap'
    }}>
      {onSearchChange && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(118,118,128,0.08)', borderRadius: '10px',
          padding: '0 12px', flex: '1 1 240px', maxWidth: '360px',
          transition: 'all 0.2s ease'
        }}>
          <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              padding: '8px 0', fontSize: '13px', color: 'var(--text-primary)',
              width: '100%', fontFamily: 'inherit', letterSpacing: '-0.01em'
            }}
            placeholder={searchPlaceholder || '搜索...'}
            value={searchValue || ''}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      )}
      {filters && <div style={{ display: 'flex', gap: '8px' }}>{filters}</div>}
      <div style={{ flex: 1 }} />
      {actions}
    </div>
  );
}

// ============================================================
//  FilterSelect — 统一的筛选下拉
// ============================================================
export function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 32px 7px 12px',
        border: '1px solid var(--separator)', borderRadius: '8px',
        fontSize: '13px', fontWeight: 430, fontFamily: 'inherit',
        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
        cursor: 'pointer', outline: 'none', letterSpacing: '-0.01em',
        appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2386868B\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ============================================================
//  EmptyState — 空数据状态
// ============================================================
export function EmptyState({ icon, title, description }) {
  return (
    <div style={{
      textAlign: 'center', padding: '64px 24px',
      color: 'var(--text-secondary)'
    }}>
      {icon && <div style={{ marginBottom: '16px', opacity: 0.3 }}>{icon}</div>}
      <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
        {title || '暂无数据'}
      </h3>
      {description && <p style={{ fontSize: '13px', marginTop: '4px' }}>{description}</p>}
    </div>
  );
}

// ============================================================
//  Modal — Apple Sheet 风格弹窗
// ============================================================
export function Modal({ open, onClose, title, children, footer, width }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--separator)',
          boxShadow: 'var(--shadow-modal)', width: width || '520px',
          maxWidth: '92vw', maxHeight: '85vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'modalSlideIn 0.25s cubic-bezier(0.25,0.1,0.25,1)'
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--separator)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 590, letterSpacing: '-0.021em' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: '28px', height: '28px', borderRadius: '50%', border: 'none',
              background: 'rgba(118,118,128,0.12)', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', transition: 'background 0.15s'
            }}
          >✕</button>
        </div>
        <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid var(--separator)',
            display: 'flex', justifyContent: 'flex-end', gap: '8px'
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  DetailGrid — 键值对信息展示
// ============================================================
export function DetailGrid({ items }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '12px'
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column', gap: '2px',
          padding: '10px 14px', borderRadius: '8px',
          background: 'rgba(118,118,128,0.04)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 590, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
            {item.label}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 430, color: 'var(--text-primary)' }}>
            {item.value || '-'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  ConfirmDialog — Apple 风格确认弹窗
// ============================================================
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText, danger }) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '16px', fontWeight: 590, marginBottom: '8px', letterSpacing: '-0.021em' }}>
          {title || '确认操作'}
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn" onClick={onClose}>取消</button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => { onConfirm(); onClose(); }}
          >{confirmText || '确认'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Skeleton — 骨架屏加载占位
// ============================================================
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: '8px' }}>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px',
          padding: '12px 16px', borderBottom: '1px solid var(--separator)'
        }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <div key={ci} className="skeleton-bar" style={{
              height: '14px', borderRadius: '4px', width: `${60 + Math.random() * 30}%`
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 4 }) {
  return (
    <div className="card">
      <div className="card-body">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton-bar" style={{
            height: `${i === 0 ? 18 : 14}px`, borderRadius: '4px',
            width: `${i === 0 ? 35 : 60 + Math.random() * 35}%`,
            marginBottom: '14px'
          }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  AuthImage — 通过 Authorization header 加载图片，避免 token 暴露在 URL
// ============================================================
export function AuthImage({ url, className, style, onClick, alt }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    let revoked = false;
    const token = localStorage.getItem('djcp_token');
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { localStorage.clear(); window.location.reload(); return null; }
        return res.blob();
      })
      .then(blob => {
        if (blob && !revoked) setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  if (!blobUrl) return null;
  return <img src={blobUrl} className={className} style={style} onClick={onClick} alt={alt || ''} />;
}
