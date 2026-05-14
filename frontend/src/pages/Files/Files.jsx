import { useState, useEffect } from 'react';
import api from '../../api/client';
import { FolderOpen, File, Folder, ArrowLeft, Save, RefreshCw, AlertCircle } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

export default function Files() {
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editFile, setEditFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDir = async (dirPath) => {
    setLoading(true);
    setEditFile(null);
    setError('');
    try {
      const result = await api.get(`/files/browse?path=${encodeURIComponent(dirPath)}`);
      setEntries(result.entries || []);
      setPath(dirPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDir('/'); }, []);

  const openFile = async (filePath) => {
    try {
      const result = await api.get(`/files/read?path=${encodeURIComponent(filePath)}`);
      setEditFile(filePath);
      setFileContent(result.content);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveFile = async () => {
    setSaving(true);
    try {
      await api.put('/files/write', { path: editFile, content: fileContent });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const goUp = () => {
    const parent = path.split('/').slice(0, -1).join('/') || '/';
    loadDir(parent);
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><FolderOpen size={28} /><h1>File Manager</h1></div>
        <button className="btn btn-ghost" onClick={() => loadDir(path)}><RefreshCw size={15} /> Refresh</button>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', fontSize: '13px' }}>
        <button className="btn btn-ghost btn-sm" onClick={goUp} disabled={path === '/'}><ArrowLeft size={14} /></button>
        <code style={{ background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px', flex: 1 }}>
          {editFile || path}
        </code>
        {editFile && (
          <button className="btn btn-primary btn-sm" onClick={saveFile} disabled={saving}>
            {saving ? <div className="spinner spinner-sm" /> : <Save size={14} />} Save
          </button>
        )}
        {editFile && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditFile(null); loadDir(path); }}>Back</button>
        )}
      </div>

      {/* Editor or File List */}
      {editFile ? (
        <div className="card" style={{ padding: 0 }}>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '500px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: 'none',
              padding: 'var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'vertical',
              outline: 'none',
              borderRadius: 'var(--radius-md)',
            }}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="card">
          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Size</th><th>Permissions</th><th>Modified</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.name}
                    style={{ cursor: 'pointer' }}
                    onClick={() => entry.is_dir ? loadDir(entry.path) : openFile(entry.path)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-primary)' }}>
                        {entry.is_dir ? <Folder size={16} style={{ color: 'var(--accent-amber)' }} /> : <File size={16} style={{ color: 'var(--text-muted)' }} />}
                        {entry.name}
                        {entry.is_link && <span style={{ color: 'var(--accent-cyan)', fontSize: '11px' }}>→</span>}
                      </div>
                    </td>
                    <td>{entry.is_dir ? '—' : formatSize(entry.size)}</td>
                    <td className="mono">{entry.permissions}</td>
                    <td style={{ fontSize: '12px' }}>{formatDate(entry.modified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
