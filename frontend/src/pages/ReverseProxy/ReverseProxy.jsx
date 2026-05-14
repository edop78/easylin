import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Globe, Plus, Trash2, RefreshCw, Download, AlertCircle, CheckCircle, ScrollText, X, Shield, ShieldCheck, Lock, Info } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function ReverseProxy() {
  const { data: statusData, refetch: refetchStatus } = useApi('/proxy/status');
  const { data: sitesData, loading: loadingSites, refetch: refetchSites } = useApi('/proxy/sites');
  
  const [showAdd, setShowAdd] = useState(false);
  const [newSite, setNewSite] = useState({ 
    domain: '', 
    upstream_host: '127.0.0.1', 
    upstream_port: '3000',
    max_body: '100',
    use_ssl: false,
    email: ''
  });
  
  const [message, setMessage] = useState(null);
  const [viewConfig, setViewConfig] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleInstall = async () => {
    setLoadingAction(true);
    try {
      const res = await api.post('/proxy/install');
      if (res.success) {
        setMessage({ type: 'success', text: 'Nginx and Certbot installed successfully!' });
        refetchStatus();
      } else {
        setMessage({ type: 'error', text: res.error || 'Installation failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const createSite = async (e) => {
    e.preventDefault();
    setLoadingAction(true);
    try {
      const res = await api.post('/proxy/sites', newSite);
      if (res.success) {
        let msg = `Proxy for ${newSite.domain} created.`;
        if (newSite.use_ssl) {
          msg += res.ssl_active ? ' SSL enabled successfully!' : ' SSL failed: ' + res.ssl_error;
        }
        setMessage({ type: res.ssl_active || !newSite.use_ssl ? 'success' : 'warning', text: msg });
        setNewSite({ domain: '', upstream_host: '127.0.0.1', upstream_port: '3000', max_body: '100', use_ssl: false, email: '' });
        setShowAdd(false);
        refetchSites();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteSite = async (domain) => {
    try {
      await api.del(`/proxy/sites/${domain}`);
      setMessage({ type: 'success', text: `Proxy site ${domain} removed` });
      refetchSites();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const showConfig = async (domain) => {
    try {
      const res = await api.get(`/proxy/sites/${domain}/config`);
      setViewConfig({ domain, config: res.config });
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to load config: ${err.message}` });
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Globe size={28} /><h1>Reverse Proxy</h1></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => { refetchStatus(); refetchSites(); }}><RefreshCw size={15} /> Refresh</button>
          {statusData?.installed && <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add Site</button>}
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{message.text}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setMessage(null)}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <span className={`badge ${statusData?.installed ? 'badge-success' : 'badge-danger'}`}>
            Nginx: {statusData?.installed ? 'Installed' : 'Missing'}
          </span>
          <span className={`badge ${statusData?.certbot_installed ? 'badge-success' : 'badge-warning'}`}>
            Certbot: {statusData?.certbot_installed ? 'Installed' : 'Missing'}
          </span>
        </div>
        
        {(!statusData?.installed || !statusData?.certbot_installed) && (
          <button className="btn btn-primary btn-sm" disabled={loadingAction} onClick={handleInstall}>
            {loadingAction ? <RefreshCw size={14} className="spin" /> : <Download size={14} />} 
            Install Proxy Stack
          </button>
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
            <pre className="code-block" style={{ maxHeight: '500px', fontSize: '11px', overflow: 'auto', backgroundColor: '#000', padding: '20px' }}>
              {viewConfig.config}
            </pre>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> New Reverse Proxy Site
          </h3>
          <form onSubmit={createSite}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
              <div className="form-group">
                <label className="form-label">Domain Name</label>
                <input className="input" placeholder="e.g. app.example.com" value={newSite.domain} onChange={e => setNewSite({...newSite, domain: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Upstream Host</label>
                <input className="input" placeholder="127.0.0.1 (or container name)" value={newSite.upstream_host} onChange={e => setNewSite({...newSite, upstream_host: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Upstream Port</label>
                <input className="input" type="number" placeholder="3000" value={newSite.upstream_port} onChange={e => setNewSite({...newSite, upstream_port: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Max Upload Size (MB)</label>
                <input className="input" type="number" placeholder="100" value={newSite.max_body} onChange={e => setNewSite({...newSite, max_body: e.target.value})} />
              </div>
            </div>
            
            <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={newSite.use_ssl} onChange={e => setNewSite({...newSite, use_ssl: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                  <Lock size={16} className={newSite.use_ssl ? 'text-blue' : ''} /> Enable SSL (Let's Encrypt)
                </label>
                {newSite.use_ssl && (
                  <input 
                    className="input" 
                    type="email" 
                    placeholder="Admin Email (for SSL alerts)" 
                    value={newSite.email} 
                    onChange={e => setNewSite({...newSite, email: e.target.value})} 
                    style={{ flex: 1, maxWidth: '300px' }}
                    required={newSite.use_ssl}
                  />
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', marginLeft: '26px' }}>
                <Info size={12} /> Note: The domain must already point to this server's IP address to enable SSL.
              </p>
            </div>

            <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' }}>
              <button type="submit" className="btn btn-primary" disabled={loadingAction} style={{ minWidth: '150px' }}>
                {loadingAction ? <RefreshCw size={16} className="spin" /> : <Globe size={16} />} Deploy Proxy
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <div className="card-title"><Shield size={16} /> Secure Proxy Sites</div>
        </div>
        {loadingSites ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><RefreshCw className="spin" /></div>
        ) : (sitesData?.enabled || []).length > 0 ? (
          <table className="data-table">
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 24px' }}>Domain</th>
                <th style={{ padding: '16px 24px' }}>Security</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sitesData?.enabled?.filter(s => s && s !== 'default').map((site) => (
                <tr key={site} className="hover-row">
                  <td style={{ padding: '14px 24px', fontWeight: 600 }}>{site}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span className="badge badge-success"><ShieldCheck size={12} style={{ marginRight: '4px' }} /> Active</span>
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => showConfig(site)}><ScrollText size={14} /> Config</button>
                      <button className="btn btn-sm btn-icon btn-ghost text-red" onClick={() => setConfirm({
                        open: true, title: 'Delete Proxy', message: `Remove proxy for ${site}?`,
                        action: () => deleteSite(site)
                      })}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No proxy sites configured.</div>
        )}
      </div>

      <ConfirmModal isOpen={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })} />
      <style dangerouslySetInnerHTML={{ __html: `
        .hover-row:hover { background-color: rgba(255, 255, 255, 0.02) !important; }
        .text-blue { color: var(--accent-blue); }
        .text-red { color: var(--accent-red); }
      `}} />
    </div>
  );
}
