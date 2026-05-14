import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Network as NetworkIcon, RefreshCw, Wifi, Globe, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function Network() {
  const { data: ifaceData, loading } = useApi('/network/interfaces');
  const { data: dnsData, refetch: refetchDns } = useApi('/network/dns');
  const { data: connData } = useApi('/network/connections');
  const [pingHost, setPingHost] = useState('');
  const [pingResult, setPingResult] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [tab, setTab] = useState('interfaces');

  const doPing = async () => {
    if (!pingHost) return;
    setPinging(true);
    setPingResult(null);
    try {
      const result = await api.post('/network/ping', { host: pingHost });
      setPingResult(result);
    } catch (err) {
      setPingResult({ success: false, output: err.message });
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><NetworkIcon size={28} /><h1>Network</h1></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'interfaces' ? 'active' : ''}`} onClick={() => setTab('interfaces')}>Interfaces</button>
        <button className={`tab ${tab === 'dns' ? 'active' : ''}`} onClick={() => setTab('dns')}>DNS</button>
        <button className={`tab ${tab === 'connections' ? 'active' : ''}`} onClick={() => setTab('connections')}>Connections</button>
        <button className={`tab ${tab === 'ping' ? 'active' : ''}`} onClick={() => setTab('ping')}>Ping</button>
      </div>

      {tab === 'interfaces' && (
        <div className="card">
          {loading ? (
            <div className="loading-container"><div className="spinner" /></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Interface</th><th>Status</th><th>Address</th><th>Speed</th><th>MTU</th></tr></thead>
              <tbody>
                {(ifaceData?.interfaces || []).map((iface) => (
                  <tr key={iface.name}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{iface.name}</td>
                    <td>
                      <span className={`badge ${iface.is_up ? 'badge-success' : 'badge-danger'}`}>
                        {iface.is_up ? 'UP' : 'DOWN'}
                      </span>
                    </td>
                    <td className="mono">
                      {iface.addresses?.filter(a => a.family === 'AF_INET').map(a => a.address).join(', ') || '—'}
                    </td>
                    <td>{iface.speed ? `${iface.speed} Mbps` : '—'}</td>
                    <td>{iface.mtu || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'dns' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Globe size={16} /> DNS Nameservers</div>
          </div>
          {dnsData?.nameservers?.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {dnsData.nameservers.map((ns, i) => (
                <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                  {ns}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No nameservers configured</p>
          )}
          {dnsData?.raw && (
            <details style={{ marginTop: 'var(--space-md)' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }}>Raw resolv.conf</summary>
              <pre className="code-block" style={{ marginTop: 'var(--space-sm)' }}>{dnsData.raw}</pre>
            </details>
          )}
        </div>
      )}

      {tab === 'connections' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><Wifi size={16} /> Active Connections</div></div>
          <pre className="code-block">{connData?.output || 'Loading...'}</pre>
        </div>
      )}

      {tab === 'ping' && (
        <div className="card">
          <div className="card-header"><div className="card-title"><Send size={16} /> Ping Test</div></div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
            <input className="form-input" placeholder="Host or IP address" value={pingHost} onChange={(e) => setPingHost(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doPing()} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={doPing} disabled={pinging || !pingHost}>
              {pinging ? <div className="spinner spinner-sm" /> : <Send size={15} />} Ping
            </button>
          </div>
          {pingResult && (
            <>
              <div className={`alert ${pingResult.success ? 'alert-success' : 'alert-error'}`}>
                {pingResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {pingResult.success ? 'Host is reachable' : 'Host is unreachable'}
              </div>
              <pre className="code-block">{pingResult.output}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
