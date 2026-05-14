import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Cog, RefreshCw, Play, Square, RotateCw, ScrollText, 
  CheckCircle, AlertCircle, Search, Power, ShieldCheck, ShieldAlert, Copy
} from 'lucide-react';

export default function Services() {
  const { data, loading, error, refetch } = useApi('/services');
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [logsModal, setLogsModal] = useState(null);
  const [msg, setMsg] = useState(null);

  // Auto-hide messages
  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const handleAction = async (name, action) => {
    setActionLoading(`${name}-${action}`);
    try {
      await api.post(`/services/${name}/${action}`);
      setMsg({ type: 'success', text: `Service ${name} ${action}ed successfully` });
      refetch();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const viewLogs = async (name) => {
    try {
      const res = await api.get(`/services/${name}/logs`);
      setLogsModal({ name, logs: res.logs });
    } catch (err) {
      setMsg({ type: 'error', text: `Failed to load logs: ${err.message}` });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMsg({ type: 'success', text: 'Error message copied to clipboard!' });
  };

  const filteredServices = (data?.services || []).filter(s => 
    s.name.toLowerCase().includes(filter.toLowerCase()) || 
    s.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Cog size={28} /><h1>System Services</h1></div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              className="input" 
              placeholder="Search services..." 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ paddingLeft: '36px', width: '250px' }}
            />
          </div>
          <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          {msg.type === 'error' && (
            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard(msg.text)}>
              <Copy size={14} /> Copy
            </button>
          )}
        </div>
      )}

      <div className="card">
        {loading && !data ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : error ? (
          <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Status</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length > 0 ? filteredServices.map((s) => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className={`badge ${s.active === 'active' ? 'badge-success' : s.active === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {s.active}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>({s.sub})</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.description}>
                    {s.description}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="btn btn-sm btn-icon btn-ghost" 
                        onClick={() => handleAction(s.name, 'start')}
                        title="Start Service"
                      >
                        <Play size={13} />
                      </button>
                      <button 
                        className="btn btn-sm btn-icon btn-ghost" 
                        onClick={() => handleAction(s.name, 'stop')}
                        title="Stop Service"
                      >
                        <Square size={13} />
                      </button>
                      <button 
                        className="btn btn-sm btn-icon btn-ghost" 
                        onClick={() => handleAction(s.name, 'restart')}
                        title="Restart Service"
                      >
                        <RotateCw size={13} />
                      </button>
                      <button 
                        className="btn btn-sm btn-icon btn-ghost" 
                        onClick={() => viewLogs(s.name)}
                        title="View Logs"
                      >
                        <ScrollText size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>No services found matching your search.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {logsModal && (
        <div className="modal-overlay" onClick={() => setLogsModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <h3 className="modal-title">Logs: {logsModal.name}.service</h3>
            <pre className="code-block" style={{ maxHeight: '500px', fontSize: '11px' }}>
              {logsModal.logs || 'No logs found for this service.'}
            </pre>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setLogsModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
