import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, 
  XCircle, RefreshCw, Wrench, FileWarning, AlertCircle,
  Key, Trash2, Plus, Unlock
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Security() {
  const { data, loading, refetch } = useApi('/security/audit');
  const { data: sshData, refetch: refetchSsh } = useApi('/security/ssh-keys');
  const { data: f2bData, refetch: refetchF2b } = useApi('/security/fail2ban/banned', { interval: 10000 });

  const [tab, setTab] = useState('advisor');
  const [actionLoading, setActionLoading] = useState({});
  const [message, setMessage] = useState(null);
  const [filter, setFilter] = useState('all'); // all, risk, warning, secure
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  // SSH states
  const [newSshKey, setNewSshKey] = useState('');
  const [addingKey, setAddingKey] = useState(false);

  // Fail2ban states
  const [unbanningIp, setUnbanningIp] = useState({});

  const handleAddKey = async () => {
    if (!newSshKey.trim()) return;
    setAddingKey(true);
    try {
      const res = await api.post('/security/ssh-keys', { key: newSshKey });
      if (res.success) {
        setMessage({ type: 'success', text: 'SSH public key authorized successfully!' });
        setNewSshKey('');
        refetchSsh();
      } else {
        setMessage({ type: 'error', text: `Failed to authorize key: ${res.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setAddingKey(false);
    }
  };

  const handleDeleteKey = async (rawKey) => {
    try {
      const res = await api.post('/security/ssh-keys/delete', { raw: rawKey });
      if (res.success) {
        setMessage({ type: 'success', text: 'SSH public key removed successfully!' });
        refetchSsh();
      } else {
        setMessage({ type: 'error', text: `Failed to remove key: ${res.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleUnbanIp = async (ip, jail) => {
    const key = `${ip}-${jail}`;
    setUnbanningIp(prev => ({ ...prev, [key]: true }));
    try {
      const res = await api.post('/security/fail2ban/unban', { ip, jail });
      if (res.success) {
        setMessage({ type: 'success', text: `IP ${ip} has been unbanned from jail ${jail}.` });
        refetchF2b();
      } else {
        setMessage({ type: 'error', text: `Failed to unban IP: ${res.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUnbanningIp(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleFix = async (checkId, fixCommand) => {
    setActionLoading(prev => ({ ...prev, [checkId]: true }));
    try {
      const result = await api.post('/security/fix', { id: checkId, fix_command: fixCommand });
      if (result.success) {
        setMessage({ type: 'success', text: `Successfully resolved: ${result.message || 'The vulnerability has been resolved.'}` });
        refetch();
      } else {
        setMessage({ type: 'error', text: `Error during remediation: ${result.error || 'Unable to remediate automatically.'}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Server connection error.' });
    } finally {
      setActionLoading(prev => ({ ...prev, [checkId]: false }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'secure':
        return <CheckCircle2 className="text-success" size={24} style={{ color: 'var(--accent-green, #10b981)' }} />;
      case 'warning':
        return <AlertTriangle className="text-warning" size={24} style={{ color: 'var(--accent-yellow, #f59e0b)' }} />;
      case 'risk':
        return <XCircle className="text-danger" size={24} style={{ color: 'var(--accent-red, #ef4444)' }} />;
      default:
        return <FileWarning size={24} />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'secure':
        return <span className="badge badge-success">Secure</span>;
      case 'warning':
        return <span className="badge badge-warning">Warning</span>;
      case 'risk':
        return <span className="badge badge-danger">At Risk</span>;
      default:
        return <span className="badge">Unknown</span>;
    }
  };

  const getGlobalStatusCard = () => {
    if (!data) return null;
    const { global_status, global_message, risks, warnings, secure_count } = data;

    let borderLeftColor = 'var(--accent-green, #10b981)';
    let Icon = ShieldCheck;
    let iconColor = 'var(--accent-green, #10b981)';

    if (global_status === 'risk') {
      borderLeftColor = 'var(--accent-red, #ef4444)';
      Icon = ShieldAlert;
      iconColor = 'var(--accent-red, #ef4444)';
    } else if (global_status === 'warning') {
      borderLeftColor = 'var(--accent-yellow, #f59e0b)';
      Icon = Shield;
      iconColor = 'var(--accent-yellow, #f59e0b)';
    }

    return (
      <div className="card fade-in" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 'var(--space-lg)',
        borderLeft: `5px solid ${borderLeftColor}`,
        padding: 'var(--space-lg)',
        marginBottom: 'var(--space-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <div style={{ 
            background: 'var(--bg-card-hover)', 
            padding: '12px', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor
          }}>
            <Icon size={40} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>Security Status</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{global_message}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-red, #ef4444)' }}>{risks}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Risks</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-yellow, #f59e0b)' }}>{warnings}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Warnings</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-green, #10b981)' }}>{secure_count}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Secure</div>
          </div>
        </div>
      </div>
    );
  };

  const filteredChecks = data?.checks?.filter(check => {
    if (filter === 'all') return true;
    return check.status === filter;
  }) || [];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <Shield size={28} />
          <h1>Security Advisor</h1>
        </div>
        <div className="page-actions">
          {tab === 'advisor' && (
            <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh Scan
            </button>
          )}
          {tab === 'ssh' && (
            <button className="btn btn-ghost" onClick={refetchSsh}>
              <RefreshCw size={15} /> Refresh Keys
            </button>
          )}
          {tab === 'fail2ban' && (
            <button className="btn btn-ghost" onClick={refetchF2b}>
              <RefreshCw size={15} /> Refresh Status
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className={`tab ${tab === 'advisor' ? 'active' : ''}`} onClick={() => setTab('advisor')}>
          <Shield size={14} style={{ marginRight: '6px' }} /> Vulnerabilities
        </button>
        <button className={`tab ${tab === 'ssh' ? 'active' : ''}`} onClick={() => setTab('ssh')}>
          <Key size={14} style={{ marginRight: '6px' }} /> SSH Access Keys ({sshData?.keys?.length || 0})
        </button>
        <button className={`tab ${tab === 'fail2ban' ? 'active' : ''}`} onClick={() => setTab('fail2ban')}>
          <Unlock size={14} style={{ marginRight: '6px' }} /> Fail2ban Shield ({f2bData?.banned?.length || 0})
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{message.text}</span>
          <button className="btn btn-sm btn-ghost" style={{ minWidth: 'auto', padding: '2px 8px' }} onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}

      {tab === 'advisor' ? (
        loading && !data ? (
          <div className="loading-container" style={{ height: '50vh' }}>
            <div className="spinner" />
            <span>Security audit in progress...</span>
          </div>
        ) : (
          <>
            {getGlobalStatusCard()}

            {/* Filters Bar */}
            <div style={{ 
              display: 'flex', 
              gap: 'var(--space-xs)', 
              marginBottom: 'var(--space-lg)',
              overflowX: 'auto',
              paddingBottom: '4px'
            }}>
              <button 
                className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} 
                onClick={() => setFilter('all')}
              >
                All ({data?.checks?.length || 0})
              </button>
              <button 
                className={`btn btn-sm ${filter === 'risk' ? 'btn-primary' : 'btn-ghost'}`} 
                style={filter === 'risk' ? { background: 'var(--accent-red, #ef4444)', borderColor: 'var(--accent-red, #ef4444)' } : {}}
                onClick={() => setFilter('risk')}
              >
                Risks ({data?.checks?.filter(c => c.status === 'risk').length || 0})
              </button>
              <button 
                className={`btn btn-sm ${filter === 'warning' ? 'btn-primary' : 'btn-ghost'}`} 
                style={filter === 'warning' ? { background: 'var(--accent-yellow, #f59e0b)', borderColor: 'var(--accent-yellow, #f59e0b)' } : {}}
                onClick={() => setFilter('warning')}
              >
                Warnings ({data?.checks?.filter(c => c.status === 'warning').length || 0})
              </button>
              <button 
                className={`btn btn-sm ${filter === 'secure' ? 'btn-primary' : 'btn-ghost'}`} 
                style={filter === 'secure' ? { background: 'var(--accent-green, #10b981)', borderColor: 'var(--accent-green, #10b981)' } : {}}
                onClick={() => setFilter('secure')}
              >
                Secure ({data?.checks?.filter(c => c.status === 'secure').length || 0})
              </button>
            </div>

            {/* Grid of Vulnerability Checks */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', 
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-xl)'
            }}>
              {filteredChecks.map((check) => (
                <div key={check.id} className="card" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  padding: 'var(--space-md)',
                  minHeight: '200px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(check.status)}
                        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{check.name}</span>
                      </div>
                      {getStatusBadge(check.status)}
                    </div>
                    
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>
                      Category: {check.category}
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 'var(--space-md)', lineHeight: '1.4' }}>
                      {check.description}
                    </p>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: 'var(--space-sm)',
                    marginTop: 'var(--space-sm)'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Detected value:</span>
                      <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{check.value}</span>
                    </div>

                    {check.fix_command && (
                      <button 
                        className="btn btn-sm btn-ghost" 
                        style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 'auto', height: 'auto', padding: '6px 12px' }}
                        disabled={actionLoading[check.id]}
                        onClick={() => setConfirm({
                          open: true,
                          title: `Resolve Vulnerability`,
                          message: `Do you want to run the automatic remediation for "${check.name}"? Command to execute: "${check.fix_command}"`,
                          action: () => handleFix(check.id, check.fix_command)
                        })}
                      >
                        <Wrench size={12} />
                        {actionLoading[check.id] ? 'Resolving...' : 'Resolve'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredChecks.length === 0 && (
                <div className="card" style={{ gridColumn: '1 / -1', padding: 'var(--space-xl)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No security checks match the selected filter.</p>
                </div>
              )}
            </div>
          </>
        )
      ) : tab === 'ssh' ? (
        <div style={{ padding: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
            {/* Authorized Keys List */}
            <div>
              <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1.2rem' }}>Authorized SSH Keys</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {(sshData?.keys || []).map((k, index) => (
                  <div 
                    key={index} 
                    className="card" 
                    style={{ 
                      padding: 'var(--space-md)', 
                      border: '1px solid var(--border-color)', 
                      background: 'rgba(255,255,255,0.01)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Key size={14} style={{ color: 'var(--accent-blue)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{k.type}</span>
                      </div>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        style={{ color: 'var(--accent-red)', padding: '2px', minWidth: 'auto', height: 'auto' }}
                        onClick={() => setConfirm({
                          open: true,
                          title: 'Delete SSH Key',
                          message: `Are you sure you want to delete this SSH key (${k.comment})? You may lose remote SSH access if this is your only key.`,
                          action: () => handleDeleteKey(k.raw)
                        })}
                        title="Delete SSH Key"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', marginBottom: '8px' }}>
                      {k.preview}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      Comment / Tag: <span style={{ fontWeight: 500 }}>{k.comment}</span>
                    </div>
                  </div>
                ))}
                {(sshData?.keys || []).length === 0 && (
                  <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                    No authorized SSH keys found for root. Password authentication may be in use.
                  </div>
                )}
              </div>
            </div>

            {/* Add Key Form */}
            <div>
              <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1.2rem' }}>Add SSH Public Key</h3>
              <div className="card" style={{ padding: 'var(--space-lg)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label>SSH Key Content</label>
                  <textarea 
                    className="input mono" 
                    style={{ height: '180px', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4', resize: 'vertical', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px' }}
                    placeholder="Paste your public key here (e.g. ssh-rsa AAAA... user@host)"
                    value={newSshKey}
                    onChange={e => setNewSshKey(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'end' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleAddKey}
                    disabled={addingKey}
                  >
                    {addingKey ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                    Authorize Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
            {/* Fail2ban Status & Jails */}
            <div>
              <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1.2rem' }}>Fail2ban Service</h3>
              <div className="card" style={{ padding: 'var(--space-lg)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Status:</span>
                  <span className={`badge ${f2bData?.active ? 'badge-success' : 'badge-danger'}`}>
                    {f2bData?.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <h4 style={{ marginBottom: '10px', fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Monitored Jails</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(f2bData?.jails || []).map(jail => (
                    <span key={jail} className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      {jail}
                    </span>
                  ))}
                  {(f2bData?.jails || []).length === 0 && (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>No active jails found.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Banned IPs list */}
            <div>
              <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1.2rem' }}>Banned IP Addresses</h3>
              <div className="card" style={{ padding: 0, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Jail</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(f2bData?.banned || []).map((b, index) => (
                      <tr key={index}>
                        <td className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{b.ip}</td>
                        <td>
                          <span className="badge" style={{ fontSize: '11px' }}>{b.jail}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-sm btn-ghost" 
                            style={{ color: 'var(--accent-green)', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', height: 'auto', minWidth: 'auto' }}
                            disabled={unbanningIp[`${b.ip}-${b.jail}`]}
                            onClick={() => handleUnbanIp(b.ip, b.jail)}
                          >
                            <Unlock size={12} />
                            {unbanningIp[`${b.ip}-${b.jail}`] ? 'Unbanning...' : 'Unban'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(f2bData?.banned || []).length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                          No IP addresses are currently banned by Fail2ban.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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
