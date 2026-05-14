import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import {
  Server,
  Clock,
  RefreshCw,
  Power,
  PowerOff,
  Download,
  AlertTriangle,
} from 'lucide-react';

export default function System() {
  const { data, loading, refetch } = useApi('/system/info');
  const [updating, setUpdating] = useState(false);
  const [updates, setUpdates] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const checkUpdates = async () => {
    setUpdating(true);
    try {
      const result = await api.get('/system/updates/check');
      setUpdates(result);
    } catch (err) {
      setActionMsg('Failed to check updates: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const applyUpdates = async () => {
    if (!confirm('Apply all system updates? This may take several minutes.')) return;
    setUpdating(true);
    try {
      const result = await api.post('/system/updates/apply');
      setActionMsg(result.success ? 'Updates applied successfully' : result.error);
      setUpdates(null);
    } catch (err) {
      setActionMsg(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReboot = async () => {
    if (!confirm('Are you sure you want to REBOOT the server?')) return;
    try {
      await api.post('/system/reboot');
      setActionMsg('Server is rebooting...');
    } catch (err) {
      setActionMsg(err.message);
    }
  };

  const handleShutdown = async () => {
    if (!confirm('Are you sure you want to SHUTDOWN the server?')) return;
    try {
      await api.post('/system/shutdown');
      setActionMsg('Server is shutting down...');
    } catch (err) {
      setActionMsg(err.message);
    }
  };

  if (loading && !data) {
    return <div className="loading-container"><div className="spinner" /><span>Loading...</span></div>;
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <Server size={28} />
          <h1>System</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={refetch}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-lg)' }}>
          <AlertTriangle size={16} /> {actionMsg}
        </div>
      )}

      <div className="grid-2">
        {/* System Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Server size={16} /> System Information</div>
          </div>
          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-muted)', width: '140px' }}>Hostname</td>
                <td>{data?.hostname || 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Kernel</td>
                <td className="mono">{data?.kernel || 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-muted)' }}>Timezone</td>
                <td>{data?.timezone || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Power Controls */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Power size={16} /> Power Management</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={handleReboot}>
              <RefreshCw size={15} /> Reboot
            </button>
            <button className="btn btn-danger" onClick={handleShutdown}>
              <PowerOff size={15} /> Shutdown
            </button>
          </div>
          <p style={{ marginTop: 'var(--space-md)', fontSize: '12px', color: 'var(--text-muted)' }}>
            Warning: These actions will affect all connected users.
          </p>
        </div>

        {/* Updates */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title"><Download size={16} /> System Updates</div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-ghost btn-sm" onClick={checkUpdates} disabled={updating}>
                {updating ? <div className="spinner spinner-sm" /> : <RefreshCw size={14} />}
                Check Updates
              </button>
              {updates?.count > 0 && (
                <button className="btn btn-primary btn-sm" onClick={applyUpdates} disabled={updating}>
                  <Download size={14} /> Apply All ({updates.count})
                </button>
              )}
            </div>
          </div>
          {updates ? (
            updates.count > 0 ? (
              <div className="code-block">
                {updates.updates.join('\n')}
              </div>
            ) : (
              <p style={{ color: 'var(--accent-green)', fontSize: '13px' }}>
                ✓ System is up to date
              </p>
            )
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Click "Check Updates" to scan for available packages.
            </p>
          )}
        </div>

        {/* OS Release */}
        {data?.os_release && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div className="card-title"><Clock size={16} /> OS Release</div>
            </div>
            <pre className="code-block">{data.os_release}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
