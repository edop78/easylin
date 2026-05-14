import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Globe, Plus, Trash2, RefreshCw, Download, AlertCircle, CheckCircle, ScrollText, X } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function ReverseProxy() {
  const { data: statusData } = useApi('/proxy/status');
  const { data: sitesData, refetch } = useApi('/proxy/sites');
  const [showAdd, setShowAdd] = useState(false);
  const [newSite, setNewSite] = useState({ domain: '', upstream_host: '127.0.0.1', upstream_port: '3000' });
  const [message, setMessage] = useState(null);
  const [viewConfig, setViewConfig] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });
  const [loadingConfig, setLoadingConfig] = useState(false);

  const installNginx = async () => {
    try {
      const result = await api.post('/proxy/install');
      setMessage({ type: result.success ? 'success' : 'error', text: result.success ? 'Nginx installed' : result.error });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const createSite = async (e) => {
    e.preventDefault();
    try {
      await api.post('/proxy/sites', { ...newSite, upstream_port: parseInt(newSite.upstream_port) });
      setMessage({ type: 'success', text: `Proxy for ${newSite.domain} created` });
      setNewSite({ domain: '', upstream_host: '127.0.0.1', upstream_port: '3000' });
      setShowAdd(false);
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const deleteSite = async (domain) => {
    try {
      await api.del(`/proxy/sites/${domain}`);
      setMessage({ type: 'success', text: `Proxy site ${domain} removed` });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const showConfig = async (domain) => {
    setLoadingConfig(true);
    try {
      const res = await api.get(`/proxy/sites/${domain}/config`);
      setViewConfig({ domain, config: res.config });
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to load config: ${err.message}` });
    } finally {
      setLoadingConfig(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Globe size={28} /><h1>Reverse Proxy</h1></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={refetch}><RefreshCw size={15} /> Refresh</button>
          {statusData?.installed && <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add Site</button>}
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-lg)' }}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <span className={`badge ${statusData?.installed ? 'badge-success' : 'badge-danger'}`}>Nginx: {statusData?.installed ? 'Installed' : 'Not Installed'}</span>
        {statusData?.installed && <span className={`badge ${statusData?.running ? 'badge-success' : 'badge-warning'}`}>{statusData?.running ? 'Running' : 'Stopped'}</span>}
        {!statusData?.installed && (
          <button className="btn btn-primary btn-sm" onClick={() => setConfirm({
            open: true, title: 'Install Nginx', message: 'Do you want to install Nginx web server?',
            action: installNginx
          })}><Download size={14} /> Install Nginx</button>
        )}
      </div>

      {viewConfig && (
        <div className="modal-overlay" onClick={() => setViewConfig(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '8px', borderRadius: '8px' }}>
                  <ScrollText size={20} />
                </div>
                <h3 className="modal-title" style={{ margin: 0 }}>Config: {viewConfig.domain}</h3>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setViewConfig(null)}><X size={20} /></button>
            </div>
            
            <pre className="code-block" style={{ maxHeight: '550px', fontSize: '12px', overflow: 'auto', backgroundColor: '#000', padding: '20px', borderRadius: '8px' }}>
              {viewConfig.config || 'No configuration found.'}
            </pre>
            
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setViewConfig(null)}>Close Viewer</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Add Reverse Proxy Site</h3>
          <form onSubmit={createSite} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', alignItems: 'end' }}>
            <div className="form-group"><label className="form-label">Domain</label><input className="input" placeholder="example.com" value={newSite.domain} onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Upstream Host</label><input className="input" placeholder="127.0.0.1" value={newSite.upstream_host} onChange={(e) => setNewSite({ ...newSite, upstream_host: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Port</label><input className="input" type="number" placeholder="3000" value={newSite.upstream_port} onChange={(e) => setNewSite({ ...newSite, upstream_port: e.target.value })} required /></div>
            <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Create Proxy</button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="card-title"><Globe size={16} /> Configured Proxy Sites</div>
        </div>
        {(sitesData?.enabled || []).length > 0 ? (
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 24px' }}>Domain Name</th>
                <th style={{ padding: '16px 24px' }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sitesData.enabled.filter(s => s).map((site) => (
                <tr key={site} className="hover-row">
                  <td style={{ padding: '14px 24px', color: 'var(--text-primary)', fontWeight: 600 }}>{site}</td>
                  <td style={{ padding: '14px 24px' }}><span className="badge badge-success">Enabled</span></td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => showConfig(site)}
                        disabled={loadingConfig}
                      >
                        {loadingConfig ? <RefreshCw size={14} className="spin" /> : <ScrollText size={14} />}
                        View Config
                      </button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                        open: true, title: 'Delete Site', message: `Are you sure you want to remove the proxy configuration for ${site}?`,
                        action: () => deleteSite(site)
                      })} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No proxy sites configured yet.
          </div>
        )}
      </div>

      <ConfirmModal isOpen={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })} />
      <style dangerouslySetInnerHTML={{ __html: `
        .hover-row:hover { background-color: rgba(255, 255, 255, 0.02) !important; }
      `}} />
    </div>
  );
}
