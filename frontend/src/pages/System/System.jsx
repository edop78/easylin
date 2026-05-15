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
  const { data: powerStatus, refetch: refetchPower } = useApi('/system/power/status', { refreshInterval: 5000 });
  const { data: timeInfo, refetch: refetchTime } = useApi('/system/time/info', { refreshInterval: 30000 });
  const [msg, setMsg] = useState(null);
  const [powerMode, setPowerMode] = useState('delay'); // delay, time, cron
  const [powerDelay, setPowerDelay] = useState(0);
  const [powerTime, setPowerTime] = useState('00:00');
  const [powerCron, setPowerCron] = useState('0 3 * * 0');
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  // Live Clock logic
  const [localServerTime, setLocalServerTime] = useState(null);
  useEffect(() => {
    if (timeInfo?.current_time) {
      setLocalServerTime(new Date(timeInfo.current_time.replace(/-/g, '/')));
    }
  }, [timeInfo]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalServerTime(prev => prev ? new Date(prev.getTime() + 1000) : null);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Timezones logic
  const [timezones, setTimezones] = useState([]);
  const [selectedTz, setSelectedTz] = useState('');
  
  useEffect(() => {
    if (timeInfo?.timezone) setSelectedTz(timeInfo.timezone);
    const fetchTzs = async () => {
      try {
        const zones = await api.get('/system/time/list-timezones');
        setTimezones(zones);
      } catch (err) {}
    };
    fetchTzs();
  }, [timeInfo]);

  const handleSetTimezone = async (tz) => {
    try {
      await api.post('/system/time/set-timezone', { timezone: tz });
      setMsg({ type: 'success', text: `Timezone changed to ${tz}` });
      refetchTime();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleSyncTime = async () => {
    try {
      await api.post('/system/time/sync');
      setMsg({ type: 'success', text: 'Time synchronization requested' });
      setTimeout(refetchTime, 2000);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const handlePowerAction = async (action) => {
    setConfirm({ ...confirm, open: false });
    try {
      const payload = { 
        action, 
        mode: powerMode,
        delay: powerMode === 'delay' ? powerDelay : 0,
        time: powerMode === 'time' ? powerTime : null,
        cron: powerMode === 'cron' ? powerCron : null
      };
      const res = await api.post('/system/power', payload);
      setMsg({ type: 'success', text: res.message });
      setTimeout(refetchPower, 1000);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const cancelPower = async () => {
    try {
      const res = await api.post('/system/power/cancel');
      setMsg({ type: 'success', text: res.message });
      setTimeout(refetchPower, 1000);
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
        <button className="btn btn-ghost" onClick={() => { refetch(); refetchTime(); refetchPower(); }} disabled={loading}>
          <RotateCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {powerStatus?.active && (
        <div className="alert alert-warning fade-in" style={{ marginBottom: '24px', border: '1px solid var(--accent-red)', background: 'rgba(239, 68, 68, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <AlertCircle size={20} className="pulse" style={{ color: 'var(--accent-red)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>System {powerStatus.action.toUpperCase()} Pending</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Execution scheduled for: <strong>{powerStatus.time}</strong></div>
            </div>
          </div>
          <button className="btn btn-sm btn-danger" onClick={cancelPower} style={{ marginLeft: '20px' }}>
            <X size={14} /> Abort Operation
          </button>
        </div>
      )}

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
          {/* TIME CARD */}
          <div className="card time-card">
            <div className="card-header"><div className="card-title"><Clock size={16} /> Time & Region</div></div>
            <div style={{ marginBottom: '20px', textAlign: 'center', padding: '10px', background: 'var(--bg-lighter)', borderRadius: '12px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                {localServerTime ? localServerTime.toLocaleTimeString() : '--:--:--'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {localServerTime ? localServerTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...'}
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Timezone</label>
              <select className="input-sm" value={selectedTz} onChange={(e) => handleSetTimezone(e.target.value)}>
                {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <button className="btn btn-ghost btn-sm" style={{ width: '100%', gap: '8px' }} onClick={handleSyncTime}>
              <RefreshCw size={14} /> Sync with NTP
            </button>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
              NTP Status: {timeInfo?.ntp_active ? 'Active' : 'Disabled'} • {timeInfo?.ntp_synchronized ? 'Synced' : 'Unsynced'}
            </div>
          </div>

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
            
            <div className="tabs-mini" style={{ marginBottom: '16px' }}>
              <button className={`tab-sm ${powerMode === 'delay' ? 'active' : ''}`} onClick={() => setPowerMode('delay')}>Delay</button>
              <button className={`tab-sm ${powerMode === 'time' ? 'active' : ''}`} onClick={() => setPowerMode('time')}>At Time</button>
              <button className={`tab-sm ${powerMode === 'cron' ? 'active' : ''}`} onClick={() => setPowerMode('cron')}>Cron</button>
            </div>

            <div className="power-scheduler">
              {powerMode === 'delay' && (
                <>
                  <div className="scheduler-header">
                    <span>In Minutes</span>
                    <span className="delay-badge">{powerDelay > 0 ? `${powerDelay} min` : 'Now'}</span>
                  </div>
                  <input type="range" min="0" max="120" step="5" value={powerDelay} onChange={(e) => setPowerDelay(parseInt(e.target.value))} className="power-slider" />
                </>
              )}
              {powerMode === 'time' && (
                <div className="form-group">
                  <label className="form-label">Specific Time (HH:MM)</label>
                  <input type="time" className="input-sm" value={powerTime} onChange={(e) => setPowerTime(e.target.value)} />
                </div>
              )}
              {powerMode === 'cron' && (
                <div className="form-group">
                  <label className="form-label">Cron Expression</label>
                  <input type="text" className="input-sm" value={powerCron} onChange={(e) => setPowerCron(e.target.value)} placeholder="0 3 * * 0" />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Ex: 0 3 * * 0 (Every Sunday at 03:00)</div>
                </div>
              )}
            </div>
            
            <div className="power-buttons">
              <button className="btn btn-danger" onClick={() => setConfirm({ 
                open: true, title: 'Reboot', message: `Confirm ${powerMode} reboot?`, 
                action: () => handlePowerAction('reboot') 
              })}>
                <RotateCw size={14} /> Reboot
              </button>
              <button className="btn btn-ghost shutdown-btn" onClick={() => setConfirm({ 
                open: true, title: 'Shutdown', message: `Confirm ${powerMode} shutdown?`, 
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

        .tabs-mini { display: flex; gap: 4px; background: var(--bg-lighter); padding: 4px; border-radius: 8px; }
        .tab-sm { flex: 1; border: none; background: transparent; color: var(--text-muted); padding: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 6px; transition: 0.2s; }
        .tab-sm.active { background: var(--bg-card); color: var(--accent-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .input-sm { width: 100%; background: var(--bg-lighter); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px; border-radius: 6px; font-size: 13px; outline: none; appearance: none; }
        .input-sm:focus { border-color: var(--accent-blue); }
        select.input-sm { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; }
        select.input-sm option { background: #1a1a1a; color: white; }
        .pulse { animation: pulse-red 2s infinite; }
        @keyframes pulse-red { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}} />
    </div>
  );
}
