import React, { useState, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet, hasPermission, fetchDownload } from '../api';
import { PageShell, Toolbar } from '../components';

const ACTION_LABELS = {
  login: '登录', logout: '登出', create: '创建', update: '修改', delete: '删除',
  upload: '上传', status_change: '状态变更', manage_permissions: '权限管理', reset_password: '重置密码'
};
const ACTION_CLASS = {
  login: 'badge-blue', logout: 'badge-gray', create: 'badge-green', update: 'badge-yellow',
  delete: 'badge-red', upload: 'badge-blue', status_change: 'badge-yellow',
  manage_permissions: 'badge-red', reset_password: 'badge-red'
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState({ action: '', module: '', start_date: '', end_date: '' });

  const loadLogs = () => {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (filters.action) params.set('action', filters.action);
    if (filters.module) params.set('module', filters.module);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);
    apiGet('/api/audit-logs?' + params).then(r => { if (r) { setLogs(r.data); setTotal(r.total); } });
  };

  useEffect(loadLogs, [page, filters]);

  const handleExport = () => {
    fetchDownload('/api/audit-logs/export', 'audit-logs.csv');
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <PageShell
      title="审计日志"
      actions={hasPermission('audit:export') && <button className="btn" onClick={handleExport}><Download size={15} /> 导出CSV</button>}
    >
      <Toolbar
        filters={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={filters.action}
              onChange={e => { setFilters({...filters, action: e.target.value}); setPage(1); }}
              style={{
                padding: '7px 32px 7px 12px', border: '1px solid var(--separator)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2386868B\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
              }}
            >
              <option value="">全部操作</option>
              {Object.entries(ACTION_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              value={filters.module}
              onChange={e => { setFilters({...filters, module: e.target.value}); setPage(1); }}
              style={{
                padding: '7px 32px 7px 12px', border: '1px solid var(--separator)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2386868B\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center'
              }}
            >
              <option value="">全部模块</option>
              {['auth','system','classification','filing','gap','rectification','assessment','document','user','permission','audit'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.start_date}
              onChange={e => { setFilters({...filters, start_date: e.target.value}); setPage(1); }}
              style={{
                padding: '7px 12px', border: '1px solid var(--separator)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', outline: 'none'
              }}
              placeholder="开始日期"
            />
            <input
              type="date"
              value={filters.end_date}
              onChange={e => { setFilters({...filters, end_date: e.target.value}); setPage(1); }}
              style={{
                padding: '7px 12px', border: '1px solid var(--separator)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', outline: 'none'
              }}
              placeholder="结束日期"
            />
          </div>
        }
      />

      <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="table-wrapper" style={{ flex: 1 }}>
          <table>
            <thead>
              <tr><th>时间</th><th>操作人</th><th>操作</th><th>模块</th><th>目标</th><th>详情</th><th>结果</th></tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7}><div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}><h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>暂无审计日志</h3><p style={{ fontSize: '13px' }}>系统操作记录将显示在此处</p></div></td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{log.created_at}</td>
                  <td><strong>{log.real_name || log.username}</strong></td>
                  <td><span className={`badge ${ACTION_CLASS[log.action] || 'badge-gray'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                  <td><span className="badge badge-gray">{log.module}</span></td>
                  <td style={{ fontSize: '12px' }}>{log.target_type} #{log.target_id || '-'}</td>
                  <td style={{ fontSize: '12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail || '-'}</td>
                  <td><span className={`badge ${log.result === 'success' ? 'badge-green' : 'badge-red'}`}>{log.result === 'success' ? '成功' : '失败'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--separator)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>共 {total} 条记录</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: '13px', padding: '0 8px' }}>{page} / {totalPages}</span>
              <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
