import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Package, Search, Trash2, Download, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Packages() {
  const { data, loading, refetch } = useApi('/packages/');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const searchPackages = async (e) => {
    e.preventDefault();
    if (!query) return;
    setSearching(true);
    try {
      const result = await api.get(`/packages/search?q=${query}`);
      setSearchResults(result.packages);
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
          <input className="form-input" placeholder="Search packages (e.g. nginx, docker, git)..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? <div className="spinner spinner-sm" /> : 'Search'}</button>
        </form>
      </div>

      {searchResults && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header"><div className="card-title"><Search size={16} /> Search Results</div></div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              {searchResults.map((pkg) => (
                <tr key={pkg.name}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pkg.name}</td>
                  <td>{pkg.description}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => setConfirm({
                      open: true, title: 'Install Package', message: `Install ${pkg.name}?`,
                      action: () => handleAction(pkg.name, 'install'), type: 'info'
                    })} disabled={actionLoading === `${pkg.name}-install`}>
                      <Download size={13} /> Install
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title"><Package size={16} /> Installed Packages</div></div>
        {loading ? <div className="loading-container"><div className="spinner" /></div> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Version</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.packages || []).map((pkg) => (
                <tr key={pkg.name}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{pkg.name}</td>
                  <td className="mono">{pkg.version}</td>
                  <td>
                    <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                      open: true, title: 'Uninstall Package', message: `Remove ${pkg.name}? This might affect other software.`,
                      action: () => handleAction(pkg.name, 'remove')
                    })} style={{ color: 'var(--accent-red)' }} title="Uninstall"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal isOpen={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })} type={confirm.type || 'danger'} />
    </div>
  );
}
