import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Settings, Power, RotateCw, Server, Clock, HardDrive, CheckCircle, 
  AlertCircle, Cpu, Monitor, Globe, Shield, Activity, Copy, X, Users as UsersIcon 
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
        <div className="loading-container" style={{ height: '60vh' }}>
          <div className="spinner" />
          <p>Loading system information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page fade-in">
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <div><strong>Error:</strong> {error}</div>
          <button className="btn btn-sm btn-ghost" onClick={refetch} style={{marginLeft: '10px'}}>Retry</button>
        </div>
      </div>
    );
  }

  const systemFields = [
    { label: 'Hostname', value: data?.hostname, icon: Monitor },
    { label: 'Local IP', value: data?.local_ip, icon: Globe },
    { label: 'OS', value: data?.os, icon: Server },
    { label: 'Kernel', value: data?.kernel, icon: Settings },
    { label: 'CPU Cores', value: data?.cpu_count, icon: Cpu },
    { label: 'CPU Temp', value: data?.cpu_temp ? `${Number(data.cpu_temp).toFixed(1)}°C` : 'N/A', icon: Activity },
    { label: 'Timezone', value: data?.timezone, icon: Clock },
    { label: 'NTP Sync', icon: RefreshCw, value: data?.ntp_active ? 'Active' : 'Disabled' },
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
        <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{msg.text}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setMsg(null)}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px' }}>
        {/* INFO CARD */}
        <div className="card">
          <div className="card-header"><div className="card-title"><Server size={16} /> Information</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {systemFields.map((f, i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <f.icon size={12} /> {f.label}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{f.value || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SESSIONS CARD */}
          <div className="card">
            <div className="card-header"><div className="card-title"><UsersIcon size={16} /> Sessions</div></div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {data?.active_sessions?.length > 0 ? data.active_sessions.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px' }}>
                    <strong>{s?.name || 'user'}</strong> <span style={{color: 'var(--text-muted)'}}>{s?.terminal}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s?.started}</div>
                </div>
              )) : <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>No active sessions</p>}
            </div>
          </div>

          {/* POWER CARD */}
          <div className="card">
            <div className="card-header"><div className="card-title"><Power size={16} /> Power</div></div>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '11px', marginBottom: '5px' }}>Delay: {powerDelay} min</div>
              <input type="range" min="0" max="120" step="5" value={powerDelay} onChange={(e) => setPowerDelay(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-danger" style={{flex: 1}} onClick={() => setConfirm({ open: true, title: 'Reboot', message: 'Reboot now?', action: () => handlePowerAction('reboot') })}>Reboot</button>
              <button className="btn btn-ghost" style={{flex: 1, color: 'var(--accent-red)'}} onClick={() => setConfirm({ open: true, title: 'Shutdown', message: 'Shutdown now?', action: () => handlePowerAction('shutdown') })}>Shutdown</button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirm.open} title={confirm.title} message={confirm.message}
        onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })}
        type="danger"
      />
    </div>
  );
}
