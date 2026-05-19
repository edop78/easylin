import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, 
  XCircle, RefreshCw, Wrench, Lock, Unlock, FileWarning, AlertCircle
} from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Security() {
  const { data, loading, refetch } = useApi('/security/audit');
  const [actionLoading, setActionLoading] = useState({});
  const [message, setMessage] = useState(null);
  const [filter, setFilter] = useState('all'); // all, risk, warning, secure
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const handleFix = async (checkId, fixCommand) => {
    setActionLoading(prev => ({ ...prev, [checkId]: true }));
    try {
      const result = await api.post('/security/fix', { id: checkId, fix_command: fixCommand });
      if (result.success) {
        setMessage({ type: 'success', text: `Risolto con successo: ${result.message || 'La vulnerabilità è stata corretta.'}` });
        refetch();
      } else {
        setMessage({ type: 'error', text: `Errore durante la correzione: ${result.error || 'Impossibile correggere automaticamente.'}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Errore di connessione al server.' });
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
        return <span className="badge badge-success">Sicuro</span>;
      case 'warning':
        return <span className="badge badge-warning">Attenzione</span>;
      case 'risk':
        return <span className="badge badge-danger">A Rischio</span>;
      default:
        return <span className="badge">Sconosciuto</span>;
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
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>Stato Sicurezza</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{global_message}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-red, #ef4444)' }}>{risks}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rischi</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-yellow, #f59e0b)' }}>{warnings}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Avvisi</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-green, #10b981)' }}>{secure_count}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sicuri</div>
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
          <button className="btn btn-ghost" onClick={refetch} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Aggiorna Scan
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 'var(--space-lg)' }}>
          <AlertCircle size={16} />
          {message.text}
        </div>
      )}

      {loading && !data ? (
        <div className="loading-container" style={{ height: '50vh' }}>
          <div className="spinner" />
          <span>Analisi di sicurezza in corso...</span>
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
              Tutti ({data?.checks?.length || 0})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'risk' ? 'btn-primary' : 'btn-ghost'}`} 
              style={filter === 'risk' ? { background: 'var(--accent-red, #ef4444)', borderColor: 'var(--accent-red, #ef4444)' } : {}}
              onClick={() => setFilter('risk')}
            >
              Rischio ({data?.checks?.filter(c => c.status === 'risk').length || 0})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'warning' ? 'btn-primary' : 'btn-ghost'}`} 
              style={filter === 'warning' ? { background: 'var(--accent-yellow, #f59e0b)', borderColor: 'var(--accent-yellow, #f59e0b)' } : {}}
              onClick={() => setFilter('warning')}
            >
              Avvisi ({data?.checks?.filter(c => c.status === 'warning').length || 0})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'secure' ? 'btn-primary' : 'btn-ghost'}`} 
              style={filter === 'secure' ? { background: 'var(--accent-green, #10b981)', borderColor: 'var(--accent-green, #10b981)' } : {}}
              onClick={() => setFilter('secure')}
            >
              Sicuri ({data?.checks?.filter(c => c.status === 'secure').length || 0})
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
                minHeight: '200px'
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
                    Categoria: {check.category}
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
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Valore rilevato:</span>
                    <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{check.value}</span>
                  </div>

                  {check.fix_command && (
                    <button 
                      className="btn btn-sm btn-ghost" 
                      style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      disabled={actionLoading[check.id]}
                      onClick={() => setConfirm({
                        open: true,
                        title: `Risoluzione Vulnerabilità`,
                        message: `Vuoi eseguire l'azione correttiva automatica per "${check.name}"? Comando da eseguire: "${check.fix_command}"`,
                        action: () => handleFix(check.id, check.fix_command)
                      })}
                    >
                      <Wrench size={12} />
                      {actionLoading[check.id] ? 'Correzione...' : 'Risolvi'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredChecks.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', padding: 'var(--space-xl)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Nessun controllo di sicurezza soddisfa il filtro selezionato.</p>
              </div>
            )}
          </div>
        </>
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
