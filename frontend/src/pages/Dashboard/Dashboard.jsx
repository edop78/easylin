import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  LayoutDashboard, Activity, Cpu, HardDrive, Zap, 
  RefreshCw, Container, AlertCircle, Trash2, CheckCircle, Copy
} from 'lucide-react';

function StatCard({ title, value, sub, icon: Icon, color, details, percent }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}><Icon size={20} /></div>
      <div className="stat-info">
        <div className="stat-label">{title}</div>
        <div className="stat-value">{value}</div>
        {percent !== undefined && (
          <div className="progress-bar" style={{ margin: '8px 0' }}>
            <div className={`progress-fill ${color}`} style={{ width: `${percent || 0}%` }}></div>
          </div>
        )}
        <div className="stat-sub">
          {details ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
              {details.map((d, i) => <span key={i}>{d}</span>)}
            </div>
          ) : sub}
        </div>
      </div>
    </div>
  );
}

const formatBytes = (bytes) => {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function Dashboard() {
  const { data, loading, error, refetch } = useApi('/dashboard/metrics');
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState(null);

  const handleMaintenance = async (action) => {
    setActionLoading(action);
    setMsg(null);
    try {
      await api.post(`/system/${action}`);
      setMsg({ type: 'success', text: `Action ${action} completed successfully!` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMsg({ type: 'success', text: 'Error message copied to clipboard!' });
  };

  if (loading && !data) {
    return (
      <div className="loading-container" style={{ height: '60vh' }}>
        <div className="spinner" />
        <p>Fetching real-time metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page fade-in">
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <div>
            <strong>Error fetching metrics:</strong> {error}
            <button className="btn btn-sm btn-ghost" onClick={refetch} style={{ marginLeft: '10px' }}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  const cpu = data?.cpu || 0;
  const ram = data?.ram || { percent: 0, used: 0, free: 0, total: 0 };
  const disk = data?.disk || { percent: 0, used: 0, free: 0, total: 0 };
  const dockerData = data?.docker || { running: 0, total: 0 };
  const net = data?.net || { sent: 0, recv: 0 };
  const load = data?.load || [0, 0, 0];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><LayoutDashboard size={28} /><h1>Dashboard</h1></div>
        <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          {msg.type === 'error' && (
            <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard(msg.text)}>
              <Copy size={14} /> Copy
            </button>
          )}
        </div>
      )}

      <div className="stat-grid">
        <StatCard title="CPU Usage" value={`${cpu}%`} percent={cpu} sub={`Load Avg: ${Number(load[0] || 0).toFixed(2)}`} icon={Cpu} color="blue" />
        <StatCard title="Memory (RAM)" value={`${ram.percent}%`} percent={ram.percent} details={[`U: ${formatBytes(ram.used)}`, `F: ${formatBytes(ram.free)}`, `T: ${formatBytes(ram.total)}`]} icon={Activity} color="purple" />
        <StatCard title="Disk Storage" value={`${disk.percent}%`} percent={disk.percent} details={[`U: ${formatBytes(disk.used)}`, `F: ${formatBytes(disk.free)}`, `T: ${formatBytes(disk.total)}`]} icon={HardDrive} color="cyan" />
        <StatCard title="Network Traffic" value="Live" sub={`↑ ${formatBytes(net.sent)} / ↓ ${formatBytes(net.recv)}`} icon={Zap} color="amber" />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--space-lg)', alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Container size={16} /> Docker Overview</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', padding: 'var(--space-md) 0' }}>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{dockerData.running || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Running</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dockerData.total || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total</div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill green" style={{ width: `${(dockerData.running / (dockerData.total || 1) * 100) || 0}%` }}></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title"><Trash2 size={16} /> Maintenance</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clean up your system to free up disk space.</p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <button 
                className="btn btn-ghost" 
                disabled={actionLoading === 'apt-clean'}
                onClick={() => handleMaintenance('apt-clean')}
              >
                {actionLoading === 'apt-clean' ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                APT Clean
              </button>
              <button 
                className="btn btn-ghost" 
                disabled={actionLoading === 'docker-prune'}
                onClick={() => handleMaintenance('docker-prune')}
              >
                {actionLoading === 'docker-prune' ? <RefreshCw size={14} className="spin" /> : <Container size={14} />}
                Docker Prune
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
