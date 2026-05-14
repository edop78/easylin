import { AlertCircle, HelpCircle } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, type = 'danger', confirmText = 'Confirm' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <div style={{ 
            background: type === 'danger' ? 'var(--accent-red-dim)' : 'var(--accent-blue-dim)',
            color: type === 'danger' ? 'var(--accent-red)' : 'var(--accent-blue)',
            padding: '10px',
            borderRadius: '50%'
          }}>
            {type === 'danger' ? <AlertCircle size={24} /> : <HelpCircle size={24} />}
          </div>
          <h3 className="modal-title" style={{ marginBottom: 0 }}>{title}</h3>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: 'var(--space-lg)' }}>
          {message}
        </p>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button 
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={() => { onConfirm(); onCancel(); }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
