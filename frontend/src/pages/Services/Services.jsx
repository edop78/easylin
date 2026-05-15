import { useState, useEffect, useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Cog, RefreshCw, Play, Square, RotateCw, ScrollText, 
  CheckCircle, AlertCircle, Search, Copy, ChevronUp, ChevronDown
} from 'lucide-react';

export default function Services() {
  const { data, loading, error, refetch } = useApi('/services/');
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [logsModal, setLogsModal] = useState(null);
  const [msg, setMsg] = useState(null);
  
  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

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

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedServices = useMemo(() => {
    let items = [...(data?.services || [])];
    
    // Filter
    if (filter) {
      items = items.filter(s => 
        s.name.toLowerCase().includes(filter.toLowerCase()) || 
        s.description.toLowerCase().includes(filter.toLowerCase())
      );
    }

    // Sort
    items.sort((a, b) => {
      const valA = a[sortConfig.key].toLowerCase();
      const valB = b[sortConfig.key].toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [data, filter, sortConfig]);

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '8px', borderRadius: '10px', marginRight: '12px' }}>
            <Cog size={24} />
          </div>
          <h1>System Services</h1>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              className="input" 
              placeholder="Search services..." 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ paddingLeft: '42px', width: '280px', height: '42px' }}
            />
          </div>
          <button className="btn btn-ghost" onClick={refetch} disabled={loading} style={{ height: '42px' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && !data ? (
          <div className="loading-container" style={{ padding: '40px' }}><div className="spinner" /></div>
        ) : error ? (
          <div className="alert alert-error" style={{ margin: '20px' }}><AlertCircle size={16} /> {error}</div>
        ) : (
          <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th 
                  style={{ padding: '16px 24px', width: '25%', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => requestSort('name')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Service Name <SortIcon column="name" />
                  </div>
                </th>
                <th 
                  style={{ padding: '16px 24px', width: '15%', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => requestSort('active')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Status <SortIcon column="active" />
                  </div>
                </th>
                <th style={{ padding: '16px 24px', width: '40%' }}>Description</th>
                <th style={{ padding: '16px 24px', width: '20%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedServices.length > 0 ? sortedServices.map((s) => (
                <tr key={s.name} className="hover-row">
                  <td style={{ padding: '14px 24px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className={`badge ${s.active === 'active' ? 'badge-success' : s.active === 'failed' ? 'badge-danger' : 'badge-warning'}`} style={{ width: 'fit-content', padding: '1px 8px', fontSize: '10px' }}>
                        {s.active}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.description}>
                      {s.description || 'No description available'}
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => handleAction(s.name, 'start')} title="Start"><Play size={14} /></button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => handleAction(s.name, 'stop')} title="Stop"><Square size={14} /></button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => handleAction(s.name, 'restart')} title="Restart"><RotateCw size={14} className={actionLoading === `${s.name}-restart` ? 'spin' : ''} /></button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => viewLogs(s.name)} title="View Logs"><ScrollText size={14} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No services found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {logsModal && (
        <div className="modal-overlay" onClick={() => setLogsModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <h3 className="modal-title">Logs: {logsModal.name}.service</h3>
            <pre className="code-block" style={{ maxHeight: '550px', fontSize: '11px', overflow: 'auto', backgroundColor: '#000', padding: '20px' }}>
              {logsModal.logs || 'No logs found.'}
            </pre>
            <div className="modal-actions"><button className="btn btn-primary" onClick={() => setLogsModal(null)}>Close</button></div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-row:hover { background-color: rgba(255, 255, 255, 0.02) !important; }
        .data-table th, .data-table td { border-bottom: 1px solid var(--border-color); }
      `}} />
    </div>
  );
}
