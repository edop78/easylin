import { useApi } from '../../hooks/useApi';
import { 
  LayoutDashboard, Activity, Cpu, HardDrive, Zap, 
  RefreshCw, BarChart3, Container, Shield, Server
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
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function Dashboard() {
  const { data, loading, refetch } = useApi('/dashboard/metrics');

  // Protezione totale contro dati mancanti o parziali
  const cpu = data?.cpu || 0;
  const ram = data?.ram || { percent: 0, used: 0, free: 0, total: 0 };
  const disk = data?.disk || { percent: 0, used: 0, free: 0, total: 0 };
  const dockerData = data?.docker || { running: 0, total: 0 };
  const services = data?.services || [];
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

      <div className="stat-grid">
        <StatCard 
          title="CPU Usage" 
          value={`${cpu}%`} 
          percent={cpu}
          sub={`Load Avg: ${load[0]?.toFixed(2) || '0.00'}`}
          icon={Cpu} 
          color="blue"
        />
        <StatCard 
          title="Memory (RAM)" 
          value={`${ram.percent}%`} 
          percent={ram.percent}
          details={[
            `Used: ${formatBytes(ram.used)}`,
            `Free: ${formatBytes(ram.free)}`,
            `Total: ${formatBytes(ram.total)}`
          ]}
          icon={Activity} 
          color="purple" 
        />
        <StatCard 
          title="Disk Storage" 
          value={`${disk.percent}%`} 
          percent={disk.percent}
          details={[
            `Used: ${formatBytes(disk.used)}`,
            `Free: ${formatBytes(disk.free)}`,
            `Total: ${formatBytes(disk.total)}`
          ]}
          icon={HardDrive} 
          color="cyan" 
        />
        <StatCard 
          title="Network Traffic" 
          value="Live" 
          sub={`↑ ${formatBytes(net.sent)} / ↓ ${formatBytes(net.recv)}`}
          icon={Zap} 
          color="amber" 
        />
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Container size={16} /> Docker Overview</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', padding: 'var(--space-md) 0' }}>
            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{dockerData.running}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Running</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{dockerData.total}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Containers</div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill green" style={{ width: `${(dockerData.running / (dockerData.total || 1) * 100)}%` }}></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><Server size={16} /> Essential Services</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {services.map((s) => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.name}</span>
                <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                  {s.status}
                </span>
              </div>
            ))}
            {services.length === 0 && <div className="empty-state">No services monitored</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
