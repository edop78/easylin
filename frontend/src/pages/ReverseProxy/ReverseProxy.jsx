import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Globe, Plus, Trash2, RefreshCw, Download, AlertCircle, CheckCircle } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function ReverseProxy() {
  const { data: statusData } = useApi('/proxy/status');
  const { data: sitesData, refetch } = useApi('/proxy/sites');
  const [showAdd, setShowAdd] = useState(false);
  const [newSite, setNewSite] = useState({ domain: '', upstream_host: '127.0.0.1', upstream_port: '3000' });
  const [message, setMessage] = useState(null);
  const [viewConfig, setViewConfig] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const installNginx = async () => {
    try {
      const result = await api.post('/proxy/install');
      setMessage({ type: result.success ? 'success' : 'error', text: result.success ? 'Nginx installed' : result.error });
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
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
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
        <div className={`alert alert-${message.type}`}>
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
            action: installNginx, type: 'info'
          })}><Download size={14} /> Install Nginx</button>
        )}
      </div>

      {viewConfig && (
        <div className="modal-overlay" onClick={() => setViewConfig(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3 className="modal-title">{viewConfig.domain}</h3><pre className="code-block">{viewConfig.config}</pre>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setViewConfig(null)}>Close</button></div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Add Reverse Proxy</h3>
          <form onSubmit={createSite} style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}><label className="form-label">Domain</label><input className="form-input" placeholder="example.com" value={newSite.domain} onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })} required /></div>
            <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}><label className="form-label">Upstream Host</label><input className="form-input" placeholder="127.0.0.1" value={newSite.upstream_host} onChange={(e) => setNewSite({ ...newSite, upstream_host: e.target.value })} required /></div>
            <div className="form-group" style={{ width: '120px', marginBottom: 0 }}><label className="form-label">Port</label><input className="form-input" type="number" placeholder="3000" value={newSite.upstream_port} onChange={(e) => setNewSite({ ...newSite, upstream_port: e.target.value })} required /></div>
            <button type="submit" className="btn btn-primary">Create</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title"><Globe size={16} /> Proxy Sites</div></div>
        {(sitesData?.enabled || []).length > 0 ? (
          <table className="data-table">
            <thead><tr><th>Site</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {sitesData.enabled.filter(s => s).map((site) => (
                <tr key={site}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{site}</td><td><span className="badge badge-success">Enabled</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => showConfig(site)}>View Config</button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                        open: true, title: 'Delete Site', message: `Remove proxy configuration for ${site}?`,
                        action: () => deleteSite(site)
                      })} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty-state"><p>No proxy sites configured</p></div>}
      </div>

      <ConfirmModal isOpen={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })} />
    </div>
  );
}
