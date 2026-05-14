import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { ScrollText, RefreshCw, Search } from 'lucide-react';

export default function Logs() {
  const [tab, setTab] = useState('journal');
  const { data: journalData, loading, refetch } = useApi('/logs/journal?lines=200');
  const { data: unitsData } = useApi('/logs/units');
  const { data: logFilesData } = useApi('/logs/files');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [filteredLogs, setFilteredLogs] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [logLoading, setLogLoading] = useState(false);

  const filterByUnit = async (unit) => {
    setSelectedUnit(unit);
    setLogLoading(true);
    try {
      const result = await api.get(`/logs/journal?unit=${encodeURIComponent(unit)}&lines=200`);
      setFilteredLogs(result.logs);
    } catch (err) {
      alert(err.message);
    } finally {
      setLogLoading(false);
    }
  };

  const readLogFile = async (path) => {
    setSelectedFile(path);
    setLogLoading(true);
    try {
      const result = await api.get(`/logs/file?path=${encodeURIComponent(path)}&lines=200`);
      setFileContent(result.content);
    } catch (err) {
      alert(err.message);
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><ScrollText size={28} /><h1>Logs</h1></div>
        <button className="btn btn-ghost" onClick={refetch}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'journal' ? 'active' : ''}`} onClick={() => { setTab('journal'); setFilteredLogs(null); setSelectedUnit(''); }}>
          Journal
        </button>
        <button className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => { setTab('files'); setFileContent(null); setSelectedFile(''); }}>
          Log Files
        </button>
      </div>

      {tab === 'journal' && (
        <div className="grid-2">
          {/* Unit Filter */}
          <div className="card" style={{ maxHeight: '600px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div className="card-title"><Search size={16} /> Filter by Unit</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div
                style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: !selectedUnit ? 'var(--accent-blue)' : 'var(--text-secondary)', background: !selectedUnit ? 'var(--accent-blue-dim)' : 'transparent' }}
                onClick={() => { setSelectedUnit(''); setFilteredLogs(null); }}
              >
                All logs
              </div>
              {(unitsData?.units || []).map((unit) => (
                <div
                  key={unit}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'var(--font-mono)', color: unit === selectedUnit ? 'var(--accent-blue)' : 'var(--text-secondary)', background: unit === selectedUnit ? 'var(--accent-blue-dim)' : 'transparent' }}
                  onClick={() => filterByUnit(unit)}
                >
                  {unit}
                </div>
              ))}
            </div>
          </div>

          {/* Log Output */}
          <div className="card" style={{ padding: 0 }}>
            {loading || logLoading ? (
              <div className="loading-container"><div className="spinner" /></div>
            ) : (
              <pre className="code-block" style={{ borderRadius: 'var(--radius-md)', margin: 0, maxHeight: '600px', border: 'none' }}>
                {filteredLogs || journalData?.logs || 'No logs available'}
              </pre>
            )}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="grid-2">
          {/* File List */}
          <div className="card" style={{ maxHeight: '600px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div className="card-title"><ScrollText size={16} /> Log Files</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(logFilesData?.files || []).map((file) => (
                <div
                  key={file}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'var(--font-mono)', color: file === selectedFile ? 'var(--accent-blue)' : 'var(--text-secondary)', background: file === selectedFile ? 'var(--accent-blue-dim)' : 'transparent' }}
                  onClick={() => readLogFile(file)}
                >
                  {file}
                </div>
              ))}
              {(logFilesData?.files || []).length === 0 && (
                <div className="empty-state"><p>No log files found</p></div>
              )}
            </div>
          </div>

          {/* File Content */}
          <div className="card" style={{ padding: 0 }}>
            {logLoading ? (
              <div className="loading-container"><div className="spinner" /></div>
            ) : fileContent ? (
              <pre className="code-block" style={{ borderRadius: 'var(--radius-md)', margin: 0, maxHeight: '600px', border: 'none' }}>
                {fileContent}
              </pre>
            ) : (
              <div className="empty-state"><p>Select a log file to view</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
