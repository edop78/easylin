import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Settings, Power, RotateCw, Server, Clock, HardDrive, CheckCircle, 
  AlertCircle, Cpu, Monitor, Globe, Shield, Activity, Copy, X, Users 
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function System() {
  const { data, loading, error, refetch } = useApi('/system/info');
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  // Auto-hide messages after 10 seconds
  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMsg({ type: 'success', text: 'Error message copied to clipboard!' });
  };

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
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} />
            <div><strong>Error loading system info:</strong> {error}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard(error)} title="Copy error">
              <Copy size={14} /> Copy
            </button>
            <button className="btn btn-sm btn-ghost" onClick={refetch}>Retry</button>
          </div>
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
    { label: 'CPU Temp', value: data?.cpu_temp ? `${data.cpu_temp.toFixed(1)}°C` : 'N/A', icon: Activity },
    { label: 'Timezone', value: data?.timezone, icon: Clock },
    { label: 'NTP Sync', value: data?.ntp_active ? 'Active' : 'Disabled', icon: RefreshCw },
    { label: 'Uptime', value: data?.uptime, icon: Clock },
  ];

  const [powerDelay, setPowerDelay] = useState(0);

  const handlePowerAction = async (action) => {
    try {
      const res = await api.post('/system/power', { action, delay: powerDelay });
      setMsg({ type: 'success', text: res.message });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Settings size={28} /><h1>System Management</h1></div>
        <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
          <RotateCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'info' ? 'warning' : (msg.type === 'error' ? 'error' : 'success')}`} 
             style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setMsg(null)}><X size={14} /></button>
        </div>
      )}

      <div className="grid-2">
        {/* Left: System Details */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Server size={16} /> System Information</div>
          </div>
          {loading && !data ? <div className="spinner" /> : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: 'var(--space-md) var(--space-lg)',
              padding: 'var(--space-xs) 0'
            }}>
              {systemFields.map((field, idx) => (
                <div key={idx} className="stat-info" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <field.icon size={13} style={{ opacity: 0.7 }} /> {field.label}
                  </div>
                  <div className="stat-value" style={{ fontSize: '13px', fontWeight: 600 }}>
                    {field.value || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Active Sessions */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header"><div className="card-title"><Users size={16} /> Active Sessions</div></div>
            <div className="session-list">
              {data?.active_sessions?.length > 0 ? data.active_sessions.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < data.active_sessions.length -1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{s.name[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.terminal} • {s.host || 'local'}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    Since<br/>{s.started}
                  </div>
                </div>
              )) : <div className="empty-state">No active sessions</div>}
            </div>
          </div>

          {/* Power Controls with Scheduler */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Power size={16} /> Power & Scheduling</div></div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>Delay (minutes): {powerDelay > 0 ? <b>{powerDelay} min</b> : <b>Immediate</b>}</label>
              <input 
                type="range" min="0" max="120" step="5" value={powerDelay} 
                onChange={(e) => setPowerDelay(parseInt(e.target.value))} 
                className="slider"
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setConfirm({ 
                open: true, title: 'Reboot System', message: `Are you sure you want to reboot the server ${powerDelay > 0 ? `in ${powerDelay} minutes` : 'now'}?`, 
                action: () => handlePowerAction('reboot') 
              })}>
                <RotateCw size={14} /> {powerDelay > 0 ? `Sched. Reboot` : 'Reboot'}
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--accent-red)' }} onClick={() => setConfirm({ 
                open: true, title: 'Shutdown System', message: `Are you sure you want to power off the server ${powerDelay > 0 ? `in ${powerDelay} minutes` : 'now'}?`, 
                action: () => handlePowerAction('shutdown') 
              })}>
                <Power size={14} /> {powerDelay > 0 ? `Sched. Shutdown` : 'Shutdown'}
              </button>
            </div>
          </div>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .grid-2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--space-lg); }
        @media (max-width: 992px) { .grid-2 { grid-template-columns: 1fr; } }
        .session-list { max-height: 200px; overflow-y: auto; }
        .empty-state { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
      `}} />
    </div>
  );
}

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
