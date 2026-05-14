import { useApi } from '../../hooks/useApi';
import { 
  LayoutDashboard, Activity, Cpu, HardDrive, Zap, 
  ArrowUpRight, ArrowDownRight, RefreshCw, BarChart3
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
            <div className={`progress-fill ${color}`} style={{ width: `${percent}%` }}></div>
          </div>
        )}

        <div className="stat-sub" style={{ fontSize: '11px', lineHeight: '1.6' }}>
          {details ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {details.map((d, i) => <span key={i}>{d}</span>)}
            </div>
          ) : sub}
        </div>
      </div>
    </div>
  );
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function Dashboard() {
  const { data, loading, refetch } = useApi('/dashboard/metrics');

  const metrics = data || {
    cpu: 0, ram: { percent: 0, used: 0, free: 0, total: 0 },
    disk: { percent: 0, used: 0, free: 0, total: 0 },
    net: { sent: 0, recv: 0 },
    load: [0, 0, 0]
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><LayoutDashboard size={28} /><h1>Dashboard</h1></div>
        <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="stat-grid">
        <StatCard 
          title="CPU Usage" 
          value={`${metrics.cpu}%`} 
          percent={metrics.cpu}
          sub={`Load Avg: ${metrics.load[0].toFixed(2)}`}
          icon={Cpu} 
          color="blue"
        />
        <StatCard 
          title="Memory (RAM)" 
          value={`${metrics.ram.percent}%`} 
          percent={metrics.ram.percent}
          details={[
            `Used: ${formatBytes(metrics.ram.used)}`,
            `Free: ${formatBytes(metrics.ram.free)}`,
            `Total: ${formatBytes(metrics.ram.total)}`
          ]}
          icon={Activity} 
          color="purple" 
        />
        <StatCard 
          title="Disk Storage" 
          value={`${metrics.disk.percent}%`} 
          percent={metrics.disk.percent}
          details={[
            `Used: ${formatBytes(metrics.disk.used)}`,
            `Free: ${formatBytes(metrics.disk.free)}`,
            `Total: ${formatBytes(metrics.disk.total)}`
          ]}
          icon={HardDrive} 
          color="cyan" 
        />
        <StatCard 
          title="Network Traffic" 
          value="Live" 
          sub={`↑ ${formatBytes(metrics.net.sent)} / ↓ ${formatBytes(metrics.net.recv)}`}
          icon={Zap} 
          color="amber" 
        />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card">
          <div className="card-header"><div className="card-title"><BarChart3 size={16} /> Load Average</div></div>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: 'var(--space-lg) 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{metrics.load[0].toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>1 min</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{metrics.load[1].toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>5 min</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{metrics.load[2].toFixed(2)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>15 min</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
