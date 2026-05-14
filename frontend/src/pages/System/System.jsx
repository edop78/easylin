import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Settings, Power, RotateCw, Server, Clock, HardDrive, CheckCircle, AlertCircle } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function System() {
  const { data, loading } = useApi('/system/info');
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const handleAction = async (action) => {
    try {
      await api.post(`/system/${action}`);
      setMsg({ type: 'success', text: `System ${action} initiated` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Settings size={28} /><h1>System Management</h1></div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'info' ? 'warning' : msg.type}`} style={{ marginBottom: 'var(--space-lg)' }}>
          {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {msg.text}
        </div>
      )}

      <div className="grid-2">
        {/* Power Controls */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Power size={16} /> Power Actions</div></div>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button className="btn btn-danger" onClick={() => setConfirm({ 
              open: true, title: 'Reboot System', message: 'Are you sure you want to reboot the server?', 
              action: () => handleAction('reboot') 
            })}>
              <RotateCw size={15} /> Reboot
            </button>
            <button className="btn btn-ghost" style={{ color: 'var(--accent-red)' }} onClick={() => setConfirm({ 
              open: true, title: 'Shutdown System', message: 'Are you sure you want to power off the server?', 
              action: () => handleAction('shutdown') 
            })}>
              <Power size={15} /> Shutdown
            </button>
          </div>
        </div>

        {/* Hardware Info Card moved here to fill the grid or stay separate */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Server size={16} /> Hardware & OS Details</div></div>
          {loading ? <div className="spinner" /> : (
            <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="stat-info">
                <div className="stat-label"><Clock size={14} /> Hostname</div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>{data?.hostname}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Server size={14} /> OS</div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>{data?.os}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Details Card */}
      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card-header"><div className="card-title"><Settings size={16} /> Technical Info</div></div>
        {loading ? <div className="spinner" /> : (
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="stat-info">
              <div className="stat-label">Architecture</div>
              <div className="stat-value">{data?.arch}</div>
            </div>
            <div className="stat-info">
              <div className="stat-label">Kernel</div>
              <div className="stat-value">{data?.kernel}</div>
            </div>
            <div className="stat-info">
              <div className="stat-label">Uptime</div>
              <div className="stat-value">{data?.uptime}</div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.action}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        type={confirm.type || 'danger'}
      />
    </div>
  );
}
