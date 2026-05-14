import { useApi } from '../../hooks/useApi';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  Clock,
  Monitor,
  ArrowUpDown,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import api from '../../api/client';
import { useState } from 'react';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function ProgressBar({ percent, color }) {
  const barColor = percent > 90 ? 'red' : percent > 70 ? 'amber' : color;
  return (
    <div className="progress-bar">
      <div
        className={`progress-fill ${barColor}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error, refetch } = useApi('/dashboard/', {
    interval: 5000,
  });
  const [msg, setMsg] = useState(null);

  const installPackage = async (name) => {
    if (!confirm(`Install ${name}?`)) return;
    try {
      setMsg({ type: 'info', text: `Installing ${name}...` });
      const result = await api.post('/packages/install', { name });
      setMsg({
        type: result.success ? 'success' : 'error',
        text: result.success ? `${name} installed successfully` : result.error,
      });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  if (loading && !data) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const d = data || {};

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <Monitor size={28} />
          <div>
            <h1>Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {d.hostname || 'Server'} — {d.uptime || ''}
            </p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={refetch}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type === 'info' ? 'warning' : msg.type}`} style={{ marginBottom: 'var(--space-lg)' }}>
          {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Stats Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Cpu size={22} /></div>
          <div className="stat-info">
            <div className="stat-label">CPU Usage</div>
            <div className="stat-value">{d.cpu?.percent || 0}%</div>
            <div className="stat-sub">{d.cpu?.cores || 0} cores · {Math.round(d.cpu?.frequency || 0)} MHz</div>
            <ProgressBar percent={d.cpu?.percent || 0} color="blue" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><MemoryStick size={22} /></div>
          <div className="stat-info">
            <div className="stat-label">Memory</div>
            <div className="stat-value">{d.memory?.percent || 0}%</div>
            <div className="stat-sub">
              {formatBytes(d.memory?.used || 0)} / {formatBytes(d.memory?.total || 0)}
            </div>
            <ProgressBar percent={d.memory?.percent || 0} color="green" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><HardDrive size={22} /></div>
          <div className="stat-info">
            <div className="stat-label">Disk</div>
            <div className="stat-value">{d.disk?.percent || 0}%</div>
            <div className="stat-sub">
              {formatBytes(d.disk?.used || 0)} / {formatBytes(d.disk?.total || 0)}
            </div>
            <ProgressBar percent={d.disk?.percent || 0} color="amber" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><Activity size={22} /></div>
          <div className="stat-info">
            <div className="stat-label">Load Average</div>
            <div className="stat-value">{d.load_average?.['1min']?.toFixed(2) || '0.00'}</div>
            <div className="stat-sub">
              5m: {d.load_average?.['5min']?.toFixed(2) || '0.00'} · 15m: {d.load_average?.['15min']?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan"><ArrowUpDown size={22} /></div>
          <div className="stat-info">
            <div className="stat-label">Network I/O</div>
            <div className="stat-value">{formatBytes(d.network?.bytes_recv || 0)}</div>
            <div className="stat-sub">
              ↑ {formatBytes(d.network?.bytes_sent || 0)} sent
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><Clock size={22} /></div>
          <div className="stat-info">
            <div className="stat-label">Uptime</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              {d.uptime || 'N/A'}
            </div>
            <div className="stat-sub">{d.platform || ''}</div>
          </div>
        </div>
      </div>

      {/* OS Info & Quick Setup */}
      <div className="grid-2" style={{ marginTop: 'var(--space-lg)' }}>
        {d.os_info && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Monitor size={16} /> System Information
              </div>
            </div>
            <pre className="code-block" style={{ height: '240px' }}>{d.os_info}</pre>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={16} /> Quick Setup
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-md)' }}>
            Common tools and operations for new servers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '13px' }}>Common Utilities (git, curl, htop, vim)</span>
              <button className="btn btn-primary btn-sm" onClick={() => installPackage('git curl htop vim')}>Install</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '13px' }}>Build Essentials (gcc, make, build-essential)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => installPackage('build-essential')}>Install</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '13px' }}>Network Tools (net-tools, nmap)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => installPackage('net-tools nmap')}>Install</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
