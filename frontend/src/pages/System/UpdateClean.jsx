import { useState, useEffect } from 'react';
import api from '../../api/client';
import { 
  RefreshCw, Download, Trash2, ShieldCheck, AlertCircle, CheckCircle, Info, Wind, Copy, Rocket, GitBranch 
} from 'lucide-react';

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
  { id: 'vacuum-logs', cat: 'clean', name: 'Clean Logs', icon: Trash2, desc: 'Deletes system logs older than 7 days to free up space.', color: 'amber' },
  { id: 'purge-configs', cat: 'clean', name: 'Purge Configs', icon: Trash2, desc: 'Removes residual configuration files from uninstalled packages.', color: 'amber' },
  { id: 'docker-prune', cat: 'clean', name: 'Docker Prune', icon: Trash2, desc: 'Removes all unused Docker containers, networks, and images.', color: 'amber' },
  { id: 'docker-volume-prune', cat: 'clean', name: 'Docker Volume Prune', icon: Trash2, desc: 'Removes all unused Docker volumes to reclaim storage.', color: 'amber' },
  { id: 'docker-builder-prune', cat: 'clean', name: 'Docker Build Cache Prune', icon: Trash2, desc: 'Clears the Docker BuildKit cache to reclaim hidden build space.', color: 'amber' },
];

