import { useState } from 'react';
import api from '../../api/client';
import { RefreshCw, Download, Trash2, ShieldCheck, AlertCircle, CheckCircle, Info, Wind, Copy } from 'lucide-react';

const MAINTENANCE_TASKS = [
  { id: 'update', cat: 'update', name: 'APT Update', icon: RefreshCw, desc: 'Updates the list of available packages and their versions.', color: 'blue' },
  { id: 'upgrade', cat: 'update', name: 'APT Upgrade', icon: Download, desc: 'Installs newer versions of the packages you have.', color: 'green' },
  { id: 'full-upgrade', cat: 'update', name: 'APT Full Upgrade', icon: Download, desc: 'Upgrades packages and handles changing dependencies.', color: 'green' },
  { id: 'dist-upgrade', cat: 'update', name: 'APT Dist Upgrade', icon: Download, desc: 'Advanced upgrade that manages complex dependency changes.', color: 'cyan' },
  { id: 'fix-broken', cat: 'update', name: 'Fix Broken', icon: ShieldCheck, desc: 'Attempts to correct a system with broken dependencies in place.', color: 'red' },
  { id: 'fix-dpkg', cat: 'update', name: 'Fix Interrupted', icon: ShieldCheck, desc: 'Configures any packages that were unpacked but not configured.', color: 'red' },
  { id: 'release-upgrade', cat: 'update', name: 'OS Release Upgrade', icon: ShieldCheck, desc: 'Upgrades to the next stable Ubuntu version.', color: 'purple' },
  { id: 'release-upgrade-dev', cat: 'update', name: 'OS Release Upgrade (Dev)', icon: ShieldCheck, desc: 'Upgrades to the next development Ubuntu version.', color: 'purple' },
  
  { id: 'autoremove', cat: 'clean', name: 'APT Autoremove', icon: Trash2, desc: 'Removes packages that were installed as dependencies but are no longer needed.', color: 'amber' },
  { id: 'clean', cat: 'clean', name: 'APT Clean', icon: Trash2, desc: 'Clears out the local repository of retrieved package files.', color: 'amber' },
  { id: 'vacuum-logs', cat: 'clean', name: 'Clean Logs', icon: Trash2, desc: 'Deletes system logs older than 7 days to free up space.', color: 'cyan' },
  { id: 'purge-configs', cat: 'clean', name: 'Purge Configs', icon: Trash2, desc: 'Removes residual configuration files from uninstalled packages.', color: 'amber' },
  { id: 'docker-prune', cat: 'clean', name: 'Docker Prune', icon: Trash2, desc: 'Removes all unused Docker containers, networks, and images.', color: 'blue' },
];

export default function UpdateClean() {
  const [tab, setTab] = useState('update');
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const runTask = async (task) => {
    setRunning(task.id);
    setResult({ success: true, stdout: 'Starting maintenance task...\n', stderr: '', task: task.name });
    
    try {
      // 1. Start the asynchronous background task on the server
      const startRes = await api.post('/system/maintenance/start', { command: task.id });
      if (!startRes.success) {
        throw new Error(startRes.error || 'Failed to start task');
      }

      // 2. Poll the status GET endpoint every 1.5 seconds until the task completes
      let polling = true;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5;

      while (polling) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        try {
          const statusRes = await api.get(`/system/maintenance/status/${task.id}`);
          consecutiveErrors = 0; // Reset error counter on success
          
          setResult(prev => ({
            ...prev,
            stdout: statusRes.stdout || '',
            success: statusRes.success !== false
          }));

          if (!statusRes.running) {
            polling = false;
            setResult(prev => ({
              ...prev,
              success: statusRes.success,
              stdout: statusRes.stdout || ''
            }));
          }
        } catch (pollErr) {
          consecutiveErrors++;
          console.warn(`Polling status failed (attempt ${consecutiveErrors}/${maxConsecutiveErrors}):`, pollErr);
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(`Lost connection to server: ${pollErr.message}`);
          }
          
          // Print a friendly reconnection message inside the console log
          setResult(prev => ({
            ...prev,
            stdout: prev.stdout + `\n[System] Temporary network interruption. Reconnecting... (Attempt ${consecutiveErrors}/${maxConsecutiveErrors})\n`
          }));
        }
      }
    } catch (err) {
      setResult({ success: false, stderr: err.message, task: task.name });
    } finally {
      setRunning(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTasks = MAINTENANCE_TASKS.filter(t => t.cat === tab);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><RefreshCw size={28} /><h1>Update & Clean</h1></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'update' ? 'active' : ''}`} onClick={() => setTab('update')}>
          <RefreshCw size={14} /> Updates & Fixes
        </button>
        <button className={`tab ${tab === 'clean' ? 'active' : ''}`} onClick={() => setTab('clean')}>
          <Wind size={14} /> Cleaning & Space
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 'var(--space-lg)' }}>
        <Info size={16} />
        {tab === 'update' 
          ? "Keep your system up to date and repair package manager issues." 
          : "Free up disk space and remove unnecessary files from your server."
        }
      </div>

      <div className="grid-2">
        {filteredTasks.map((task) => (
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
              {running === task.id ? <RefreshCw size={16} className="spin" /> : 'Run Now'}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div className="modal-overlay" onClick={() => setResult(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {result.success ? (
                  <div style={{ color: 'var(--accent-green)' }}><CheckCircle size={28} /></div>
                ) : (
                  <div style={{ color: 'var(--accent-red)' }}><AlertCircle size={28} /></div>
                )}
                <h3 className="modal-title" style={{ margin: 0 }}>{result.task} {result.success ? 'Completed' : 'Failed'}</h3>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard((result.stdout || '') + (result.stderr ? `\n\nERRORS:\n${result.stderr}` : ''))}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : result.success ? 'Copy Log' : 'Copy Error'}
              </button>
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Command Output:</div>
              <pre className="code-block" style={{ maxHeight: '400px', fontSize: '12px', overflow: 'auto' }}>
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
