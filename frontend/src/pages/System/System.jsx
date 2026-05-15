import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Settings, Power, RotateCw, Server, Clock, HardDrive, CheckCircle, 
  AlertCircle, Cpu, Monitor, Globe, Shield, Activity, Copy, X, Users, RefreshCw 
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function System() {
  const { data, loading, error, refetch } = useApi('/system/info');
  const [msg, setMsg] = useState(null);
  const [powerDelay, setPowerDelay] = useState(0);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const handlePowerAction = async (action) => {
    setConfirm({ ...confirm, open: false });
    try {
      const res = await api.post('/system/power', { action, delay: powerDelay });
      setMsg({ type: 'success', text: res.message || `Action ${action} initiated` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  if (loading && !data) {
    return (
      <div className="page fade-in">
        <div className="loading-container" style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: '20px', color: 'var(--text-muted)' }}>Loading system metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page fade-in">
        <div className="page-header">
          <div className="page-title"><Settings size={28} /><h1>System Management</h1></div>
        </div>
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <div style={{ marginLeft: '10px' }}><strong>System Error:</strong> {error}</div>
          <button className="btn btn-sm btn-ghost" onClick={refetch} style={{ marginLeft: 'auto' }}>Retry</button>
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
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setMsg(null)}><X size={14} /></button>
        </div>
      )}

      <div className="system-container">
        {/* INFO CARD */}
        <div className="card info-card">
          <div className="card-header"><div className="card-title"><Server size={16} /> System Information</div></div>
          <div className="fields-grid">
            {systemFields.map((f, i) => (
              <div key={i} className="field-item">
                <div className="field-label">
                  <f.icon size={12} /> {f.label}
                </div>
                <div className="field-value">{f.value || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="side-column">
          {/* SESSIONS CARD */}
          <div className="card sessions-card">
            <div className="card-header"><div className="card-title"><Users size={16} /> Active Sessions</div></div>
            <div className="sessions-list">
              {data?.active_sessions?.length > 0 ? data.active_sessions.map((s, i) => (
                <div key={i} className="session-row">
                  <div className="session-main">
                    <div className="session-avatar">{(s?.name?.charAt(0) || '?').toUpperCase()}</div>
                    <div className="session-info">
                      <div className="session-name">{s?.name || 'unknown'}</div>
                      <div className="session-meta">{s?.terminal} • {s?.host || 'local'}</div>
                    </div>
                  </div>
                  <div className="session-time">Since {s?.started}</div>
                </div>
              )) : <div className="empty-msg">No active sessions found</div>}
            </div>
          </div>

          {/* POWER CARD */}
          <div className="card power-card">
            <div className="card-header"><div className="card-title"><Power size={16} /> Power Controls</div></div>
            <div className="power-scheduler">
              <div className="scheduler-header">
                <span>Delayed Action</span>
                <span className="delay-badge">{powerDelay > 0 ? `${powerDelay} min` : 'Now'}</span>
              </div>
              <input 
                type="range" min="0" max="120" step="5" value={powerDelay} 
                onChange={(e) => setPowerDelay(parseInt(e.target.value))} 
                className="power-slider"
              />
            </div>
            <div className="power-buttons">
              <button className="btn btn-danger" onClick={() => setConfirm({ 
                open: true, title: 'Reboot', message: `Reboot system ${powerDelay > 0 ? `in ${powerDelay} min` : 'now'}?`, 
                action: () => handlePowerAction('reboot') 
              })}>
                <RotateCw size={14} /> Reboot
              </button>
              <button className="btn btn-ghost shutdown-btn" onClick={() => setConfirm({ 
                open: true, title: 'Shutdown', message: `Power off system ${powerDelay > 0 ? `in ${powerDelay} min` : 'now'}?`, 
                action: () => handlePowerAction('shutdown') 
              })}>
                <Power size={14} /> Shutdown
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })}
        type="danger"
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .system-container { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }
        @media (max-width: 1100px) { .system-container { grid-template-columns: 1fr; } }
        
        .fields-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 10px 0; }
        .field-item { border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
        .field-label { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .field-value { font-size: 14px; font-weight: 600; }

        .side-column { display: flex; flex-direction: column; gap: 24px; }
        .sessions-list { max-height: 220px; overflow-y: auto; }
        .session-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-color); }
        .session-row:last-child { border-bottom: none; }
        .session-main { display: flex; align-items: center; gap: 12px; }
        .session-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--bg-lighter); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--accent-blue); }
        .session-name { font-size: 13px; font-weight: 600; }
        .session-meta { font-size: 11px; color: var(--text-muted); }
        .session-time { font-size: 10px; color: var(--text-muted); text-align: right; }
        .empty-msg { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }

        .power-scheduler { margin-bottom: 20px; }
        .scheduler-header { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; }
        .delay-badge { font-weight: 700; color: var(--accent-blue); }
        .power-slider { width: 100%; height: 6px; border-radius: 3px; background: var(--border-color); outline: none; -webkit-appearance: none; }
        .power-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent-blue); cursor: pointer; border: 2px solid white; }

        .power-buttons { display: flex; gap: 12px; }
        .power-buttons .btn { flex: 1; height: 40px; }
        .shutdown-btn { color: var(--accent-red) !important; }
      `}} />
    </div>
  );
}
