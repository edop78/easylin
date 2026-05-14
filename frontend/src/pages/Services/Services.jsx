import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Cog, Search, Play, Square, RefreshCw, RotateCw, CheckCircle, XCircle } from 'lucide-react';

export default function Services() {
  const { data, loading, refetch } = useApi('/services/');
  const [filter, setFilter] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [statusDetail, setStatusDetail] = useState(null);

  const doAction = async (name, action) => {
    setActionLoading(`${name}-${action}`);
    try {
      await api.post(`/services/${name}/${action}`);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const viewStatus = async (name) => {
    try {
      const result = await api.get(`/services/${name}/status`);
      setStatusDetail(result);
    } catch (err) {
      alert(err.message);
    }
  };

  const services = (data?.services || []).filter(
    (s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <Cog size={28} />
          <h1>Services</h1>
        </div>
        <button className="btn btn-ghost" onClick={refetch}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="search-bar" style={{ marginBottom: 'var(--space-lg)' }}>
        <Search size={16} />
        <input className="form-input" placeholder="Filter services..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {/* Status Detail Modal */}
      {statusDetail && (
        <div className="modal-overlay" onClick={() => setStatusDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3 className="modal-title">{statusDetail.name}</h3>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <span className={`badge ${statusDetail.active ? 'badge-success' : 'badge-danger'}`}>
                {statusDetail.active ? 'Active' : 'Inactive'}
              </span>
              <span className={`badge ${statusDetail.enabled ? 'badge-info' : 'badge-neutral'}`}>
                {statusDetail.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <pre className="code-block">{statusDetail.output}</pre>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setStatusDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {loading && !data ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Service</th><th>Status</th><th>Sub-state</th><th>Description</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name}>
                  <td>
                    <span style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => viewStatus(s.name)}>
                      {s.name}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${s.active === 'active' ? 'badge-success' : s.active === 'failed' ? 'badge-danger' : 'badge-neutral'}`}>
                      {s.active}
                    </span>
                  </td>
                  <td className="mono">{s.sub}</td>
                  <td>{s.description}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => doAction(s.name, 'start')}
                        disabled={actionLoading === `${s.name}-start`} title="Start">
                        <Play size={13} />
                      </button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => doAction(s.name, 'stop')}
                        disabled={actionLoading === `${s.name}-stop`} title="Stop">
                        <Square size={13} />
                      </button>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => doAction(s.name, 'restart')}
                        disabled={actionLoading === `${s.name}-restart`} title="Restart">
                        <RotateCw size={13} />
                      </button>
                    </div>
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
