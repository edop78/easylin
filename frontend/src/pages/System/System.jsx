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

  const systemFields = [
    { label: 'Hostname', value: data?.hostname, icon: Monitor },
    { label: 'Local IP', value: data?.local_ip, icon: Globe },
    { label: 'Public IP', value: data?.public_ip, icon: Globe },
    { label: 'OS', value: data?.os, icon: Server },
    { label: 'Virtualization', value: data?.virtualization, icon: Shield },
    { label: 'Kernel', value: data?.kernel, icon: Settings },
    { label: 'Architecture', value: data?.arch, icon: HardDrive },
    { label: 'CPU Cores', value: data?.cpu_count, icon: Cpu },
    { label: 'Uptime', value: data?.uptime, icon: Clock },
    { label: 'Last Boot', value: data?.boot_time, icon: Activity },
  ];

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

      {/* Full-width horizontal System Details */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card-header">
          <div className="card-title"><Server size={16} /> System Information</div>
        </div>
        {loading && !data ? <div className="spinner" /> : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
            gap: 'var(--space-lg)',
            padding: 'var(--space-sm) 0'
          }}>
            {systemFields.map((field, idx) => (
              <div key={idx} className="stat-info" style={{ borderBottom: 'none' }}>
                <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <field.icon size={14} /> {field.label}
                </div>
                <div className="stat-value" style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                  {field.value || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact Power Actions below */}
      <div className="card" style={{ maxWidth: '400px' }}>
        <div className="card-header"><div className="card-title"><Power size={16} /> Power Controls</div></div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button className="btn btn-danger" onClick={() => setConfirm({ 
            open: true, title: 'Reboot System', message: 'Are you sure you want to reboot the server?', 
            action: () => handleAction('reboot') 
          })}>
            <RotateCw size={15} /> Reboot System
          </button>
          <button className="btn btn-ghost" style={{ color: 'var(--accent-red)' }} onClick={() => setConfirm({ 
            open: true, title: 'Shutdown System', message: 'Are you sure you want to power off the server?', 
            action: () => handleAction('shutdown') 
          })}>
            <Power size={15} /> Shutdown
          </button>
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
