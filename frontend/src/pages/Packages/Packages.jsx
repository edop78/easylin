import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Package, Search, Trash2, Download, RefreshCw, AlertCircle, CheckCircle, Star, List } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

const COMMON_APPS = [
  { name: 'nginx', desc: 'High-performance Web Server & Reverse Proxy' },
  { name: 'apache2', desc: 'The classic Apache HTTP Server' },
  { name: 'mysql-server', desc: 'MySQL Database Server' },
  { name: 'postgresql', desc: 'PostgreSQL Object-Relational Database' },
  { name: 'redis-server', desc: 'In-memory Data Structure Store' },
  { name: 'nodejs', desc: 'JavaScript Runtime Environment' },
  { name: 'python3-pip', desc: 'Python Package Index Installer' },
  { name: 'certbot', desc: 'Let\'s Encrypt SSL Certificate Tool' },
  { name: 'fail2ban', desc: 'Intrusion Prevention Framework' },
  { name: 'htop', desc: 'Interactive Process Viewer' },
  { name: 'git', desc: 'Distributed Version Control System' },
  { name: 'curl', desc: 'Command line tool for transferring data' },
  { name: 'vim', desc: 'Advanced Text Editor' },
  { name: 'tmux', desc: 'Terminal Multiplexer' },
  { name: 'ufw', desc: 'Uncomplicated Firewall' },
  { name: 'zip', desc: 'Archive compression utility' },
];

export default function Packages() {
  const { data, loading, refetch } = useApi('/packages/');
  const [tab, setTab] = useState('common'); // This is the "Available" tab
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const installedNames = new Set((data?.packages || []).map(p => p.name));

  const searchPackages = async (e) => {
    e.preventDefault();
    if (!query) return;
    setSearching(true);
    try {
      const result = await api.get(`/packages/search?q=${query}`);
      setSearchResults(result.packages);
      setTab('search');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSearching(false);
    }
  };

  const handleAction = async (name, action) => {
    setActionLoading(`${name}-${action}`);
    try {
      const result = await api.post(`/packages/${action}`, { name });
      setMessage({ type: result.success ? 'success' : 'error', text: result.success ? `Package ${name} ${action}ed` : result.error });
      if (result.success) refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Package size={28} /><h1>Packages</h1></div>
        <button className="btn btn-ghost" onClick={refetch}><RefreshCw size={15} /> Refresh</button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-lg)' }}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <form onSubmit={searchPackages} className="search-bar">
          <Search size={18} />
          <input className="form-input" placeholder="Search for any package..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? <div className="spinner spinner-sm" /> : 'Search'}</button>
        </form>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'common' ? 'active' : ''}`} onClick={() => setTab('common')}>
          <Star size={14} /> Available
        </button>
        <button className={`tab ${tab === 'installed' ? 'active' : ''}`} onClick={() => setTab('installed')}>
          <List size={14} /> Installed ({data?.packages?.length || 0})
        </button>
        {searchResults && (
          <button className={`tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>
            <Search size={14} /> Search Results
          </button>
        )}
      </div>

      <div className="card">
        {loading && !data ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : tab === 'common' ? (
          <table className="data-table">
            <thead><tr><th>App</th><th>Description</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {COMMON_APPS.map((app) => {
                const isInstalled = installedNames.has(app.name);
                return (
                  <tr key={app.name}>
                    <td><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{app.name}</div></td>
                    <td>{app.desc}</td>
                    <td>
                      <span className={`badge ${isInstalled ? 'badge-success' : 'badge-neutral'}`}>
                        {isInstalled ? 'Installed' : 'Not Installed'}
                      </span>
                    </td>
                    <td>
                      {!isInstalled ? (
                        <button className="btn btn-sm btn-primary" onClick={() => setConfirm({
                          open: true, title: 'Install App', message: `Install ${app.name}?`,
                          action: () => handleAction(app.name, 'install'), type: 'info', confirmText: 'Install'
                        })} disabled={actionLoading === `${app.name}-install`}>
                          <Download size={13} /> Install
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-ghost" onClick={() => setConfirm({
                          open: true, title: 'Uninstall App', message: `Are you sure you want to uninstall ${app.name}?`,
                          action: () => handleAction(app.name, 'remove'), type: 'danger', confirmText: 'Uninstall'
                        })} style={{ color: 'var(--accent-red)' }} disabled={actionLoading === `${app.name}-remove`}>
                          <Trash2 size={13} /> Uninstall
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : tab === 'installed' ? (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Version</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.packages || []).map((pkg) => (
                <tr key={pkg.name}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pkg.name}</td>
                  <td className="mono">{pkg.version}</td>
                  <td>
                    <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                      open: true, title: 'Uninstall', message: `Remove ${pkg.name}?`,
                      action: () => handleAction(pkg.name, 'remove')
                    })} style={{ color: 'var(--accent-red)' }} title="Uninstall"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {(!data?.packages || data?.packages.length === 0) && !loading && (
                <tr>
                  <td colSpan="3" className="empty-state">
                    {data?.error ? (
                      <div style={{ color: 'var(--accent-red)' }}>Error loading packages: {data.error}</div>
                    ) : (
                      "No installed packages found."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              {(searchResults || []).map((pkg) => (
                <tr key={pkg.name}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pkg.name}</td>
                  <td>{pkg.description}</td>
                  <td>
                    {!installedNames.has(pkg.name) ? (
                      <button className="btn btn-sm btn-primary" onClick={() => setConfirm({
                        open: true, title: 'Install', message: `Install ${pkg.name}?`,
                        action: () => handleAction(pkg.name, 'install'), type: 'info', confirmText: 'Install'
                      })} disabled={actionLoading === `${pkg.name}-install`}>
                        <Download size={13} /> Install
                      </button>
                    ) : (
                      <span className="badge badge-success">Installed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal isOpen={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })} type={confirm.type || 'danger'} confirmText={confirm.confirmText} />
    </div>
  );
}
