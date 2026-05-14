import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Network as NetworkIcon, RefreshCw, Wifi, Globe, Send, CheckCircle, AlertCircle, Edit2, ShieldAlert } from 'lucide-react';

export default function Network() {
  const { data: ifaceData, loading } = useApi('/network/interfaces');
  const { data: dnsData, refetch: refetchDns } = useApi('/network/dns');
  const { data: connData } = useApi('/network/connections');
  
  const [tab, setTab] = useState('interfaces');
  const [pingHost, setPingHost] = useState('');
  const [pingResult, setPingResult] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [editIface, setEditIface] = useState(null);
  const [config, setConfig] = useState({ dhcp: true, address: '', gateway: '', dns: '8.8.8.8, 1.1.1.1' });
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState(null);

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

  const openEdit = (iface) => {
    const addr = iface.addresses?.find(a => a.family === 'AF_INET');
    setEditIface(iface.name);
    setConfig({
      dhcp: true,
      address: addr ? `${addr.address}/24` : '',
      gateway: '',
      dns: '8.8.8.8, 1.1.1.1'
    });
  };

  const applyConfig = async () => {
    if (!confirm("WARNING: Applying new network settings may disconnect your current session. If you set a wrong IP, you might lose access to the server. Continue?")) return;

    setApplying(true);
    setMsg(null);
    try {
      const result = await api.post(`/network/interfaces/${editIface}/config`, {
        ...config,
        dns: config.dns.split(',').map(s => s.trim())
      });
      setMsg({ type: 'success', text: result.message });
      setEditIface(null);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><NetworkIcon size={28} /><h1>Network</h1></div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: 'var(--space-md)' }}>
          {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {msg.text}
        </div>
      )}

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
              <thead><tr><th>Interface</th><th>Status</th><th>Address</th><th>Speed</th><th>Actions</th></tr></thead>
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
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(iface)} title="Configure">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editIface && (
        <div className="modal-overlay" onClick={() => setEditIface(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Configure {editIface}</h3>

            <div className="alert alert-warning" style={{ fontSize: '12px' }}>
              <ShieldAlert size={16} />
              Changing network settings can lead to <strong>disconnection</strong> and loss of access if misconfigured.
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Use DHCP</label>
              <input
                type="checkbox"
                checked={config.dhcp}
                onChange={(e) => setConfig({ ...config, dhcp: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
            </div>

            {!config.dhcp && (
              <div className="fade-in" style={{ marginTop: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">IP Address (with CIDR, e.g. /24)</label>
                  <input
                    className="form-input"
                    value={config.address}
                    onChange={(e) => setConfig({ ...config, address: e.target.value })}
                    placeholder="192.168.1.100/24"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gateway</label>
                  <input
                    className="form-input"
                    value={config.gateway}
                    onChange={(e) => setConfig({ ...config, gateway: e.target.value })}
                    placeholder="192.168.1.1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">DNS Servers (comma separated)</label>
                  <input
                    className="form-input"
                    value={config.dns}
                    onChange={(e) => setConfig({ ...config, dns: e.target.value })}
                    placeholder="8.8.8.8, 1.1.1.1"
                  />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditIface(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={applyConfig} disabled={applying}>
                {applying ? <div className="spinner spinner-sm" /> : "Apply Changes"}
              </button>
            </div>
          </div>
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
