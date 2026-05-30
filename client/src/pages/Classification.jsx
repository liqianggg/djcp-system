import React, { useState, useEffect } from 'react';
import { Plus, FileText } from 'lucide-react';
import { apiGet, apiPost, hasPermission } from '../api';

const levelLabels = { 1: '自主保护级', 2: '指导保护级', 3: '监督保护级', 4: '强制保护级', 5: '专控保护级' };

export default function Classification() {
  const [systems, setSystems] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ system_id: '', business_impact_level: 2, service_scope: '', business_dependency: '', classification_report: '', classified_by: '' });

  useEffect(() => {
    apiGet('/api/systems').then(s => s && setSystems(s));
    apiGet('/api/classifications').then(c => c && setClassifications(c));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await apiPost('/api/classifications', form);
    setShowModal(false);
    setForm({ system_id: '', business_impact_level: 2, service_scope: '', business_dependency: '', classification_report: '', classified_by: '' });
    apiGet('/api/classifications').then(c => c && setClassifications(c));
  };

  return (
    <div>
      <div className="page-header">
        <h2>🛡️ 系统定级</h2>
        {hasPermission('classification:create') && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> 新建定级</button>
        )}
      </div>
      <div className="page-body">
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>信息系统</th><th>业务影响等级</th><th>服务范围</th><th>业务依赖</th><th>定级人</th><th>定级日期</th><th>操作</th></tr></thead>
              <tbody>
                {classifications.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state"><h3>暂无定级记录</h3></td></tr>
                ) : classifications.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.system_name}</strong></td>
                    <td><span className={`level-badge level-${c.business_impact_level}`}>{c.business_impact_level}</span> <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{levelLabels[c.business_impact_level]}</span></td>
                    <td>{c.service_scope || '-'}</td><td>{c.business_dependency || '-'}</td><td>{c.classified_by || '-'}</td><td>{c.classified_at || '-'}</td><td><a href={"/api/classifications/" + c.id + "/report?token=" + localStorage.getItem("djcp_token")} target="_blank" className="btn btn-sm" title="查看定级报告" style={{textDecoration:"none"}}><FileText size={14} /> 报告</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header"><FileText size={16} /> 定级指南</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ color: '#166534', marginBottom: '8px' }}>受侵害客体：业务信息安全</h4>
                <table style={{ fontSize: '13px' }}><thead><tr><th>等级</th><th>侵害程度</th><th>说明</th></tr></thead>
                  <tbody><tr><td>S1</td><td>一般损害</td><td>公民、法人合法权益</td></tr><tr><td>S2</td><td>严重损害</td><td>社会秩序和公共利益</td></tr><tr><td>S3</td><td>特别严重损害</td><td>国家安全</td></tr></tbody></table>
              </div>
              <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <h4 style={{ color: '#1e40af', marginBottom: '8px' }}>受侵害客体：系统服务安全</h4>
                <table style={{ fontSize: '13px' }}><thead><tr><th>等级</th><th>侵害程度</th><th>说明</th></tr></thead>
                  <tbody><tr><td>G1</td><td>一般损害</td><td>公民、法人合法权益</td></tr><tr><td>G2</td><td>严重损害</td><td>社会秩序和公共利益</td></tr><tr><td>G3</td><td>特别严重损害</td><td>国家安全</td></tr></tbody></table>
              </div>
            </div>
            <div style={{ marginTop: '16px', padding: '16px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #fed7aa' }}>
              <h4 style={{ color: '#9a3412', marginBottom: '8px' }}>安全保护等级矩阵（S × G → Level）</h4>
              <table style={{ fontSize: '13px', textAlign: 'center' }}><thead><tr><th></th><th>G1</th><th>G2</th><th>G3</th></tr></thead>
                <tbody><tr><td><strong>S1</strong></td><td>第一级</td><td>第二级</td><td>第三级</td></tr><tr><td><strong>S2</strong></td><td>第二级</td><td>第三级</td><td>第四级</td></tr><tr><td><strong>S3</strong></td><td>第三级</td><td>第四级</td><td>第五级</td></tr></tbody></table>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">新建系统定级<button className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>信息系统 *</label>
                  <select className="form-control" required value={form.system_id} onChange={e => setForm({...form, system_id: e.target.value})}>
                    <option value="">请选择</option>
                    {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>业务信息安全等级</label><select className="form-control" value={form.business_impact_level} onChange={e => setForm({...form, business_impact_level: parseInt(e.target.value)})}>{[1,2,3,4,5].map(l => <option key={l} value={l}>第{l}级 - {levelLabels[l]}</option>)}</select></div>
                  <div className="form-group"><label>定级人 *</label><input className="form-control" required value={form.classified_by} onChange={e => setForm({...form, classified_by: e.target.value})} /></div>
                </div>
                <div className="form-group"><label>服务范围</label><textarea className="form-control" value={form.service_scope} onChange={e => setForm({...form, service_scope: e.target.value})}></textarea></div>
                <div className="form-group"><label>业务依赖描述</label><textarea className="form-control" value={form.business_dependency} onChange={e => setForm({...form, business_dependency: e.target.value})}></textarea></div>
                <div className="form-group"><label>定级报告</label><textarea className="form-control" value={form.classification_report} onChange={e => setForm({...form, classification_report: e.target.value})} rows={3}></textarea></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn" onClick={() => setShowModal(false)}>取消</button><button type="submit" className="btn btn-primary">提交定级</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
