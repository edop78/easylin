import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Network as NetworkIcon, 
  RefreshCw, 
  Settings2, 
  Globe, 
  Terminal, 
  CheckCircle, 
  AlertTriangle, 
  Edit3, 
  Activity,
  X,
  ShieldCheck,
  Cpu,
  Info
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Network() {
  const { data: ifaces, loading, refetch: refetchIfaces } = useApi('/network/interfaces');
  const { data: status } = useApi('/network/status');
  
  const [activeTab, setActiveTab] = useState('interfaces');
  const [editingIface, setEditingIface] = useState(null);
  const [form, setForm] = useState({ dhcp: true, address: '', netmask: '255.255.255.0', gateway: '', dns: '8.8.8.8, 1.1.1.1' });
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [applyLog, setApplyLog] = useState('');
  const [message, setMessage] = useState(null);

  const openEditor = async (iface) => {
    setEditingIface(iface);
    setDiagData(null);
    setApplyLog('');
    setMessage(null);
    
    try {
      const res = await api.get(`/network/interfaces/${iface.name}/config`);
      setDiagData(res);
      setForm({
        dhcp: res.live.address === 'N/A',
        address: res.live.address !== 'N/A' ? res.live.address : (res.saved.address || ''),
        netmask: res.live.netmask !== 'N/A' ? res.live.netmask : (res.saved.netmask || '255.255.255.0'),
        gateway: res.saved.gateway || '',
        dns: res.saved.dns || '8.8.8.8, 1.1.1.1'
      });
    } catch (err) {
      console.error("Failed to fetch interface details", err);
    }
  };

  const handleApply = async () => {
    setShowConfirm(false);
    // Validazione
    if (!form.dhcp && !form.gateway) {
      setMessage({ type: 'error', text: "Gateway is mandatory for static IP to maintain internet connectivity." });
      return;
    }

    setIsApplying(true);
    const maskToCidr = (mask) => {
      if (!mask.includes('.')) return mask; // Già CIDR
      return mask.split('.').reduce((c, o) => c + (Number(o).toString(2).match(/1/g) || []).length, 0);
    };

    const fullAddress = `${form.address}/${maskToCidr(form.netmask)}`;
    
    try {
      const res = await api.post(`/network/interfaces/${editingIface.name}/config`, {
        ...form,
        address: fullAddress,
        dns: form.dns.split(',').map(s => s.trim())
      });
      
      setApplyLog(prev => prev + res.log);
      setMessage({ type: 'success', text: "Configuration applied. Reconnect if IP changed." });
      
      setTimeout(() => {
        refetchIfaces();
      }, 5000);
    } catch (err) {
      setApplyLog(prev => prev + "\nERROR: " + (err.response?.data?.error || err.message));
      setMessage({ type: 'error', text: "Application failed. Check the log below." });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-container primary"><NetworkIcon size={24} /></div>
          <div>
            <h1>Network</h1>
            <p className="subtitle">System interfaces and routing authority</p>
          </div>
        </div>
        {status && (
          <div className="status-badge-group">
            <div className="status-pill online" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <Cpu size={14} /> DRIVER: {status.active_driver?.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'interfaces' ? 'active' : ''}`} onClick={() => setActiveTab('interfaces')}>Interfaces</button>
        <button className={`tab ${activeTab === 'dns' ? 'active' : ''}`} onClick={() => setActiveTab('dns')}>DNS</button>
        <button className={`tab ${activeTab === 'diag' ? 'active' : ''}`} onClick={() => setActiveTab('diag')}>Diagnostics</button>
      </div>

      {activeTab === 'interfaces' && (
        <div className="grid-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
          {loading ? (
            <div className="loading-container"><RefreshCw className="spin" /></div>
          ) : (
            (ifaces?.interfaces || []).map(iface => (
              <div key={iface.name} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: iface.is_up ? '#10b981' : '#ef4444', boxShadow: iface.is_up ? '0 0 12px rgba(16,185,129,0.4)' : 'none' }}></div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{iface.name}</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEditor(iface)}>
                    <Edit3 size={14} style={{ marginRight: '6px' }} /> Configure
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="stat-item">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IP Address</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', marginTop: '4px' }}>{iface.ip}</div>
                  </div>
                  <div className="stat-item">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>MAC Address</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>{iface.mac}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {editingIface && (
        <div className="modal-overlay" onClick={() => !isApplying && setEditingIface(null)}>
          <div className="modal-content" style={{ maxWidth: '550px', padding: '0' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Settings2 size={20} className="text-accent" />
                <h3 style={{ margin: 0 }}>Configure {editingIface.name}</h3>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setEditingIface(null)} disabled={isApplying}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Authority Info */}
              <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: '#fbbf24', lineHeight: '1.5' }}>
                  <strong>Authority Warning:</strong> Changes will be applied using the <strong>{diagData?.saved?.driver || 'detected'}</strong> driver. Misconfiguration may drop connection.
                </div>
              </div>

              {/* Stats Comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Live State</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#10b981' }}>{diagData?.live?.address || 'Detecting...'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Mask: {diagData?.live?.netmask}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Source: {diagData?.saved?.driver}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: diagData?.live?.address === diagData?.saved?.address ? 'inherit' : '#f59e0b' }}>
                    {diagData?.saved?.address || 'DHCP'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Mask: {diagData?.saved?.netmask}</div>
                </div>
              </div>

              {/* Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>Automatic Configuration</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Use DHCP to obtain IP automatically</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={form.dhcp} onChange={e => setForm({...form, dhcp: e.target.checked})} />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Static Fields */}
              {!form.dhcp && (
                <div className="fade-in">
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">IPv4 Address</label>
                      <input className="input" type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="e.g. 192.168.1.100" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subnet Mask</label>
                      <input className="input" type="text" value={form.netmask} onChange={e => setForm({...form, netmask: e.target.value})} placeholder="255.255.255.0" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Gateway <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                      <input className="input" type="text" value={form.gateway} onChange={e => setForm({...form, gateway: e.target.value})} placeholder="192.168.1.1" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">DNS Servers <span style={{ color: 'var(--accent-red)' }}>*</span></label>
                      <input className="input" type="text" value={form.dns} onChange={e => setForm({...form, dns: e.target.value})} placeholder="8.8.8.8, 1.1.1.1" />
                    </div>
                  </div>

                  {!form.gateway && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--accent-red)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--accent-red)' }}>Warning: Missing gateway will break internet access (GitHub, Updates).</span>
                    </div>
                  )}
                </div>
              )}

              {/* Log Console */}
              {applyLog && (
                <div style={{ marginTop: '32px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={12} /> Execution Log
                  </div>
                  <pre style={{ margin: 0, padding: '16px', background: '#000', color: '#3b82f6', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(59,130,246,0.2)', overflowX: 'auto', maxHeight: '120px' }}>
                    {applyLog}
                  </pre>
                </div>
              )}

              {message && (
                <div className={`alert alert-${message.type}`} style={{ marginTop: '24px' }}>
                  {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {message.text}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.01)' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingIface(null)} disabled={isApplying}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 2 }} 
                onClick={() => setShowConfirm(true)} 
                disabled={isApplying || (!form.dhcp && (!form.address || !form.gateway))}
              >
                {isApplying ? <RefreshCw className="spin" size={18} /> : "Apply Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showConfirm}
        title="Apply Network Changes?"
        message="This will rewrite system files and force a network reload. You may lose connection immediately."
        onConfirm={handleApply}
        onCancel={() => setShowConfirm(false)}
        confirmText="Confirm & Apply"
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
        .text-accent { color: var(--accent-blue); }
      `}} />
    </div>
  );
}