export default function UpdateClean() {
  const [tab, setTab] = useState('update');
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // EasyLin Self-Update States
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [updateCheckData, setUpdateCheckData] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Auto check updates if tab is 'easylin'
  useEffect(() => {
    if (tab === 'easylin') {
      checkUpdates();
    }
  }, [tab]);

  const checkUpdates = async () => {
    setUpdateCheckLoading(true);
    try {
      const res = await api.get('/system/update/check');
      setUpdateCheckData(res);
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setUpdateCheckData({
        update_available: false,
        commits_behind: 0,
        changelog: [],
        error: err.message || 'Failed to connect'
      });
    } finally {
      setUpdateCheckLoading(false);
    }
  };

  const startSelfUpdate = async () => {
    setUpdating(true);
    setUpdateError('');
    setUpdateStatus({ step: 'started', progress: 5, status: 'running' });
    
    try {
      const res = await api.post('/system/update/run');
      if (!res.success) {
        throw new Error(res.error || 'Failed to start update');
      }
      pollUpdateStatus();
    } catch (err) {
      setUpdateError(err.message || 'Failed to trigger update');
      setUpdating(false);
    }
  };

  const pollUpdateStatus = () => {
    let consecutiveErrors = 0;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/system/update/status');
        consecutiveErrors = 0;
        setUpdateStatus(res);
        
        if (res.step === 'completed') {
          clearInterval(interval);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else if (res.step === 'failed') {
          clearInterval(interval);
          setUpdateError(res.error || 'Update failed on host');
          setUpdating(false);
        }
      } catch (err) {
        consecutiveErrors++;
        console.warn("Polling update status error:", err);
        if (consecutiveErrors >= 2) {
          setUpdateStatus(prev => ({
            ...prev,
            step: 'rebuilding',
            progress: Math.min((prev?.progress || 60) + 1, 95),
            status: 'rebuilding',
            message: 'Recreating container and reconnecting...'
          }));
        }
      }
    }, 2000);
  };

  const runTask = async (task) => {
    setRunning(task.id);
    setResult({ success: true, stdout: 'Starting maintenance task...\n', stderr: '', task: task.name });
    
    try {
      const startRes = await api.post('/system/maintenance/start', { command: task.id });
      if (!startRes.success) {
        throw new Error(startRes.error || 'Failed to start task');
      }

      let polling = true;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5;

      while (polling) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        try {
          const statusRes = await api.get(`/system/maintenance/status/${task.id}`);
          consecutiveErrors = 0;
          
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
        <button className={`tab ${tab === 'easylin' ? 'active' : ''}`} onClick={() => setTab('easylin')}>
          <Rocket size={14} /> EasyLin Update
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 'var(--space-lg)' }}>
        <Info size={16} />
        {tab === 'update' && "Keep your system up to date and repair package manager issues."}
        {tab === 'clean' && "Free up disk space and remove unnecessary files from your server."}
        {tab === 'easylin' && "Check for newer builds and update the EasyLin dashboard container automatically."}
      </div>

      {tab !== 'easylin' ? (
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
      ) : (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {updateCheckLoading ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xxl)' }}>
              <RefreshCw size={40} className="spin" style={{ color: 'var(--accent-blue)', marginBottom: 'var(--space-md)' }} />
              <p style={{ color: 'var(--text-muted)' }}>Checking remote repository for changes...</p>
            </div>
          ) : updateCheckData ? (
            <div className="card" style={{ padding: 'var(--space-xl)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                  <div style={{
                    background: updateCheckData.update_available 
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '12px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <Rocket size={28} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
                      {updateCheckData.update_available ? 'Update Available!' : 'EasyLin is Up to Date'}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      {updateCheckData.update_available 
                        ? `Your installation is ${updateCheckData.commits_behind} update(s) behind the main branch.`
                        : 'You are running the latest stable build of EasyLin.'
                      }
                    </p>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={checkUpdates} disabled={updateCheckLoading}>
                  <RefreshCw size={14} className={updateCheckLoading ? 'spin' : ''} /> Check Again
                </button>
              </div>

              {updateCheckData.update_available && updateCheckData.changelog && updateCheckData.changelog.length > 0 && (
                <div style={{ 
                  background: 'var(--bg-dark)', 
                  borderRadius: '8px', 
                  padding: 'var(--space-md) var(--space-lg)', 
                  marginBottom: 'var(--space-lg)',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ margin: '0 0 var(--space-sm) 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    Recent Commits / Changes
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                    {updateCheckData.changelog.map((commit, index) => (
                      <li key={index} className="mono" style={{ color: 'var(--text-color)' }}>
                        {commit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Branch:</span>
                  <span className="mono" style={{ fontSize: '13px', fontWeight: 600 }}>main (GitHub origin)</span>
                </div>
                {updateCheckData.update_available ? (
                  <button 
                    className="btn" 
                    onClick={startSelfUpdate} 
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-blue) 0%, #3b82f6 100%)',
                      color: 'white',
                      fontWeight: 600,
                      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
                      border: 'none',
                      padding: '10px 24px'
                    }}
                  >
                    Update EasyLin Now
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontSize: '14px', fontWeight: 600 }}>
                    <CheckCircle size={18} /> Running Latest Version
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xxl)' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>No update check has been performed yet.</p>
              <button className="btn btn-primary" onClick={checkUpdates}>Check Now</button>
            </div>
          )}
        </div>
      )}

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

      {(updating || updateError) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 'var(--space-md)'
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
            padding: 'var(--space-xl)',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {updateError ? (
              <>
                <AlertCircle size={48} style={{ color: 'var(--accent-red)', margin: '0 auto var(--space-lg) auto' }} />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 var(--space-sm) 0', color: 'var(--accent-red)' }}>
                  Update Failed
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', marginBottom: 'var(--space-lg)' }}>
                  An error occurred during the update process:
                </p>
                <pre className="code-block" style={{
                  maxHeight: '150px',
                  overflow: 'auto',
                  fontSize: '11px',
                  textAlign: 'left',
                  marginBottom: 'var(--space-xl)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: 'var(--space-md)',
                  borderRadius: '6px'
                }}>
                  {updateError}
                </pre>
                <button className="btn btn-primary" onClick={() => { setUpdateError(''); setUpdating(false); }} style={{ width: '100%' }}>
                  Close
                </button>
              </>
            ) : (
              <>
                {updateStatus?.step === 'completed' ? (
                  <CheckCircle size={48} className="pulse" style={{ color: 'var(--accent-green)', margin: '0 auto var(--space-lg) auto' }} />
                ) : (
                  <RefreshCw size={48} className="spin" style={{ color: 'var(--accent-blue)', margin: '0 auto var(--space-lg) auto' }} />
                )}
                
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 var(--space-sm) 0' }}>
                  {updateStatus?.step === 'completed' ? 'Update Completed!' : 'Updating EasyLin'}
                </h3>
                
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', marginBottom: 'var(--space-xl)' }}>
                  {updateStatus?.step === 'git_pull' && 'Downloading the latest codebase from GitHub...'}
                  {updateStatus?.step === 'docker_build' && 'Building updated container images. This will take a few moments...'}
                  {updateStatus?.step === 'rebuilding' && 'Recreating container instances and reconnecting. Please stand by...'}
                  {updateStatus?.step === 'completed' && 'Update completed successfully! Reloading dashboard...'}
                  {!updateStatus && 'Initializing the self-update engine...'}
                </p>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  height: '8px',
                  width: '100%',
                  overflow: 'hidden',
                  marginBottom: 'var(--space-md)'
                }}>
                  <div style={{
                    background: updateStatus?.step === 'completed' 
                      ? 'linear-gradient(90deg, var(--accent-green) 0%, #10b981 100%)'
                      : 'linear-gradient(90deg, var(--accent-blue) 0%, #3b82f6 100%)',
                    height: '100%',
                    width: `${updateStatus?.progress || 0}%`,
                    transition: 'width 0.4s ease-out',
                    borderRadius: '10px'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Progress</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{updateStatus?.progress || 0}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
