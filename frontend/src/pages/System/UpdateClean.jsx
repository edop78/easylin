import { useState } from 'react';
import api from '../../api/client';
import { RefreshCw, Download, Trash2, ShieldCheck, AlertCircle, CheckCircle, Terminal, Info } from 'lucide-react';

const MAINTENANCE_TASKS = [
  { id: 'update', name: 'APT Update', icon: RefreshCw, desc: 'Updates the list of available packages and their versions.', color: 'blue' },
  { id: 'upgrade', name: 'APT Upgrade', icon: Download, desc: 'Installs newer versions of the packages you have.', color: 'green' },
  { id: 'full-upgrade', name: 'APT Full Upgrade', icon: Download, desc: 'Upgrades packages and handles changing dependencies.', color: 'green' },
  { id: 'dist-upgrade', name: 'APT Dist Upgrade', icon: Download, desc: 'Advanced upgrade that manages complex dependency changes.', color: 'cyan' },
  { id: 'autoremove', name: 'APT Autoremove', icon: Trash2, desc: 'Removes packages that were installed as dependencies but are no longer needed.', color: 'amber' },
  { id: 'clean', name: 'APT Clean', icon: Trash2, desc: 'Clears out the local repository of retrieved package files.', color: 'amber' },
  { id: 'fix-broken', name: 'Fix Broken', icon: ShieldCheck, desc: 'Attempts to correct a system with broken dependencies in place.', color: 'red' },
  { id: 'fix-dpkg', name: 'Fix Interrupted', icon: ShieldCheck, desc: 'Configures any packages that were unpacked but not configured.', color: 'red' },
  { id: 'vacuum-logs', name: 'Clean Logs', icon: Trash2, desc: 'Deletes system logs older than 7 days to free up space.', color: 'cyan' },
  { id: 'purge-configs', name: 'Purge Configs', icon: Trash2, desc: 'Removes residual configuration files from uninstalled packages.', color: 'amber' },
  { id: 'release-upgrade', name: 'OS Release Upgrade', icon: ShieldCheck, desc: 'Upgrades to the next stable Ubuntu version.', color: 'purple' },
  { id: 'release-upgrade-dev', name: 'OS Release Upgrade (Dev)', icon: ShieldCheck, desc: 'Upgrades to the next development Ubuntu version.', color: 'purple' },
];

export default function UpdateClean() {
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);

  const runTask = async (task) => {
    setRunning(task.id);
    setResult(null);
    try {
      const response = await api.post('/system/maintenance', { command: task.id });
      setResult({ ...response, task: task.name });
    } catch (err) {
      setResult({ success: false, stderr: err.message, task: task.name });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><RefreshCw size={28} /><h1>Update & Clean</h1></div>
      </div>

      <div className="alert alert-info">
        <Info size={16} />
        These actions will run commands on the host system. Upgrades may take several minutes to complete.
      </div>

      <div className="grid-2">
        {MAINTENANCE_TASKS.map((task) => (
          <div key={task.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                <div style={{ color: `var(--accent-${task.color})` }}><task.icon size={20} /></div>
                <h3 style={{ margin: 0 }}>{task.name}</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.4', marginBottom: 'var(--space-md)' }}>
                {task.desc}
              </p>
            </div>
            <button 
              className={`btn ${task.color === 'blue' || task.color === 'cyan' ? 'btn-primary' : task.color === 'amber' ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => runTask(task)}
              disabled={running !== null}
              style={task.color === 'amber' ? { color: 'var(--accent-amber)', borderColor: 'var(--accent-amber-dim)' } : {}}
            >
              {running === task.id ? <div className="spinner spinner-sm" /> : 'Run Now'}
            </button>
          </div>
        ))}
      </div>

      {/* Result Modal */}
      {result && (
        <div className="modal-overlay" onClick={() => setResult(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              {result.success ? (
                <div style={{ color: 'var(--accent-green)' }}><CheckCircle size={28} /></div>
              ) : (
                <div style={{ color: 'var(--accent-red)' }}><AlertCircle size={28} /></div>
              )}
              <h3 className="modal-title">{result.task} {result.success ? 'Completed' : 'Failed'}</h3>
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Command Output:</div>
              <pre className="code-block" style={{ maxHeight: '400px', fontSize: '12px' }}>
                {result.stdout || 'No output.'}
                {result.stderr && `\n\nERRORS:\n${result.stderr}`}
              </pre>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
