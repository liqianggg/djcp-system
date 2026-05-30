import React, { useState, useEffect } from 'react';
import { Server, ShieldCheck, ClipboardCheck, Wrench, FolderOpen, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiGet } from '../api';

const LEVEL_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
const STATUS_COLORS = { draft: '#9ca3af', classified: '#3b82f6', filed: '#8b5cf6', assessing: '#f59e0b', rectifying: '#f97316', completed: '#22c55e' };
const STATUS_LABELS = { draft: '草稿', classified: '已定级', filed: '已备案', assessing: '测评中', rectifying: '整改中', completed: '已完成' };

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => { apiGet('/api/dashboard/stats').then(setStats); }, []);

  if (!stats) return <div className="page-body">加载中...</div>;

  const levelData = (stats.levelDistribution || []).map(d => ({ name: `等级${d.security_level}`, value: d.cnt, level: d.security_level }));
  const statusData = (stats.statusDistribution || []).map(d => ({ name: STATUS_LABELS[d.status] || d.status, value: d.cnt, status: d.status }));

  return (
    <div>
      <div className="page-header"><h2>📊 工作台</h2><span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>等保测评全生命周期概览</span></div>
      <div className="page-body">
        <div className="stats-grid">
          {[
            { icon: <Server size={24} color="#1a73e8" />, bg: '#dbeafe', value: stats.totalSystems, label: '信息系统总数' },
            { icon: <ShieldCheck size={24} color="#0d9488" />, bg: '#d1fae5', value: stats.classifiedSystems, label: '已定级系统' },
            { icon: <ClipboardCheck size={24} color="#f59e0b" />, bg: '#fef3c7', value: stats.assessmentsCompleted, label: '已完成测评' },
            { icon: <Wrench size={24} color="#ef4444" />, bg: '#fee2e2', value: stats.rectificationsPending, label: '待整改任务' },
            { icon: <FolderOpen size={24} color="#8b5cf6" />, bg: '#ede9fe', value: stats.documentsTotal, label: '文档总数' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
              <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
            </div>
          ))}
        </div>

        <div className="charts-row">
          <div className="card">
            <div className="card-header">系统安全等级分布</div>
            <div className="card-body">
              {levelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={levelData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({name,value}) => `${name}: ${value}`}>
                      {levelData.map((entry, i) => <Cell key={i} fill={LEVEL_COLORS[entry.level - 1] || '#ccc'} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="empty-state"><h3>暂无数据</h3></div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header">系统状态分布</div>
            <div className="card-body">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="value" name="数量" radius={[4,4,0,0]}>
                      {statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.status] || '#ccc'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="empty-state"><h3>暂无数据</h3></div>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} color="var(--danger)" />逾期整改任务</span><span className="badge badge-red">{stats.overdueRectifications?.length || 0} 项</span></div>
          <div className="card-body">
            {stats.overdueRectifications && stats.overdueRectifications.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>系统名称</th><th>任务标题</th><th>负责人</th><th>优先级</th><th>计划完成</th><th>状态</th></tr></thead>
                  <tbody>
                    {stats.overdueRectifications.map(r => (
                      <tr key={r.id}><td><strong>{r.system_name}</strong></td><td>{r.title}</td><td>{r.responsible_person || '-'}</td><td><span className={`badge badge-${r.priority === 'urgent' ? 'red' : r.priority === 'high' ? 'yellow' : 'gray'}`}>{r.priority}</span></td><td style={{ color: 'var(--danger)' }}>{r.plan_end_date}</td><td><span className="badge badge-yellow">{r.status === 'in_progress' ? '进行中' : '待处理'}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><h3>🎉 没有逾期任务</h3></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">最近测评记录</div>
          <div className="card-body">
            {stats.recentAssessments && stats.recentAssessments.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>系统名称</th><th>测评机构</th><th>类型</th><th>日期</th><th>得分</th><th>结论</th><th>状态</th></tr></thead>
                  <tbody>
                    {stats.recentAssessments.map(a => (
                      <tr key={a.id}><td><strong>{a.system_name}</strong></td><td>{a.assessment_agency || '-'}</td><td>{a.assessment_type === 'initial' ? '初次' : a.assessment_type === 'reassessment' ? '复评' : '年度'}</td><td>{a.assessment_date || '-'}</td><td><strong>{a.overall_score != null ? a.overall_score : '-'}</strong></td><td><span className={`badge ${a.conclusion === 'pass' ? 'badge-green' : a.conclusion === 'conditional_pass' ? 'badge-yellow' : 'badge-red'}`}>{a.conclusion === 'pass' ? '通过' : a.conclusion === 'conditional_pass' ? '有条件通过' : '未通过'}</span></td><td><span className="badge badge-blue">{a.status === 'completed' ? '已完成' : a.status === 'in_progress' ? '进行中' : '计划中'}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state"><h3>暂无测评记录</h3></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
