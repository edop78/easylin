import { useApi } from '../../hooks/useApi';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Activity, Cpu, HardDrive, Zap, 
  RefreshCw, Container, AlertCircle, ShieldAlert, CheckCircle2, ArrowRight
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
  const navigate = useNavigate();

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
  const updates = data?.updates || { total: 0 };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><LayoutDashboard size={28} /><h1>Dashboard</h1></div>
        <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="stat-grid">
        <StatCard title="CPU Usage" value={`${cpu}%`} percent={cpu} sub={`Load Avg: ${Number(load[0] || 0).toFixed(2)}`} icon={Cpu} color="blue" />
        <StatCard title="Memory (RAM)" value={`${ram.percent}%`} percent={ram.percent} details={[`U: ${formatBytes(ram.used)}`, `F: ${formatBytes(ram.free)}`, `T: ${formatBytes(ram.total)}`]} icon={Activity} color="purple" />
        <StatCard title="Disk Storage" value={`${disk.percent}%`} percent={disk.percent} details={[`U: ${formatBytes(disk.used)}`, `F: ${formatBytes(disk.free)}`, `T: ${formatBytes(disk.total)}`]} icon={HardDrive} color="cyan" />
        <StatCard title="Network Traffic" value="Live" sub={`↑ ${formatBytes(net.sent)} / ↓ ${formatBytes(net.recv)}`} icon={Zap} color="amber" />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--space-lg)', alignItems: 'stretch' }}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Container size={16} /> Docker Overview</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', padding: 'var(--space-md) 0' }}>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{dockerData.running || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Running</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dockerData.total || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Containers</div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill green" style={{ width: `${(dockerData.running / (dockerData.total || 1) * 100) || 0}%` }}></div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="card-header"><div className="card-title"><RefreshCw size={16} /> System Updates</div></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md) 0' }}>
            {updates.total > 0 ? (
              <>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', padding: '12px', borderRadius: '12px' }}>
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{updates.total} Updates</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Security and system patches available.</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)', padding: '12px', borderRadius: '12px' }}>
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>Up to Date</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your system is running the latest versions.</div>
                </div>
              </>
            )}
          </div>

          <button 
            className={`btn ${updates.total > 0 ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ width: '100%', marginTop: 'var(--space-md)' }}
            onClick={() => navigate('/system/maintenance')}
          >
            Go to Update Center <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
