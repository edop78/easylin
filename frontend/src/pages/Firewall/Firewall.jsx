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
