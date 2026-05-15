import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  GitBranch, Plus, RefreshCw, Trash2, Terminal, 
  ExternalLink, Folder, Play, CheckCircle, AlertTriangle, X,
  Clock, Code, Settings
} from 'lucide-react';

export default function GitProjects() {
  const { data, loading, refetch } = useApi('/git');
  const [isAdding, setIsAdding] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [consoleLog, setConsoleLog] = useState(null);
  const [form, setForm] = useState({ name: '', repo_url: '', local_path: '/app/projects/', post_build_cmds: '' });

  const handleClone = async () => {
    try {
      await api.post('/git/clone', form);
      setIsAdding(false);
      refetch();
    } catch (err) {
      alert("Clone failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSync = async (project) => {
    setSyncingId(project.id);
    try {
      const res = await api.post(`/git/${project.id}/sync`);
      setConsoleLog({ name: project.name, log: res.log, success: res.success });
      refetch();
    } catch (err) {
      setConsoleLog({ 
        name: project.name, 
        log: err.response?.data?.log || err.message, 
        success: false 
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Remove this project from EasyLin? (Files will not be deleted)")) {
      await api.delete(`/git/${id}`);
      refetch();
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-container primary"><GitBranch size={24} /></div>
          <div>
            <h1>Git Projects</h1>
            <p className="subtitle">Manage, sync and auto-build your repositories</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          <Plus size={18} /> New Project
        </button>
      </div>

      <div className="grid-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
        {loading ? (
          <div className="loading-container"><RefreshCw className="spin" /></div>
        ) : (
          (data?.projects || []).map(project => (
            <div key={project.id} className="card project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', padding: '10px', borderRadius: '12px' }}>
                    <Code size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{project.name}</h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Folder size={10} /> {project.local_path}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-icon btn-ghost" onClick={() => handleSync(project)} disabled={syncingId === project.id}>
                    <RefreshCw size={16} className={syncingId === project.id ? 'spin' : ''} />
                  </button>
                  <button className="btn btn-icon btn-ghost text-red" onClick={() => handleDelete(project.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ExternalLink size={12} /> Repository
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.repo_url}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  Last Sync: {project.last_sync ? new Date(project.last_sync).toLocaleString() : 'Never'}
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => setConsoleLog({ name: project.name, log: 'History not implemented yet.', success: true })}>
                  <Terminal size={12} style={{ marginRight: '6px' }} /> Logs
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clone Modal */}
      {isAdding && (
        <div className="modal-overlay" onClick={() => setIsAdding(false)}>
          <div className="modal-content" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Plus size={20} className="text-accent" />
                <h3 style={{ margin: 0 }}>Clone New Repository</h3>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setIsAdding(false)}><X size={20} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Project Name</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. My Awesome App" />
            </div>

            <div className="form-group">
              <label className="form-label">Git Repository URL</label>
              <input className="input" value={form.repo_url} onChange={e => setForm({...form, repo_url: e.target.value})} placeholder="https://github.com/user/repo.git" />
            </div>

            <div className="form-group">
              <label className="form-label">Local Destination Path</label>
              <input className="input" value={form.local_path} onChange={e => setForm({...form, local_path: e.target.value})} placeholder="/app/projects/myapp" />
            </div>

            <div className="form-group">
              <label className="form-label">Post-Build Commands (one per line)</label>
              <textarea 
                className="input" 
                style={{ height: '100px', padding: '12px' }}
                value={form.post_build_cmds} 
                onChange={e => setForm({...form, post_build_cmds: e.target.value})} 
                placeholder="docker compose up -d --build&#10;npm install&#10;npm run build" 
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                <Settings size={10} /> Commands will be executed inside the project folder after every successful pull.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsAdding(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleClone} disabled={!form.name || !form.repo_url}>
                Clone & Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Console Modal */}
      {consoleLog && (
        <div className="modal-overlay" onClick={() => setConsoleLog(null)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {consoleLog.success ? <CheckCircle className="text-green" size={20} /> : <AlertTriangle className="text-red" size={20} />}
                <h3 style={{ margin: 0 }}>Sync Result: {consoleLog.name}</h3>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setConsoleLog(null)}><X size={20} /></button>
            </div>

            <pre style={{ 
              background: '#000', 
              color: consoleLog.success ? '#10b981' : '#ef4444', 
              padding: '24px', 
              borderRadius: '12px', 
              fontSize: '12px', 
              maxHeight: '450px', 
              overflow: 'auto', 
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.6',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {consoleLog.log}
            </pre>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={() => setConsoleLog(null)}>Close Console</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .project-card { transition: all 0.3s ease; border: 1px solid var(--border-color); }
        .project-card:hover { transform: translateY(-4px); border-color: var(--accent-blue); box-shadow: 0 12px 24px rgba(0,0,0,0.2); }
        .text-red { color: #ef4444 !important; }
        .text-green { color: #10b981 !important; }
        .text-accent { color: var(--accent-blue); }
      `}} />
    </div>
  );
}
