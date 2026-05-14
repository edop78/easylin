import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Settings, Power, RotateCw, Server, Clock, HardDrive, CheckCircle, AlertCircle, Cpu, Monitor, Globe, Shield, Activity } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function System() {
  const { data, loading, error, refetch } = useApi('/system/info');
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

  if (error) {
    return (
      <div className="page fade-in">
        <div className="page-header">
          <div className="page-title"><Settings size={28} /><h1>System Management</h1></div>
        </div>
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <div><strong>Error loading system info:</strong> {error}</div>
          <button className="btn btn-sm btn-ghost" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Settings size={28} /><h1>System Management</h1></div>
        <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
          <RotateCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'info' ? 'warning' : msg.type}`} style={{ marginBottom: 'var(--space-lg)' }}>
          {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {msg.text}
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
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

        {/* Unified System Details */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Server size={16} /> System Details</div></div>
          {loading && !data ? <div className="spinner" /> : (
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="stat-info">
                <div className="stat-label"><Monitor size={14} /> Hostname</div>
                <div className="stat-value">{data?.hostname || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Globe size={14} /> Local IP</div>
                <div className="stat-value">{data?.local_ip || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Globe size={14} /> Public IP</div>
                <div className="stat-value">{data?.public_ip || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Server size={14} /> Operating System</div>
                <div className="stat-value">{data?.os || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Shield size={14} /> Virtualization</div>
                <div className="stat-value" style={{ textTransform: 'capitalize' }}>{data?.virtualization || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Settings size={14} /> Kernel</div>
                <div className="stat-value">{data?.kernel || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><HardDrive size={14} /> Architecture</div>
                <div className="stat-value">{data?.arch || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Cpu size={14} /> CPU Cores</div>
                <div className="stat-value">{data?.cpu_count || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Clock size={14} /> Uptime</div>
                <div className="stat-value">{data?.uptime || 'N/A'}</div>
              </div>
              <div className="stat-info">
                <div className="stat-label"><Activity size={14} /> Last Boot</div>
                <div className="stat-value" style={{ fontSize: '11px' }}>{data?.boot_time || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
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
