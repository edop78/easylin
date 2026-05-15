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
  const [powerDelay, setPowerDelay] = useState(0);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  // Auto-hide messages
  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setMsg({ type: 'success', text: 'Copied to clipboard!' });
  };

  const handlePowerAction = async (action) => {
    setConfirm({ ...confirm, open: false });
    try {
      const res = await api.post('/system/power', { action, delay: powerDelay });
      setMsg({ type: 'success', text: res.message || `Action ${action} initiated` });
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
            <div><strong>Error:</strong> {error}</div>
          </div>
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
    { label: 'CPU Cores', value: data?.cpu_count, icon: Cpu },
    { label: 'CPU Temp', value: data?.cpu_temp ? `${Number(data.cpu_temp).toFixed(1)}°C` : 'N/A', icon: Activity },
    { label: 'Timezone', value: data?.timezone, icon: Clock },
    { label: 'NTP Sync', value: data?.ntp_active ? 'Active' : 'Disabled', icon: RefreshCw },
    { label: 'Uptime', value: data?.uptime, icon: Clock },
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
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`} 
             style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setMsg(null)}><X size={14} /></button>
        </div>
      )}

      <div className="system-grid-layout">
        {/* Left Col: Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Server size={16} /> System Information</div>
          </div>
          {loading && !data ? <div className="spinner" /> : (
            <div className="info-grid">
              {systemFields.map((field, idx) => (
                <div key={idx} className="info-item">
                  <div className="info-label">
                    <field.icon size={13} style={{ opacity: 0.7 }} /> {field.label}
                  </div>
                  <div className="info-value">
                    {field.value || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Sessions & Power */}
        <div className="sidebar-col">
          <div className="card">
            <div className="card-header"><div className="card-title"><Users size={16} /> Active Sessions</div></div>
            <div className="session-container">
              {data?.active_sessions?.length > 0 ? data.active_sessions.map((s, i) => (
                <div key={i} className="session-item">
                  <div className="session-user">
                    <div className="session-avatar">{(s?.name?.charAt(0) || '?').toUpperCase()}</div>
                    <div>
                      <div className="session-name">{s?.name || 'unknown'}</div>
                      <div className="session-meta">{s?.terminal} • {s?.host || 'local'}</div>
                    </div>
                  </div>
                  <div className="session-time">Since {s?.started}</div>
                </div>
              )) : <div className="empty-state">No active sessions</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title"><Power size={16} /> Power Management</div></div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>Delay</span>
                <span>{powerDelay > 0 ? `${powerDelay} minutes` : 'Immediate'}</span>
              </div>
              <input 
                type="range" min="0" max="120" step="5" value={powerDelay} 
                onChange={(e) => setPowerDelay(parseInt(e.target.value))} 
                className="slider"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setConfirm({ 
                open: true, title: 'Reboot System', message: `Reboot server ${powerDelay > 0 ? `in ${powerDelay} min` : 'now'}?`, 
                action: () => handlePowerAction('reboot') 
              })}>
                <RotateCw size={14} /> Reboot
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--accent-red)' }} onClick={() => setConfirm({ 
                open: true, title: 'Shutdown System', message: `Power off server ${powerDelay > 0 ? `in ${powerDelay} min` : 'now'}?`, 
                action: () => handlePowerAction('shutdown') 
              })}>
                <Power size={14} /> Shutdown
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
        type="danger"
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .system-grid-layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; }
        @media (max-width: 992px) { .system-grid-layout { grid-template-columns: 1fr; } }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 8px 0; }
        .info-item { border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
        .info-label { display: flex; alignItems: center; gap: 8px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .info-value { font-size: 13px; fontWeight: 600; color: var(--text-primary); }

        .sidebar-col { display: flex; flex-direction: column; gap: 24px; }
        .session-container { max-height: 250px; overflow-y: auto; }
        .session-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color); }
        .session-item:last-child { border-bottom: none; }
        .session-user { display: flex; align-items: center; gap: 12px; }
        .session-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-lighter); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--accent-blue); }
        .session-name { font-size: 13px; font-weight: 600; }
        .session-meta { font-size: 11px; color: var(--text-muted); }
        .session-time { font-size: 10px; color: var(--text-muted); text-align: right; }
        
        .empty-state { padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px; font-style: italic; }
        
        .slider { -webkit-appearance: none; height: 4px; border-radius: 2px; background: var(--border-color); outline: none; transition: 0.2s; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent-blue); cursor: pointer; }
      `}} />
    </div>
  );
}
