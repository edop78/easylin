import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { Users as UsersIcon, UserPlus, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import ConfirmModal from '../../components/Common/ConfirmModal';

export default function Users() {
  const { data, loading, refetch } = useApi('/users/');
  const { data: groupsData } = useApi('/users/groups');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', shell: '/bin/bash' });
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('users');
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', action: null });

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/', newUser);
      setMessage({ type: 'success', text: `User "${newUser.username}" created` });
      setNewUser({ username: '', password: '', shell: '/bin/bash' });
      setShowCreate(false);
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const deleteUser = async (username) => {
    try {
      await api.del(`/users/${username}`);
      setMessage({ type: 'success', text: `User "${username}" deleted` });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><UsersIcon size={28} /><h1>Users & Groups</h1></div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={refetch}><RefreshCw size={15} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}><UserPlus size={15} /> Create User</button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {message.text}
        </div>
      )}

      {showCreate && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Create New User</h3>
          <form onSubmit={createUser} style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}><label className="form-label">Username</label><input className="form-input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required /></div>
            <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}><label className="form-label">Password</label><input className="form-input" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required /></div>
            <div className="form-group" style={{ width: '160px', marginBottom: 0 }}><label className="form-label">Shell</label>
              <select className="form-input" value={newUser.shell} onChange={(e) => setNewUser({ ...newUser, shell: e.target.value })}>
                <option value="/bin/bash">/bin/bash</option><option value="/bin/sh">/bin/sh</option><option value="/bin/zsh">/bin/zsh</option><option value="/usr/sbin/nologin">nologin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary">Create</button>
          </form>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users ({data?.users?.length || 0})</button>
        <button className={`tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>Groups ({groupsData?.groups?.length || 0})</button>
      </div>

      <div className="card">
        {loading && !data ? <div className="loading-container"><div className="spinner" /></div> : tab === 'users' ? (
          <table className="data-table">
            <thead><tr><th>Username</th><th>UID</th><th>Home</th><th>Shell</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.users || []).map((u) => (
                <tr key={u.uid}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.username}</td><td className="mono">{u.uid}</td><td className="mono">{u.home}</td><td className="mono">{u.shell}</td>
                  <td>
                    {u.username !== 'root' && (
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setConfirm({
                        open: true, title: 'Delete User', message: `Are you sure you want to delete user "${u.username}" and their home directory?`,
                        action: () => deleteUser(u.username)
                      })} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead><tr><th>Group</th><th>GID</th><th>Members</th></tr></thead>
            <tbody>
              {(groupsData?.groups || []).map((g) => (<tr key={g.gid}><td style={{ color: 'var(--text-primary)' }}>{g.name}</td><td className="mono">{g.gid}</td><td>{g.members || '—'}</td></tr>))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal isOpen={confirm.open} title={confirm.title} message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm({ ...confirm, open: false })} />
    </div>
  );
}
