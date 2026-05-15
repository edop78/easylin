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
        <div className="stat-sub" style={{ marginTop: '8px' }}>
          {details && details.length >= 3 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', opacity: 0.8, whiteSpace: 'nowrap' }}>
              <span>{details[0]}</span>
              <span style={{ opacity: 0.6 }}>{details[2]}</span>
              <span>{details[1]}</span>
            </div>
          ) : details ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              {details.map((d, i) => (
                <div key={i} style={{ fontSize: '11px', opacity: 0.8, whiteSpace: 'nowrap' }}>{d}</div>
              ))}
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
  const { data, loading, error, refetch } = useApi('/dashboard/metrics', { interval: 5000 });
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
  const load = data?.load || [0, 0, 0];
  const updates = data?.updates || { total: 0 };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><LayoutDashboard size={28} /><h1>Dashboard</h1></div>
      </div>

      <div className="stat-grid dashboard-stats-grid">
        <StatCard title="CPU Usage" value={`${cpu}%`} percent={cpu} sub={`Load Avg: ${Number(load[0] || 0).toFixed(2)}`} icon={Cpu} color="blue" />
        <StatCard title="Memory (RAM)" value={`${ram.percent}%`} percent={ram.percent} details={[`U: ${formatBytes(ram.used)}`, `F: ${formatBytes(ram.free)}`, `T: ${ram.display_total}`]} icon={Activity} color="purple" />
        <StatCard title="Disk Storage" value={`${disk.percent}%`} percent={disk.percent} details={[`U: ${formatBytes(disk.used)}`, `F: ${formatBytes(disk.free)}`, `T: ${disk.display_total}`]} icon={HardDrive} color="cyan" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .dashboard-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); }
        @media (max-width: 992px) {
          .dashboard-stats-grid { grid-template-columns: 1fr; }
          .grid-2 { grid-template-columns: 1fr !important; }
        }
      `}} />

      <div className="grid-2" style={{ marginTop: 'var(--space-lg)', alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
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
          
          <button 
            className="btn btn-ghost" 
            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
            onClick={() => navigate('/docker')}
          >
            Manage Docker <ArrowRight size={14} />
          </button>
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
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Security and patches available.</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)', padding: '12px', borderRadius: '12px' }}>
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>Up to Date</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your system is fully updated.</div>
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
