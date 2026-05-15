import { useState, useEffect } from 'react';
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
  ChevronRight,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Network() {
  const { data: ifaces, loading, refetch: refetchIfaces } = useApi('/network/interfaces');
  const { data: status } = useApi('/network/status');
  
  const [activeTab, setActiveTab] = useState('interfaces');
  const [editingIface, setEditingIface] = useState(null);
  const [form, setForm] = useState({ dhcp: true, address: '', gateway: '', dns: '8.8.8.8, 1.1.1.1' });
  const [isApplying, setIsApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const [applyLog, setApplyLog] = useState('');
  const [message, setMessage] = useState(null);

  // Carica i dettagli reali quando si apre il modal
  const openEditor = async (iface) => {
    setEditingIface(iface);
    setDiagData(null);
    setApplyLog('');
    setMessage(null);
    
    try {
      const res = await api.get(`/network/interfaces/${iface.name}/config`);
      setDiagData(res);
      setForm({
        dhcp: res.saved.dhcp,
        address: res.saved.address || (iface.ip !== 'N/A' ? `${iface.ip}/24` : ''),
        gateway: res.saved.gateway || '',
        dns: res.saved.dns || '8.8.8.8, 1.1.1.1'
      });
    } catch (err) {
      console.error("Failed to fetch interface details", err);
    }
  };

  const handleApply = async () => {
    setShowConfirm(false);
    setIsApplying(true);
    setApplyLog("Initializing atomic network update...\n");
    
    try {
      const res = await api.post(`/network/interfaces/${editingIface.name}/config`, {
        ...form,
        dns: form.dns.split(',').map(s => s.trim())
      });
      
      setApplyLog(prev => prev + res.log);
      setMessage({ type: 'success', text: "Configuration pushed to host. Reconnect if IP changed." });
      
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
            <h1>Network Infrastructure</h1>
            <p className="subtitle">Manage interfaces, IP addressing and routing authority</p>
          </div>
        </div>
        {status && (
          <div className="status-badge-group">
            <div className={`status-pill ${status.active_driver !== 'unknown' ? 'online' : 'offline'}`}>
              <Cpu size={14} /> {status.active_driver.toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button className={`tab-btn ${activeTab === 'interfaces' ? 'active' : ''}`} onClick={() => setActiveTab('interfaces')}>
            <Settings2 size={16} /> Interfaces
          </button>
          <button className={`tab-btn ${activeTab === 'dns' ? 'active' : ''}`} onClick={() => setActiveTab('dns')}>
            <Globe size={16} /> Global DNS
          </button>
          <button className={`tab-btn ${activeTab === 'diag' ? 'active' : ''}`} onClick={() => setActiveTab('diag')}>
            <Activity size={16} /> Diagnostics
          </button>
        </div>
      </div>

      {activeTab === 'interfaces' && (
        <div className="grid-list">
          {loading ? (
            <div className="loading-state"><RefreshCw className="spin" /> Scanning interfaces...</div>
          ) : (
            (ifaces?.interfaces || []).map(iface => (
              <div key={iface.name} className="interface-card card">
                <div className="iface-header">
                  <div className="iface-info">
                    <div className={`status-indicator ${iface.is_up ? 'active' : 'inactive'}`}></div>
                    <h3>{iface.name}</h3>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEditor(iface)}>
                    <Edit3 size={14} /> Configure
                  </button>
                </div>
                
                <div className="iface-details">
                  <div className="detail-item">
                    <span>IP Address</span>
                    <strong className="mono">{iface.ip}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Netmask</span>
                    <strong className="mono">{iface.netmask}</strong>
                  </div>
                  <div className="detail-item">
                    <span>MAC Address</span>
                    <strong className="mono text-muted">{iface.mac}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Interface Editor Modal */}
      {editingIface && (
        <div className="modal-overlay" onClick={() => !isApplying && setEditingIface(null)}>
          <div className="modal-content network-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="icon-container accent"><Settings2 size={20} /></div>
                <h3>Configure {editingIface.name}</h3>
              </div>
              <button className="close-btn" onClick={() => setEditingIface(null)} disabled={isApplying}>&times;</button>
            </div>

            <div className="modal-body">
              {/* Alert Warning */}
              <div className="premium-alert warning">
                <AlertTriangle size={20} />
                <div>
                  <strong>Authority Warning:</strong> Changes will be applied using the <code>{diagData?.saved?.driver || 'detected'}</code> driver. 
                  Misconfiguration will lead to loss of access.
                </div>
              </div>

              {/* State Comparison */}
              <div className="comparison-grid">
                <div className="state-box">
                  <label>Current OS State (Live)</label>
                  <div className="value success mono">{diagData?.live?.address || 'Detecting...'}</div>
                </div>
                <div className="state-box">
                  <label>Configured in {diagData?.saved?.driver || 'Files'}</label>
                  <div className={`value mono ${diagData?.live?.address?.split('/')[0] === diagData?.saved?.address?.split('/')[0] ? '' : 'warning'}`}>
                    {diagData?.saved?.address || 'DHCP'}
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="config-form">
                <div className="form-row">
                  <div className="toggle-group">
                    <div className="toggle-info">
                      <h4>Automatic Configuration</h4>
                      <p>Obtain IP address automatically via DHCP</p>
                    </div>
                    <label className="premium-switch">
                      <input type="checkbox" checked={form.dhcp} onChange={e => setForm({...form, dhcp: e.target.checked})} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>

                {!form.dhcp && (
                  <div className="static-fields fade-in">
                    <div className="form-field">
                      <label>IPv4 Address / CIDR</label>
                      <input 
                        type="text" 
                        value={form.address} 
                        onChange={e => setForm({...form, address: e.target.value})}
                        placeholder="e.g. 192.168.1.100/24"
                      />
                    </div>
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Gateway</label>
                        <input 
                          type="text" 
                          value={form.gateway} 
                          onChange={e => setForm({...form, gateway: e.target.value})}
                          placeholder="192.168.1.1"
                        />
                      </div>
                      <div className="form-field">
                        <label>DNS Servers</label>
                        <input 
                          type="text" 
                          value={form.dns} 
                          onChange={e => setForm({...form, dns: e.target.value})}
                          placeholder="8.8.8.8, 1.1.1.1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Command Log */}
              {applyLog && (
                <div className="terminal-box">
                  <div className="terminal-header"><Terminal size={12} /> Host Execution Log</div>
                  <pre>{applyLog}</pre>
                </div>
              )}

              {message && (
                <div className={`status-message ${message.type}`}>
                  {message.type === 'success' ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                  {message.text}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditingIface(null)} disabled={isApplying}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={isApplying}>
                {isApplying ? <RefreshCw className="spin" size={18} /> : "Apply Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showConfirm}
        title="Apply Network Changes?"
        message="The system will rewrite the host configuration and force the network stack to reload. Your session might drop immediately. Continue?"
        onConfirm={handleApply}
        onCancel={() => setShowConfirm(false)}
        confirmText="Yes, Rewrite & Apply"
        type="warning"
      />

      <style jsx>{`
        .interface-card {
          padding: 24px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: transform 0.2s;
        }
        .interface-card:hover { transform: translateY(-2px); }
        .iface-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .iface-info { display: flex; align-items: center; gap: 12px; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .status-indicator.active { background: #10b981; box-shadow: 0 0 12px rgba(16, 185, 129, 0.4); }
        .status-indicator.inactive { background: #ef4444; }
        .iface-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .detail-item { display: flex; flex-direction: column; gap: 4px; }
        .detail-item span { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .detail-item strong { font-size: 13px; }
        
        .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .state-box { background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .state-box label { display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
        .state-box .value { font-size: 14px; font-weight: 600; }
        .value.success { color: #10b981; }
        .value.warning { color: #f59e0b; }

        .terminal-box { margin-top: 24px; background: #0a0a0a; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
        .terminal-header { background: rgba(255,255,255,0.05); padding: 8px 12px; font-size: 10px; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 8px; }
        .terminal-box pre { padding: 12px; font-size: 11px; color: #3b82f6; margin: 0; max-height: 150px; overflow-y: auto; }

        .premium-alert { display: flex; gap: 16px; padding: 16px; border-radius: 16px; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
        .premium-alert.warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); color: #fbbf24; }

        .toggle-group { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
        .toggle-info h4 { margin: 0; font-size: 14px; }
        .toggle-info p { margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted); }

        .form-field { margin-top: 20px; }
        .form-field label { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; }
        .form-field input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: white; outline: none; transition: border-color 0.2s; }
        .form-field input:focus { border-color: var(--accent-blue); }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .status-message { margin-top: 16px; display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; font-size: 13px; }
        .status-message.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-message.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      `}</style>
    </div>
  );
}
