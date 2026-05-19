import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Shield, Plus, Trash2, RefreshCw, Power, PowerOff, AlertCircle, CheckCircle } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Firewall() {
  const { data, loading, refetch } = useApi('/firewall/status');
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ action: 'allow', port: '', protocol: '', from: '' });
  const [message, setMessage] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const toggleFirewall = async () => {
    const action = data?.active ? 'disable' : 'enable';
    setActionLoading(true);
    try {
      await api.post(`/firewall/${action}`);
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const addRule = async (e) => {
    e.preventDefault();
    try {
      const result = await api.post('/firewall/rules', newRule);
      setMessage({ type: result.success ? 'success' : 'error', text: result.success ? 'Rule added' : result.error });
      if (result.success) {
        setNewRule({ action: 'allow', port: '', protocol: '', from: '' });
        setShowAdd(false);
        refetch();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const deleteRule = async (num) => {
    try {
      await api.del(`/firewall/rules/${num}`);
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleQuickAllow = async (port) => {
    try {
      const result = await api.post('/firewall/rules', { action: 'allow', port, protocol: 'tcp', from: '' });
      if (result.success) {
        setMessage({
          type: 'success',
          text: `Port ${port} has been allowed. Note: If the firewall is inactive, the rules list will not display it until enabled.`
        });
        refetch();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to add rule' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Shield size={28} /><h1>Firewall (UFW)</h1></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={refetch}><RefreshCw size={15} /> Refresh</button>
          <button className={`btn ${data?.active ? 'btn-danger' : 'btn-success'}`} onClick={() => setConfirm({
            open: true, title: data?.active ? 'Disable Firewall' : 'Enable Firewall',
            message: `Are you sure you want to ${data?.active ? 'disable' : 'enable'} the firewall?`,
            action: toggleFirewall
          })} disabled={actionLoading}>
            {data?.active ? <><PowerOff size={15} /> Disable</> : <><Power size={15} /> Enable</>}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add Rule</button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <span className={`badge ${data?.active ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
          Firewall is {data?.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="card" style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px dashed rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md) var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        display: 'flex',
        gap: 'var(--space-md)',
        alignItems: 'flex-start'
      }}>
        <AlertCircle size={22} style={{ color: 'var(--accent-red)', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <h4 style={{ color: 'var(--accent-red)', fontWeight: 600, margin: '0 0 6px 0', fontSize: '14px' }}>
            CRITICAL WARNING
          </h4>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
            To maintain connection after enabling the firewall, you <strong>MUST</strong> ensure rules are added to allow incoming traffic on:
          </p>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span><strong>Port 5050 (TCP)</strong>: For this EasyLin Dashboard access.</span>
              <button 
                className="btn btn-sm btn-ghost" 
                style={{ 
                  color: 'var(--accent-green)', 
                  padding: '2px 8px', 
                  fontSize: '11px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  borderRadius: '4px',
                  height: '24px',
                  lineHeight: '20px',
                  cursor: 'pointer'
                }} 
                onClick={() => handleQuickAllow('5050')}
              >
                Quick Allow 5050
              </button>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span><strong>Port 22 (TCP)</strong> (or your custom SSH port): To prevent locking yourself out of your server's CLI.</span>
              <button 
                className="btn btn-sm btn-ghost" 
                style={{ 
                  color: 'var(--accent-green)', 
                  padding: '2px 8px', 
                  fontSize: '11px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  borderRadius: '4px',
                  height: '24px',
                  lineHeight: '20px',
                  cursor: 'pointer'
                }} 
                onClick={() => handleQuickAllow('22')}
              >
                Quick Allow 22
              </button>
            </li>
          </ul>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Add Rule</h3>
          <form onSubmit={addRule} style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Action</label>
              <select className="form-input" value={newRule.action} onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}>
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
              <label className="form-label">Port</label>
              <input className="form-input" placeholder="e.g. 80, 443, 8080" value={newRule.port} onChange={(e) => setNewRule({ ...newRule, port: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Protocol</label>
              <select className="form-input" value={newRule.protocol} onChange={(e) => setNewRule({ ...newRule, protocol: e.target.value })}>
                <option value="">Any</option>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
              <label className="form-label">From IP (optional)</label>
              <input className="form-input" placeholder="e.g. 192.168.1.0/24" value={newRule.from} onChange={(e) => setNewRule({ ...newRule, from: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Add</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title"><Shield size={16} /> Firewall Rules</div>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : data?.rules?.length > 0 ? (
          <table className="data-table">
            <thead><tr><th>#</th><th>Rule</th><th>Actions</th></tr></thead>
            <tbody>
              {data.rules.map((rule, i) => {
                const match = rule.match(/\[[\s]*(\d+)\]/);
                const num = match ? parseInt(match[1]) : i + 1;
                return (
                  <tr key={i}>
                    <td className="mono">{num}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{rule}</td>
                    <td>
                      <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setConfirm({
                        open: true, title: 'Delete Rule', message: `Remove firewall rule #${num}?`,
                        action: () => deleteRule(num)
                      })} title="Delete" style={{ color: 'var(--accent-red)' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state"><p>No firewall rules configured</p></div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.action}
        onCancel={() => setConfirm({ ...confirm, open: false })}
      />
    </div>
  );
}
