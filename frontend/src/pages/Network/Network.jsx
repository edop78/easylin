import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Network as NetworkIcon, RefreshCw, Wifi, Globe, Send, CheckCircle, AlertCircle, Edit2, ShieldAlert, X, Info } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Network() {
  const { data: ifaceData, loading, refetch: refetchIfaces } = useApi('/network/interfaces');
  const { data: dnsData, refetch: refetchDns } = useApi('/network/dns');
  const { data: connData } = useApi('/network/connections');
  const { data: netStatus } = useApi('/network/status');
  
  const [tab, setTab] = useState('interfaces');
  const [pingHost, setPingHost] = useState('');
  const [pingResult, setPingResult] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [editIface, setEditIface] = useState(null);
  const [config, setConfig] = useState({ dhcp: true, address: '', gateway: '', dns: '8.8.8.8, 1.1.1.1' });
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

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

  const openEdit = async (iface) => {
    setEditIface(iface.name);
    setApplying(true);
    try {
      const res = await api.get(`/network/interfaces/${iface.name}/config`);
      const { live, saved } = res;
      
      setConfig({
        dhcp: saved.dhcp,
        address: saved.address || (iface.addresses?.find(a => a.family === 'AF_INET')?.address ? `${iface.addresses?.find(a => a.family === 'AF_INET').address}/24` : ''),
        gateway: saved.gateway || '',
        dns: saved.dns || '8.8.8.8, 1.1.1.1',
        liveAddress: live.address
      });
    } catch (err) {
      console.error("Failed to fetch current config", err);
    } finally {
      setApplying(false);
    }
  };

  const applyConfig = async () => {
    setShowConfirm(false);
    setApplying(true);
    setMsg(null);
    try {
      const result = await api.post(`/network/interfaces/${editIface}/config`, {
        ...config,
        dns: config.dns.split(',').map(s => s.trim())
      });
      setMsg({ type: 'success', text: result.message });
      setEditIface(null);
      setTimeout(() => {
        refetchIfaces();
        refetchDns();
      }, 2000);
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
        
        {netStatus && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: netStatus.manager !== 'unknown' ? '#10b981' : '#ef4444' }}></div>
            System: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{netStatus.manager}</span>
          </div>
        )}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit2 size={20} className="text-blue" /> Configure {editIface}
              </h3>
              <button className="btn btn-icon btn-ghost" onClick={() => setEditIface(null)}><RefreshCw size={18} style={{ transform: 'rotate(45deg)' }} /></button>
            </div>

            <div className="alert-box warning" style={{ 
              background: 'rgba(245, 158, 11, 0.1)', 
              border: '1px solid rgba(245, 158, 11, 0.2)', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '24px',
              display: 'flex',
              gap: '12px'
            }}>
              <ShieldAlert size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#fbbf24' }}>
                <strong>Critical Action:</strong> Changing network settings can lead to immediate <strong>disconnection</strong>. Ensure your static settings are correct before applying.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div className="stat-box" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Live IP (Active)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#10b981' }}>{config.liveAddress || 'Unknown'}</div>
              </div>
              <div className="stat-box" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Saved Config</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: config.liveAddress?.split('/')[0] === config.address?.split('/')[0] ? 'var(--text-primary)' : '#f59e0b' }}>
                  {config.address || 'DHCP'}
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              padding: '20px', 
              borderRadius: '16px', 
              border: '1px solid var(--border-color)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Automatic Configuration</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Use DHCP to obtain IP automatically</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={config.dhcp}
                    onChange={(e) => setConfig({ ...config, dhcp: e.target.checked })}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {!config.dhcp && (
                <div className="fade-in" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IPv4 Address / CIDR</label>
                    <input
                      className="input"
                      value={config.address}
                      onChange={(e) => setConfig({ ...config, address: e.target.value })}
                      placeholder="e.g. 192.168.1.100/24"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Gateway</label>
                      <input
                        className="input"
                        value={config.gateway}
                        onChange={(e) => setConfig({ ...config, gateway: e.target.value })}
                        placeholder="192.168.1.1"
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>DNS Servers</label>
                      <input
                        className="input"
                        value={config.dns}
                        onChange={(e) => setConfig({ ...config, dns: e.target.value })}
                        placeholder="8.8.8.8, 1.1.1.1"
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditIface(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setShowConfirm(true)} disabled={applying}>
                {applying ? <RefreshCw className="spin" size={18} /> : "Save & Apply Configuration"}
              </button>
            </div>
          </div>
          
          <ConfirmModal 
            isOpen={showConfirm}
            title="Confirm Network Change"
            message="WARNING: Applying new network settings may disconnect your current session. If you set a wrong IP, you might lose access to the server. Continue?"
            onConfirm={applyConfig}
            onCancel={() => setShowConfirm(false)}
            confirmText="Apply & Reconnect"
            type="warning"
          />

          <style dangerouslySetInnerHTML={{ __html: `
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .4s; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
            input:checked + .slider { background-color: var(--accent-blue); }
            input:checked + .slider:before { transform: translateX(20px); }
            .slider.round { border-radius: 34px; }
            .slider.round:before { border-radius: 50%; }
            .text-blue { color: var(--accent-blue); }
          `}} />
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
