import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Container, Play, Square, RotateCw, Trash2, RefreshCw, 
  Image, HardDrive, Network, ScrollText, Cog, ShoppingCart, 
  Download, ExternalLink, Globe, Trash, CheckCircle, AlertCircle, Copy, Plus, Github, Lock
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const MARKET_APPS = [
  {
    id: 'nginx-proxy-manager',
    containerName: 'nginx-proxy-manager',
    name: 'Nginx Proxy Manager',
    desc: 'Expose your services easily and securely with SSL.',
    icon: Globe,
    image: 'jc21/nginx-proxy-manager:latest',
    tags: ['Proxy', 'SSL', 'Security'],
    url: 'https://nginxproxymanager.com/',
    uiPort: 81
  }
];

export default function Docker() {
  const { data: info } = useApi('/docker/info');
  const { data: containersData, loading, refetch: refetchContainers } = useApi('/docker/containers');
  const { data: imagesData, refetch: refetchImages } = useApi('/docker/images');
  const { data: volumesData, refetch: refetchVolumes } = useApi('/docker/volumes');
  const { data: networksData, refetch: refetchNetworks } = useApi('/docker/networks');
  
  const [tab, setTab] = useState('containers');
  const [logsModal, setLogsModal] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [installing, setInstalling] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });
  
  const [customApp, setCustomApp] = useState({ type: 'image', image: '', name: '', ports: '' });

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMsg({ type: 'success', text: 'Error message copied to clipboard!' });
  };

  const refetchAll = () => {
    refetchContainers();
    refetchImages();
    refetchVolumes();
    refetchNetworks();
  };

  const containerAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      await api.post(`/docker/containers/${id}/${action}`);
      setMsg({ type: 'success', text: `Container ${action}ed successfully` });
      refetchContainers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading('');
    }
  };

  const handleManualInstall = async (e) => {
    e.preventDefault();
    setInstalling('custom');
    try {
      const res = await api.post('/docker/containers/run', customApp);
      setMsg({ type: 'success', text: res.message });
      setCustomApp({ type: 'image', image: '', name: '', ports: '' });
      refetchContainers();
      setTab('containers');
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setInstalling(null);
    }
  };

  const installApp = async (appId) => {
    setInstalling(appId);
    try {
      const res = await api.post('/docker/market/install', { app_id: appId });
      setMsg({ type: 'success', text: res.message });
      refetchContainers();
      setTab('containers');
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setInstalling(null);
    }
  };

  const viewLogs = async (id, name) => {
    try {
      const result = await api.get(`/docker/containers/${id}/logs?tail=100`);
      setLogsModal({ name, logs: result.logs });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const removeImage = async (id) => {
    try {
      await api.del(`/docker/images/${id}`);
      setMsg({ type: 'success', text: 'Image removed successfully' });
      refetchImages();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const isAppInstalled = (containerName) => {
    return containersData?.containers?.some(c => c.name === containerName);
  };

  const getAppContainerId = (containerName) => {
    return containersData?.containers?.find(c => c.name === containerName)?.id;
  };

  if (info?.error) {
    return (
      <div className="page fade-in">
        <div className="page-header">
          <div className="page-title"><Container size={28} /><h1>Docker</h1></div>
        </div>
        <div className="alert alert-warning">Docker daemon is not available. Make sure Docker is installed and the socket is mounted.</div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Container size={28} /><h1>Docker</h1></div>
        <button className="btn btn-ghost" onClick={refetchAll}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          {msg.type === 'error' && (
            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard(msg.text)} title="Copy error">
              <Copy size={14} /> Copy
            </button>
          )}
        </div>
      )}

      {info && (
        <div className="stat-grid" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="stat-card">
            <div className="stat-icon blue"><Container size={20} /></div>
            <div className="stat-info">
              <div className="stat-label">Containers</div>
              <div className="stat-value">{info.containers}</div>
              <div className="stat-sub">
                <span style={{ color: 'var(--accent-green)' }}>{info.running} running</span>
                {' · '}{info.stopped} stopped
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><Image size={20} /></div>
            <div className="stat-info">
              <div className="stat-label">Images</div>
              <div className="stat-value">{info.images}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan"><Cog size={20} /></div>
            <div className="stat-info">
              <div className="stat-label">Docker Version</div>
              <div className="stat-value" style={{ fontSize: '1rem' }}>{info.version}</div>
              <div className="stat-sub">Driver: {info.driver}</div>
            </div>
          </div>
        </div>
      )}

      {logsModal && (
        <div className="modal-overlay" onClick={() => setLogsModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <h3 className="modal-title">Logs: {logsModal.name}</h3>
            <pre className="code-block" style={{ maxHeight: '500px' }}>{logsModal.logs || 'No logs available'}</pre>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setLogsModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'containers' ? 'active' : ''}`} onClick={() => setTab('containers')}>
          Containers ({containersData?.containers?.length || 0})
        </button>
        <button className={`tab ${tab === 'images' ? 'active' : ''}`} onClick={() => setTab('images')}>
          Images ({imagesData?.images?.length || 0})
        </button>
        <button className={`tab ${tab === 'volumes' ? 'active' : ''}`} onClick={() => setTab('volumes')}>
          Volumes ({volumesData?.volumes?.length || 0})
        </button>
        <button className={`tab ${tab === 'networks' ? 'active' : ''}`} onClick={() => setTab('networks')}>
          Networks ({networksData?.networks?.length || 0})
        </button>
        <button className={`tab ${tab === 'market' ? 'active' : ''}`} onClick={() => setTab('market')}>
          <ShoppingCart size={14} style={{ marginRight: '6px' }} /> App Store
        </button>
      </div>

      <div className="card">
        {loading && !containersData ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : tab === 'containers' ? (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Image</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(containersData?.containers || []).map((c) => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</td>
                  <td className="mono">{c.image}</td>
                  <td>
                    <span className={`badge ${c.state === 'running' ? 'badge-success' : c.state === 'exited' ? 'badge-danger' : 'badge-warning'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => containerAction(c.id, 'start')} title="Start"><Play size={13} /></button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => containerAction(c.id, 'stop')} title="Stop"><Square size={13} /></button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => containerAction(c.id, 'restart')} title="Restart"><RotateCw size={13} /></button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => viewLogs(c.id, c.name)} title="Logs"><ScrollText size={13} /></button>
                      <button 
                        className="btn btn-sm btn-icon btn-ghost" 
                        disabled={c.state === 'running'}
                        onClick={() => setConfirm({
                          open: true, title: 'Remove Container', message: `Delete container ${c.name}?`, 
                          action: () => containerAction(c.id, 'remove')
                        })} 
                        title={c.state === 'running' ? "Stop container first" : "Remove"}
                        style={{ color: c.state === 'running' ? 'var(--text-muted)' : 'var(--accent-red)' }}
                      >
                        {c.state === 'running' ? <Lock size={13} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'images' ? (
          <table className="data-table">
            <thead><tr><th>Repository</th><th>Size</th><th>In Use</th><th>Actions</th></tr></thead>
            <tbody>
              {(imagesData?.images || []).map((img) => (
                <tr key={img.id}>
                  <td style={{ color: 'var(--text-primary)' }}>{img.tags?.[0] || img.id}</td>
                  <td>{formatSize(img.size)}</td>
                  <td>{img.in_use ? <span className="badge badge-warning">Yes</span> : <span className="badge">No</span>}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-icon btn-ghost" 
                      disabled={img.in_use}
                      onClick={() => setConfirm({
                        open: true, title: 'Remove Image', message: 'Delete this image from the server?', 
                        action: () => removeImage(img.id)
                      })} 
                      title={img.in_use ? "Image in use by a container" : "Remove"}
                      style={{ color: img.in_use ? 'var(--text-muted)' : 'var(--accent-red)' }}
                    >
                      {img.in_use ? <Lock size={14} /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'market' ? (
          <div style={{ padding: 'var(--space-md)' }}>
            {/* Custom Deploy Card (unchanged logic, just ensuring consistency) */}
            <div className="card" style={{ 
              marginBottom: 'var(--space-xl)', 
              background: 'linear-gradient(145deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
              border: '1px solid var(--border-color)',
              padding: 'var(--space-xl)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '10px', borderRadius: '12px' }}>
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '2px' }}>Deploy Application</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Choose your source and start a new container.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                  <button className={`btn btn-sm ${customApp.type === 'image' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCustomApp({...customApp, type: 'image'})} style={{ fontSize: '11px', padding: '6px 16px', borderRadius: '8px' }}><Globe size={14} /> Docker Hub</button>
                  <button className={`btn btn-sm ${customApp.type === 'github' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCustomApp({...customApp, type: 'github'})} style={{ fontSize: '11px', padding: '6px 16px', borderRadius: '8px' }}><Github size={14} /> GitHub Repo</button>
                </div>
              </div>
              <form onSubmit={handleManualInstall} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)', alignItems: 'end' }}>
                <div className="form-group"><label>{customApp.type === 'github' ? 'Repository URL' : 'Image Name'}</label><input className="input" placeholder={customApp.type === 'github' ? 'https://github.com/user/repo' : 'e.g. nginx:latest'} value={customApp.image} onChange={e => setCustomApp({...customApp, image: e.target.value})} required /></div>
                <div className="form-group"><label>Container Name (Optional)</label><input className="input" placeholder="e.g. my-app" value={customApp.name} onChange={e => setCustomApp({...customApp, name: e.target.value})} /></div>
                <div className="form-group"><label>Ports Mapping</label><input className="input" placeholder="e.g. 8080:80" value={customApp.ports} onChange={e => setCustomApp({...customApp, ports: e.target.value})} /></div>
                <button className="btn btn-primary" type="submit" disabled={installing === 'custom'} style={{ height: '46px', fontWeight: 600 }}>{installing === 'custom' ? <RotateCw size={18} className="spin" /> : <Download size={18} />} {customApp.type === 'github' ? 'Build & Deploy' : 'Deploy Now'}</button>
              </form>
            </div>

            <div className="grid-3">
              {MARKET_APPS.map(app => {
                const installed = isAppInstalled(app.containerName);
                const containerId = getAppContainerId(app.containerName);
                return (
                  <div key={app.id} className="app-card" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: 'var(--space-lg)', backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative' }}>
                    {installed && <div style={{ position: 'absolute', top: '12px', right: '12px' }}><span className="badge badge-success">Installed</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-md)' }}><div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '10px', borderRadius: '10px' }}><app.icon size={24} /></div></div>
                    <h3 style={{ marginBottom: '4px', fontSize: '1.1rem' }}>{app.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.4 }}>{app.desc}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-lg)' }}>{app.tags.map(tag => <span key={tag} style={{ fontSize: '10px', backgroundColor: 'var(--border-color)', padding: '2px 8px', borderRadius: '10px' }}>{tag}</span>)}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {!installed ? <button className="btn btn-primary" style={{ width: '100%' }} disabled={installing === app.id} onClick={() => setConfirm({ open: true, title: `Install ${app.name}`, message: `This will pull ${app.image} and create a new container. Continue?`, action: () => installApp(app.id) })}>{installing === app.id ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} Install App</button> : (
                        <><a href={`http://${window.location.hostname}:${app.uiPort}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none', justifyContent: 'center' }}><ExternalLink size={16} /> Open Web UI</a>
                        <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--accent-red)' }} onClick={() => setConfirm({ open: true, title: `Uninstall ${app.name}`, message: `Are you sure you want to remove the ${app.name} container? All data in volumes will be preserved.`, action: () => containerAction(containerId, 'remove') })}><Trash size={16} /> Uninstall</button></>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === 'volumes' ? (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Driver</th><th>In Use</th><th>Actions</th></tr></thead>
            <tbody>
              {(volumesData?.volumes || []).map((v) => (
                <tr key={v.name}>
                  <td style={{ color: 'var(--text-primary)' }}>{v.name}</td>
                  <td>{v.driver}</td>
                  <td>{v.in_use ? <span className="badge badge-warning">Yes</span> : <span className="badge">No</span>}</td>
                  <td>
                    <button 
                      className="btn btn-sm btn-icon btn-ghost" 
                      disabled={v.in_use}
                      title={v.in_use ? "Volume in use by a container" : "Remove"}
                      style={{ color: v.in_use ? 'var(--text-muted)' : 'var(--accent-red)' }}
                    >
                      {v.in_use ? <Lock size={14} /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Driver</th><th>Scope</th></tr></thead>
            <tbody>
              {(networksData?.networks || []).map((n) => (
                <tr key={n.id}>
                  <td style={{ color: 'var(--text-primary)' }}>{n.name}</td>
                  <td>{n.driver}</td>
                  <td>{n.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.action}
        onCancel={() => setConfirm({ ...confirm, open: false })}
      />
    </div>
  );
}
