import { useApi } from '../../hooks/useApi';
import { 
  LayoutDashboard, Activity, Cpu, HardDrive, Zap, 
  ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';

function StatCard({ title, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}><Icon size={20} /></div>
      <div className="stat-info">
        <div className="stat-label">{title}</div>
        <div className="stat-value">{value}</div>
        <div className="stat-sub">
          {trend && (
            <span style={{ color: trend > 0 ? 'var(--accent-red)' : 'var(--accent-green)', display: 'inline-flex', alignItems: 'center' }}>
              {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, refetch } = useApi('/dashboard/metrics');

  const metrics = data || {
    cpu: 0, ram: { percent: 0, used: 0, total: 0 },
    disk: { percent: 0, used: 0, total: 0 },
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
          sub={`Load: ${metrics.load[0].toFixed(2)}`}
          icon={Cpu} 
          color="blue"
          trend={metrics.cpu > 50 ? 5 : -2}
        />
        <StatCard 
          title="Memory" 
          value={`${metrics.ram.percent}%`} 
          sub={`${(metrics.ram.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(metrics.ram.total / 1024 / 1024 / 1024).toFixed(1)}GB`}
          icon={Activity} 
          color="purple" 
        />
        <StatCard 
          title="Disk Usage" 
          value={`${metrics.disk.percent}%`} 
          sub={`${(metrics.disk.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(metrics.disk.total / 1024 / 1024 / 1024).toFixed(1)}GB`}
          icon={HardDrive} 
          color="cyan" 
        />
        <StatCard 
          title="Network" 
          value="Active" 
          sub={`↑ ${(metrics.net.sent / 1024 / 1024).toFixed(1)}MB / ↓ ${(metrics.net.recv / 1024 / 1024).toFixed(1)}MB`}
          icon={Zap} 
          color="amber" 
        />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card">
          <div className="card-header"><div className="card-title"><Activity size={16} /> Load Average</div></div>
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
