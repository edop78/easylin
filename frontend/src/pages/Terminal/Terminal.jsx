import { useState, useRef, useEffect } from 'react';
import api from '../../api/client';
import { TerminalSquare, Send } from 'lucide-react';

export default function Terminal() {
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('/');
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [cmdHistory, setCmdHistory] = useState([]);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommand = async (e) => {
    e?.preventDefault();
    if (!command.trim() || running) return;

    const cmd = command.trim();
    setCommand('');
    setRunning(true);
    setCmdHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);

    // Add command to output
    setHistory((prev) => [...prev, { type: 'command', text: `${cwd} $ ${cmd}` }]);

    try {
      const result = await api.post('/terminal/execute', { command: cmd, cwd });

      if (result.stdout) {
        setHistory((prev) => [...prev, { type: 'stdout', text: result.stdout }]);
      }
      if (result.stderr) {
        setHistory((prev) => [...prev, { type: 'stderr', text: result.stderr }]);
      }
      if (result.returncode !== 0) {
        setHistory((prev) => [...prev, { type: 'info', text: `Exit code: ${result.returncode}` }]);
      }

      // Update cwd if it was a cd command
      if (cmd.startsWith('cd ')) {
        const newDir = cmd.slice(3).trim();
        if (newDir.startsWith('/')) {
          setCwd(newDir);
        } else if (newDir === '..') {
          setCwd(cwd.split('/').slice(0, -1).join('/') || '/');
        } else {
          setCwd(cwd === '/' ? `/${newDir}` : `${cwd}/${newDir}`);
        }
      }
    } catch (err) {
      setHistory((prev) => [...prev, { type: 'stderr', text: err.message }]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(newIdx);
      if (cmdHistory.length > 0) {
        setCommand(cmdHistory[cmdHistory.length - 1 - newIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(newIdx);
      setCommand(newIdx >= 0 ? cmdHistory[cmdHistory.length - 1 - newIdx] : '');
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><TerminalSquare size={28} /><h1>Terminal</h1></div>
        <button className="btn btn-ghost" onClick={() => setHistory([])}>Clear</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Output */}
        <div
          ref={outputRef}
          style={{
            height: '500px',
            overflowY: 'auto',
            padding: 'var(--space-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.6',
            background: '#0a0c10',
          }}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Welcome Message */}
          {history.length === 0 && (
            <div style={{ color: 'var(--text-muted)' }}>
              EasyLin Terminal — Type commands below.
              <br />Commands are executed on the host system.
            </div>
          )}

          {history.map((entry, i) => (
            <div key={i} style={{
              color: entry.type === 'command' ? 'var(--accent-green)'
                : entry.type === 'stderr' ? 'var(--accent-red)'
                : entry.type === 'info' ? 'var(--accent-amber)'
                : 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {entry.text}
            </div>
          ))}

          {running && (
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="spinner spinner-sm" /> Running...
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={executeCommand}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
          }}
        >
          <span style={{
            padding: '0 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--accent-green)',
            whiteSpace: 'nowrap',
          }}>
            {cwd} $
          </span>
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              outline: 'none',
            }}
            placeholder="Type a command..."
            autoFocus
            disabled={running}
          />
          <button
            type="submit"
            disabled={running || !command.trim()}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-blue)',
              cursor: 'pointer',
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
