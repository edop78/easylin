import { useState, useEffect, useRef } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Container, Play, Square, RotateCw, Trash2, RefreshCw, 
  Image, HardDrive, Network, ScrollText, Cog, ShoppingCart, 
  Download, ExternalLink, Globe, Trash, CheckCircle, AlertCircle, Copy, Plus, Github, Lock, Bot, X
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
  },
  {
    id: 'ollama',
    containerName: 'ollama',
    name: 'Ollama AI',
    desc: 'Get up and running with large language models locally.',
    icon: Bot,
    image: 'ollama/ollama:latest',
    tags: ['AI', 'LLM', 'Local'],
    url: 'https://ollama.com/',
    uiPort: 11434
  }
];

export default function Docker() {
  const { data: info } = useApi('/docker/info', { interval: 5000 });
  const { data: containersData, loading, refetch: refetchContainers } = useApi('/docker/containers', { interval: 5000 });
  const { data: imagesData, refetch: refetchImages } = useApi('/docker/images', { interval: 10000 });
  const { data: volumesData, refetch: refetchVolumes } = useApi('/docker/volumes', { interval: 10000 });
  const { data: networksData, refetch: refetchNetworks } = useApi('/docker/networks', { interval: 10000 });
  const { data: marketTasks, refetch: refetchMarket } = useApi('/docker/market/status', { interval: 3000 });
  
  const [tab, setTab] = useState('containers');
  const [logsModal, setLogsModal] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [installing, setInstalling] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });
  
  const [customApp, setCustomApp] = useState({ type: 'image', image: '', name: '', ports: '' });
  const [activeTaskLogs, setActiveTaskLogs] = useState(null);
  const [persistedLogs, setPersistedLogs] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    let interval;
    if (activeTaskLogs) {
      const fetchFileLogs = async () => {
        try {
          const res = await api.get('/docker/market/logs/file');
          if (res.logs && res.logs.length > 0) {
            setPersistedLogs(res.logs);
          }
        } catch (err) {
          console.error("Failed to fetch file logs", err);
        }
      };

      fetchFileLogs();
      interval = setInterval(fetchFileLogs, 2000);
    } else {
      setPersistedLogs([]);
    }
    return () => clearInterval(interval);
  }, [activeTaskLogs]);

  useEffect(() => {
    if (activeTaskLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [persistedLogs, activeTaskLogs]);

  useEffect(() => {
    if (msg) {
      const timeout = msg.type === 'success' && msg.text.includes('background') ? 20000 : 10000;
      const timer = setTimeout(() => setMsg(null), timeout);
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
      const app = MARKET_APPS.find(a => a.id === appId);
      await api.post('/docker/market/install', { app_id: appId });
      
      // FORCED: Open the log window immediately
      setActiveTaskLogs({ id: appId, name: app?.name || appId });
      
      setTimeout(() => refetchMarket(), 500);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
      setInstalling(null);
    }
  };

  useEffect(() => {
    if (installing && marketTasks?.tasks?.[installing]) {
      setInstalling(null);
    }
  }, [marketTasks, installing]);

  const clearTask = async (appId) => {
    try {
      await api.post(`/docker/market/clear/${appId}`);
      // marketTasks will refetch automatically via useApi interval
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
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

  const removeVolume = async (name) => {
    try {
      await api.del(`/docker/volumes/${name}`);
      setMsg({ type: 'success', text: 'Volume removed successfully' });
      refetchVolumes();
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

  // Ensure stats don't crash
  const stats = [
    { 
      label: 'Containers', 
      value: info?.containers ?? containersData?.containers?.length ?? 0, 
      icon: Container, 
      color: 'blue',
      sub: `${info?.running || 0} Running`
    },
    { 
      label: 'Images', 
      value: info?.images ?? imagesData?.images?.length ?? 0, 
      icon: Image, 
      color: 'purple',
      sub: 'Stored locally'
    },
    { 
      label: 'Volumes', 
      value: info?.volumes ?? volumesData?.volumes?.length ?? 0, 
      icon: HardDrive, 
      color: 'amber',
      sub: 'Persisted data'
    },
    { 
      label: 'Networks', 
      value: networksData?.networks?.length ?? 0, 
      icon: Network, 
      color: 'emerald',
      sub: 'Docker bridges'
    }
  ];

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

      <div className="stat-grid" style={{ marginBottom: 'var(--space-lg)' }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${s.color}`}><s.icon size={20} /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

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

      {activeTaskLogs && (
        <div className="modal-overlay" onClick={() => setActiveTaskLogs(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RotateCw size={18} className={marketTasks?.tasks?.[activeTaskLogs.id]?.status === 'installing' ? 'spin' : ''} />
                Installation Logs: {activeTaskLogs.name}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => refetchMarket()} title="Refresh logs from server">
                  <RefreshCw size={14} /> Refresh
                </button>
                {marketTasks?.tasks?.[activeTaskLogs.id]?.status === 'installing' && (
                  <span style={{ fontSize: '10px', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', animation: 'pulse 1s infinite' }} /> LIVE
                  </span>
                )}
              </div>
            </h3>
            <div style={{ backgroundColor: '#000', borderRadius: '8px', padding: '15px', marginTop: '15px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                className="btn btn-sm btn-ghost" 
                style={{ position: 'absolute', top: '10px', right: '10px', color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 10 }}
                onClick={() => {
                  const text = persistedLogs.join('\n');
                  navigator.clipboard.writeText(text);
                  setMsg({ type: 'success', text: 'Logs copied to clipboard!' });
                }}
              >
                <Copy size={14} /> Copy
              </button>
              <pre style={{ 
                maxHeight: '450px', 
                overflowY: 'auto', 
                margin: 0, 
                color: '#22c55e', 
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.6,
                paddingRight: '60px'
              }}>
                {persistedLogs.length > 0 ? (
                  persistedLogs.map((line, i) => (
                    <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px', marginBottom: '2px' }}>
                      <span style={{ opacity: 0.4, marginRight: '10px', fontSize: '10px' }}>[{i+1}]</span>
                      {line}
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#888', fontStyle: 'italic' }}>
                    &gt; Waiting for console handshake...<br/>
                    &gt; [Check backend logs if this persists]
                  </div>
                )}
                <div ref={logsEndRef} />
              </pre>
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-ghost" onClick={() => setActiveTaskLogs(null)}>Close</button>
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

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', 
              gap: 'var(--space-lg)',
              marginTop: 'var(--space-md)'
            }}>
              {MARKET_APPS.map(app => {
                const installed = isAppInstalled(app.containerName);
                const containerId = getAppContainerId(app.containerName);
                const task = marketTasks?.tasks?.[app.id];
                const isInstalling = task?.status === 'installing';
                const hasError = task?.status === 'error';

                return (
                  <div key={app.id} className="app-card" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: 'var(--space-lg)', backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative' }}>
                    {installed && !task && <div style={{ position: 'absolute', top: '12px', right: '12px' }}><span className="badge badge-success">Installed</span></div>}
                    {(isInstalling || (installed && task)) && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          className="btn btn-sm btn-ghost" 
                          onClick={(e) => { e.stopPropagation(); clearTask(app.id); }}
                          style={{ padding: '2px', color: 'var(--accent-red)', minWidth: 'auto', height: 'auto' }}
                          title="Clear status and hide log button"
                        >
                          <X size={14} />
                        </button>
                        <span className={`badge ${installed ? 'badge-success' : 'badge-warning'}`}>
                          {installed ? <Check size={10} /> : <RotateCw size={10} className="spin" />} {installed ? 'Installed' : (task?.message || 'Installing...')}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-md)' }}><div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '10px', borderRadius: '10px' }}><app.icon size={24} /></div></div>
                    <h3 style={{ marginBottom: '4px', fontSize: '1.1rem' }}>{app.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.4 }}>{app.desc}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-lg)' }}>{app.tags.map(tag => <span key={tag} style={{ fontSize: '10px', backgroundColor: 'var(--border-color)', padding: '2px 8px', borderRadius: '10px' }}>{tag}</span>)}</div>
                    
                    {hasError && !installed && (
                      <div className="alert alert-danger" style={{ fontSize: '11px', padding: '8px', marginBottom: '12px' }}>
                        <AlertCircle size={12} /> {task.error}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Show View Logs if installing (backend or local state), error, or if a task exists even if installed */}
                      {(isInstalling || installing === app.id || hasError || (installed && task)) && (
                        <button 
                          className="btn btn-primary" 
                          style={{ width: '100%', backgroundColor: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }} 
                          onClick={() => setActiveTaskLogs({ id: app.id, name: app.name })}
                        >
                          <ScrollText size={16} /> {isInstalling || installing === app.id ? 'View Progress' : 'View Installation Logs'}
                        </button>
                      )}

                      {!installed ? (
                        <button 
                          className="btn btn-primary" 
                          style={{ width: '100%' }} 
                          disabled={installing === app.id || isInstalling} 
                          onClick={() => setConfirm({ 
                            open: true, 
                            title: `Install ${app.name}`, 
                            message: `This will pull ${app.image} and create a new container. Continue?`, 
                            action: () => installApp(app.id) 
                          })}
                        >
                          {installing === app.id || isInstalling ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} 
                          {isInstalling || installing === app.id ? 'Installing...' : 'Install App'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          <a href={`http://${window.location.hostname}:${app.uiPort}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
                            <ExternalLink size={16} /> Web UI
                          </a>
                          <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--accent-red)' }} onClick={() => setConfirm({ open: true, title: `Uninstall ${app.name}`, message: `Are you sure you want to remove the ${app.name} container? All data in volumes will be preserved.`, action: () => containerAction(containerId, 'remove') })}>
                            <Trash size={16} /> Uninstall
                          </button>
                        </div>
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
                      onClick={() => setConfirm({
                        open: true, title: 'Remove Volume', message: `Delete volume ${v.name}? This action cannot be undone.`, 
                        action: () => removeVolume(v.name)
                      })} 
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
