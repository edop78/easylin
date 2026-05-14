import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Package, Search, Download, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function Packages() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState(null);
  const { data, loading, refetch } = useApi(`/packages/installed?search=${search}`);

  const handleSearch = async () => {
    if (search.length < 2) return;
    setSearching(true);
    try {
      const result = await api.get(`/packages/search?q=${encodeURIComponent(search)}`);
      setSearchResults(result.packages);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSearching(false);
    }
  };

  const installPackage = async (name) => {
    if (!confirm(`Install package "${name}"?`)) return;
    setActionLoading(name);
    setMessage(null);
    try {
      const result = await api.post('/packages/install', { name });
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.success ? `${name} installed successfully` : result.error,
      });
      if (result.success) refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading('');
    }
  };

  const removePackage = async (name) => {
    if (!confirm(`Remove package "${name}"? This cannot be undone.`)) return;
    setActionLoading(name);
    setMessage(null);
    try {
      const result = await api.post('/packages/remove', { name });
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.success ? `${name} removed` : result.error,
      });
      if (result.success) refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading('');
    }
  };

  const [tab, setTab] = useState('installed');

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <Package size={28} />
          <h1>Packages</h1>
        </div>
        <button className="btn btn-ghost" onClick={refetch}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            className="form-input"
            placeholder="Search packages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button className="btn btn-primary" onClick={handleSearch} disabled={searching || search.length < 2}>
          {searching ? <div className="spinner spinner-sm" /> : <Search size={15} />}
          Search Available
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'installed' ? 'active' : ''}`} onClick={() => { setTab('installed'); setSearchResults(null); }}>
          Installed ({data?.count || 0})
        </button>
        {searchResults && (
          <button className={`tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
            Available ({searchResults.length})
          </button>
        )}
      </div>

      {/* Package List */}
      <div className="card">
        {loading && !data ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : tab === 'installed' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Version</th>
                <th style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.packages || []).map((pkg) => (
                <tr key={pkg.name}>
                  <td style={{ color: 'var(--text-primary)' }}>{pkg.name}</td>
                  <td className="mono">{pkg.version}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => removePackage(pkg.name)}
                      disabled={actionLoading === pkg.name}
                      title="Remove"
                    >
                      {actionLoading === pkg.name ? <div className="spinner spinner-sm" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Description</th>
                <th style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(searchResults || []).map((pkg) => (
                <tr key={pkg.name}>
                  <td style={{ color: 'var(--text-primary)' }}>{pkg.name}</td>
                  <td>{pkg.description}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm btn-icon"
                      onClick={() => installPackage(pkg.name)}
                      disabled={actionLoading === pkg.name}
                      title="Install"
                    >
                      {actionLoading === pkg.name ? <div className="spinner spinner-sm" /> : <Download size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
