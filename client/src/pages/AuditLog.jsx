import React, { useState, useEffect } from 'react';
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet, hasPermission } from '../api';

const ACTION_LABELS = {
  login: '登录', logout: '登出', create: '创建', update: '修改', delete: '删除',
  upload: '上传', status_change: '状态变更', manage_permissions: '权限管理', reset_password: '重置密码'
};
const ACTION_COLORS = {
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

  const loadLogs = async () => {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (filters.action) params.set('action', filters.action);
    if (filters.module) params.set('module', filters.module);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);

    const result = await apiGet('/api/audit-logs?' + params);
    if (result) { setLogs(result.data); setTotal(result.total); }
  };

  useEffect(() => { loadLogs(); }, [page, filters]);

  const totalPages = Math.ceil(total / pageSize);

  const handleExport = () => {
    const token = localStorage.getItem('djcp_token');
    window.open('/api/audit-logs/export?token=' + encodeURIComponent(token), '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <h2>📜 审计日志</h2>
        <div className="toolbar">
          {hasPermission('audit:export') && (
            <button className="btn" onClick={handleExport}>
              <Download size={16} /> 导出CSV
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-body">
            <div className="search-bar" style={{ marginBottom: 0 }}>
              <Search size={16} style={{ color: 'var(--text-secondary)' }} />
              <select className="form-control" value={filters.action} onChange={e => { setFilters({...filters, action: e.target.value}); setPage(1); }}>
                <option value="">全部操作</option>
                {Object.entries(ACTION_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="form-control" value={filters.module} onChange={e => { setFilters({...filters, module: e.target.value}); setPage(1); }}>
                <option value="">全部模块</option>
                {['auth','system','classification','filing','gap','rectification','assessment','document','user','permission','audit'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input className="form-control" type="date" value={filters.start_date} onChange={e => { setFilters({...filters, start_date: e.target.value}); setPage(1); }} placeholder="开始日期" />
              <input className="form-control" type="date" value={filters.end_date} onChange={e => { setFilters({...filters, end_date: e.target.value}); setPage(1); }} placeholder="结束日期" />
            </div>
          </div>
        </div>

        {/* Log table */}
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>时间</th><th>操作人</th><th>操作</th><th>模块</th>
                  <th>目标</th><th>详情</th><th>结果</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state"><h3>暂无审计日志</h3><p>系统操作记录将显示在此处</p></td></tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{log.created_at}</td>
                    <td><strong>{log.real_name || log.username}</strong></td>
                    <td><span className={`badge ${ACTION_COLORS[log.action] || 'badge-gray'}`}>{ACTION_LABELS[log.action] || log.action}</span></td>
                    <td><span className="badge badge-gray">{log.module}</span></td>
                    <td style={{ fontSize: '12px' }}>{log.target_type} #{log.target_id || '-'}</td>
                    <td style={{ fontSize: '12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.detail || '-'}</td>
                    <td>
                      <span className={`badge ${log.result === 'success' ? 'badge-green' : 'badge-red'}`}>
                        {log.result === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>共 {total} 条记录</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: '13px', padding: '0 8px' }}>{page} / {totalPages}</span>
                <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
