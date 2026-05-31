import React, { useState, useEffect } from 'react';
import { Plus, FileText, Info, Download, Eye } from 'lucide-react';
import { apiGet, apiPost, hasPermission } from '../api';
import { PageShell, EmptyState, Modal } from '../components';

const LEVEL_LABELS = { 1: '自主保护级', 2: '指导保护级', 3: '监督保护级', 4: '强制保护级', 5: '专控保护级' };

export default function Classification() {
  const [systems, setSystems] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [exportFormat, setExportFormat] = useState('html');
  const [form, setForm] = useState({ system_id: '', business_impact_level: 2, service_scope: '', business_dependency: '', classification_report: '', classified_by: '' });

  const load = () => {
    apiGet('/api/systems').then(setSystems);
    apiGet('/api/classifications').then(setClassifications);
  };
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await apiPost('/api/classifications', form);
    setShowModal(false);
    setForm({ system_id: '', business_impact_level: 2, service_scope: '', business_dependency: '', classification_report: '', classified_by: '' });
    load();
  };

  return (
    <PageShell
      title="系统定级"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>导出格式:</span>
          <select
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value)}
            style={{
              padding: '5px 28px 5px 10px', border: '1px solid var(--separator)', borderRadius: '7px',
              fontSize: '12px', fontFamily: 'inherit', background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 10 10\'%3E%3Cpath fill=\'%2386868B\' d=\'M5 7L1 3h8z\'/%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center'
            }}
          >
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
          <button className="btn" onClick={() => setShowGuide(!showGuide)}><Info size={15} /> 定级指南</button>
          {hasPermission('classification:create') && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> 新建定级</button>}
        </div>
      }
    >
      {/* 定级指南 — 独立展示，不混在数据里 */}
      {showGuide && (
        <div className="card" style={{ borderColor: 'rgba(0,122,255,0.15)', background: 'rgba(0,122,255,0.02)' }}>
          <div className="card-header">
            <Info size={15} style={{ color: 'var(--blue)' }} /> 定级指南
            <button className="btn btn-sm" onClick={() => setShowGuide(false)}>收起</button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.15)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 590, marginBottom: '10px', color: '#248A3D' }}>受侵害客体：业务信息安全 (S)</h4>
                <table style={{ fontSize: '13px', width: '100%' }}>
                  <thead><tr><th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>等级</th><th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>侵害程度</th></tr></thead>
                  <tbody>
                    <tr><td style={{ fontWeight: 600 }}>S1</td><td>公民、法人合法权益 → 一般损害</td></tr>
                    <tr><td style={{ fontWeight: 600 }}>S2</td><td>社会秩序和公共利益 → 严重损害</td></tr>
                    <tr><td style={{ fontWeight: 600 }}>S3</td><td>国家安全 → 特别严重损害</td></tr>
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0,122,255,0.04)', border: '1px solid rgba(0,122,255,0.12)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 590, marginBottom: '10px', color: '#0062CC' }}>受侵害客体：系统服务安全 (G)</h4>
                <table style={{ fontSize: '13px', width: '100%' }}>
                  <thead><tr><th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>等级</th><th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>侵害程度</th></tr></thead>
                  <tbody>
                    <tr><td style={{ fontWeight: 600 }}>G1</td><td>公民、法人合法权益 → 一般损害</td></tr>
                    <tr><td style={{ fontWeight: 600 }}>G2</td><td>社会秩序和公共利益 → 严重损害</td></tr>
                    <tr><td style={{ fontWeight: 600 }}>G3</td><td>国家安全 → 特别严重损害</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,149,0,0.05)', border: '1px solid rgba(255,149,0,0.15)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 590, marginBottom: '10px', color: '#C93400' }}>安全保护等级矩阵 (S × G → Level)</h4>
              <table style={{ fontSize: '13px', textAlign: 'center', width: '100%' }}>
                <thead><tr><th></th><th>G1</th><th>G2</th><th>G3</th></tr></thead>
                <tbody>
                  <tr><td style={{ fontWeight: 600 }}>S1</td><td>第一级</td><td>第二级</td><td>第三级</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>S2</td><td>第二级</td><td>第三级</td><td>第四级</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>S3</td><td>第三级</td><td>第四级</td><td>第五级</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 定级记录列表 */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>信息系统</th><th>业务影响等级</th><th>服务范围</th><th>业务依赖</th><th>定级人</th><th>定级日期</th><th style={{ width:'80px' }}>操作</th></tr>
            </thead>
            <tbody>
              {classifications.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="暂无定级记录" description="点击右上角「新建定级」开始" /></td></tr>
              ) : classifications.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.system_name}</strong></td>
                  <td>
                    <span className={`level-badge level-${c.business_impact_level}`}>{c.business_impact_level}</span>
                    <span style={{ marginLeft:'8px', fontSize:'12px', color:'var(--text-secondary)' }}>{LEVEL_LABELS[c.business_impact_level]}</span>
                  </td>
                  <td style={{ color:'var(--text-secondary)', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.service_scope || '-'}</td>
                  <td style={{ color:'var(--text-secondary)', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.business_dependency || '-'}</td>
                  <td>{c.classified_by || '-'}</td>
                  <td style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{c.classified_at || '-'}</td>
                  <td>
                    <div className="toolbar">
                      <a href={"/api/classifications/"+c.id+"/report?token="+localStorage.getItem("djcp_token")} target="_blank" className="btn btn-sm" style={{ textDecoration:'none' }} title="查看报告">
                        <Eye size={13} /> 查看
                      </a>
                      <a
                        href={"/api/classifications/"+c.id+"/report?format="+exportFormat+"&token="+localStorage.getItem("djcp_token")}
                        target={exportFormat === 'pdf' ? '_blank' : undefined}
                        download={exportFormat === 'html' ? '定级报告-'+c.system_name+'.html' : undefined}
                        className="btn btn-sm"
                        style={{ textDecoration:'none' }}
                        title={"导出为 "+exportFormat.toUpperCase()}
                      >
                        <Download size={13} /> 导出
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showModal} onClose={() => setShowModal(false)}
        title="新建系统定级"
        footer={<><button className="btn" onClick={() => setShowModal(false)}>取消</button><button className="btn btn-primary" onClick={handleSubmit}>提交定级</button></>}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>信息系统 *</label>
            <select className="form-control" required value={form.system_id} onChange={e => setForm({...form, system_id:e.target.value})}>
              <option value="">请选择信息系统</option>
              {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>业务信息安全等级</label>
              <select className="form-control" value={form.business_impact_level} onChange={e => setForm({...form, business_impact_level:parseInt(e.target.value)})}>
                {[1,2,3,4,5].map(l => <option key={l} value={l}>第{l}级 - {LEVEL_LABELS[l]}</option>)}
              </select>
            </div>
            <div className="form-group"><label>定级人 *</label><input className="form-control" required value={form.classified_by} onChange={e => setForm({...form, classified_by:e.target.value})} /></div>
          </div>
          <div className="form-group"><label>服务范围</label><textarea className="form-control" value={form.service_scope} onChange={e => setForm({...form, service_scope:e.target.value})} rows={2} /></div>
          <div className="form-group"><label>业务依赖描述</label><textarea className="form-control" value={form.business_dependency} onChange={e => setForm({...form, business_dependency:e.target.value})} rows={2} /></div>
          <div className="form-group"><label>定级报告</label><textarea className="form-control" value={form.classification_report} onChange={e => setForm({...form, classification_report:e.target.value})} rows={3} /></div>
        </form>
      </Modal>
    </PageShell>
  );
}
