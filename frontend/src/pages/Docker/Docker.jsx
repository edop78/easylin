import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Container, Play, Square, RotateCw, Trash2, RefreshCw, 
  Image, HardDrive, Network, ScrollText, Cog, ShoppingCart, 
  Download, ExternalLink, ShieldCheck, Globe
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
    name: 'Nginx Proxy Manager',
    desc: 'Expose your services easily and securely with SSL.',
    icon: Globe,
    image: 'jc21/nginx-proxy-manager:latest',
    tags: ['Proxy', 'SSL', 'Security'],
    url: 'https://nginxproxymanager.com/'
  }
];

export default function Docker() {
  const { data: info } = useApi('/docker/info');
  const { data: containersData, loading, refetch } = useApi('/docker/containers');
  const { data: imagesData, refetch: refetchImages } = useApi('/docker/images');
  const { data: volumesData } = useApi('/docker/volumes');
  const { data: networksData } = useApi('/docker/networks');
  
  const [tab, setTab] = useState('containers');
  const [logsModal, setLogsModal] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [installing, setInstalling] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const containerAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      await api.post(`/docker/containers/${id}/${action}`);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const installApp = async (appId) => {
    setInstalling(appId);
    try {
      const res = await api.post('/docker/market/install', { app_id: appId });
      alert(res.message);
      setTab('containers');
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setInstalling(null);
    }
  };

  const viewLogs = async (id, name) => {
    try {
      const result = await api.get(`/docker/containers/${id}/logs?tail=100`);
      setLogsModal({ name, logs: result.logs });
    } catch (err) {
      alert(err.message);
    }
  };

  const removeImage = async (id) => {
    try {
      await api.del(`/docker/images/${id}`);
      refetchImages();
    } catch (err) {
      alert(err.message);
    }
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
        <button className="btn btn-ghost" onClick={() => { refetch(); refetchImages(); }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

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
        <button className={`tab ${tab === 'market' ? 'active' : ''}`} onClick={() => setTab('market')}>
          <ShoppingCart size={14} style={{ marginRight: '6px' }} /> App Store
        </button>
        <button className={`tab ${tab === 'volumes' ? 'active' : ''}`} onClick={() => setTab('volumes')}>
          Volumes
        </button>
        <button className={`tab ${tab === 'networks' ? 'active' : ''}`} onClick={() => setTab('networks')}>
          Networks
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
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                        open: true, title: 'Remove Container', message: `Delete container ${c.name}?`, 
                        action: () => containerAction(c.id, 'remove')
                      })} title="Remove" style={{ color: 'var(--accent-red)' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'images' ? (
          <table className="data-table">
            <thead><tr><th>Repository</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              {(imagesData?.images || []).map((img) => (
                <tr key={img.id}>
                  <td style={{ color: 'var(--text-primary)' }}>{img.tags?.[0] || img.id}</td>
                  <td>{formatSize(img.size)}</td>
                  <td>
                    <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                      open: true, title: 'Remove Image', message: 'Delete this image from the server?', 
                      action: () => removeImage(img.id)
                    })} title="Remove" style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'market' ? (
          <div className="grid-3" style={{ padding: 'var(--space-md)' }}>
            {MARKET_APPS.map(app => (
              <div key={app.id} className="app-card" style={{ 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: 'var(--space-lg)',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-md)' }}>
                  <div style={{ backgroundColor: 'var(--accent-blue)', padding: '10px', borderRadius: '10px', color: 'white' }}>
                    <app.icon size={24} />
                  </div>
                  <a href={app.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                    <ExternalLink size={16} />
                  </a>
                </div>
                <h3 style={{ marginBottom: '4px', fontSize: '1.1rem' }}>{app.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.4 }}>{app.desc}</p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-lg)' }}>
                  {app.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '10px', backgroundColor: 'var(--border-color)', padding: '2px 8px', borderRadius: '10px' }}>{tag}</span>
                  ))}
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  disabled={installing === app.id}
                  onClick={() => setConfirm({
                    open: true,
                    title: `Install ${app.name}`,
                    message: `This will pull ${app.image} and create a new container. Continue?`,
                    action: () => installApp(app.id)
                  })}
                >
                  {installing === app.id ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
                  {installing === app.id ? 'Installing...' : 'Install App'}
                </button>
              </div>
            ))}
          </div>
        ) : tab === 'volumes' ? (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Driver</th><th>Mountpoint</th></tr></thead>
            <tbody>
              {(volumesData?.volumes || []).map((v) => (
                <tr key={v.name}>
                  <td style={{ color: 'var(--text-primary)' }}>{v.name}</td>
                  <td>{v.driver}</td>
                  <td className="mono">{v.mountpoint}</td>
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
