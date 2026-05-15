import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  HardDrive, Database, Network, ShieldAlert, ShieldCheck, 
  Trash2, Plus, Unlink, Activity, Cpu, AlertCircle, 
  ChevronRight, Save, Info, RefreshCw, X
} from 'lucide-react';

export default function Storage() {
  const { data, loading: loadingDisks, refetch: refetchDisks } = useApi('/storage/disks');
  const { data: lvmData, loading: loadingLVM, refetch: refetchLVM } = useApi('/storage/lvm/info');
  const [busyData, setBusyData] = useState(null);
  const [showNASWizard, setShowNASWizard] = useState(false);
  const [showLocalMount, setShowLocalMount] = useState(null); 
  const [localMountPoint, setLocalMountPoint] = useState('');
  const [nasForm, setNasForm] = useState({ type: 'nfs', path: '', mountpoint: '/mnt/nas', username: '', password: '', options: 'defaults' });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [expansionLog, setExpansionLog] = useState(null);

  const handleExpandRoot = async () => {
    if (!window.confirm("This will expand your root partition to use all available space in the Volume Group. Continue?")) return;
    
    setIsActionLoading(true);
    setExpansionLog("Starting expansion process...");
    try {
      const res = await api.post('/storage/expand-root');
      const results = res.results.map(r => 
        `${r.command}: ${r.success ? 'SUCCESS' : 'FAILED'}\n${r.output || r.error}`
      ).join('\n\n');
      setExpansionLog(results);
      refetchDisks();
      refetchLVM();
    } catch (err) {
      setExpansionLog("Expansion failed: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnmount = async (mountpoint) => {
    setIsActionLoading(true);
    try {
      await api.post('/storage/unmount', { mountpoint });
      refetchDisks();
    } catch (err) {
      if (err.response?.status === 409) {
        setBusyData({ mountpoint, processes: err.response.data.processes });
      } else {
        alert("Unmount failed: " + err.message);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleForceUnmount = async () => {
    setIsActionLoading(true);
    try {
      await api.post('/storage/force-unmount', { mountpoint: busyData.mountpoint });
      setBusyData(null);
      refetchDisks();
    } catch (err) {
      alert("Force unmount failed: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMountNAS = async () => {
    setIsActionLoading(true);
    try {
      await api.post('/storage/mount-nas', nasForm);
      setShowNASWizard(false);
      refetchDisks();
    } catch (err) {
      alert("NAS Mount failed: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMountLocal = async () => {
    setIsActionLoading(true);
    try {
      await api.post('/storage/mount-local', { 
        device: `/dev/${showLocalMount.name}`, 
        mountpoint: localMountPoint,
        fstype: showLocalMount.fstype 
      });
      setShowLocalMount(null);
      setLocalMountPoint('');
      refetchDisks();
    } catch (err) {
      alert("Local Mount failed: " + err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-container cyan"><HardDrive size={24} /></div>
          <div>
            <h1>Storage Manager</h1>
            <p className="subtitle">Physical disks, LVM expansion and network mounts</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={() => { refetchDisks(); refetchLVM(); }}>
            <RefreshCw size={18} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowNASWizard(true)}>
            <Plus size={18} /> Mount NAS
          </button>
        </div>
      </div>

      {/* LVM Expansion Utility */}
      {lvmData?.is_lvm_active && (
        <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--accent-blue)', background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', borderRadius: '12px' }}>
                <Activity size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>LVM System Expansion</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detected LVM Volume Group: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{lvmData.vgs[0]?.name}</span></p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Free Space in VG</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: lvmData.vgs[0]?.free !== '0' ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {lvmData.vgs[0]?.free}
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
            <div style={{ fontSize: '0.9rem', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Root Logical Volume</span>
              <span className="mono" style={{ color: 'var(--accent-blue)' }}>{lvmData.lvs.find(l => l.name.includes('root') || l.name.includes('lv'))?.path || 'Detecting...'}</span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: lvmData.vgs[0]?.free === '0' ? '100%' : '70%', backgroundColor: 'var(--accent-blue)', transition: 'width 1s ease' }}></div>
            </div>
          </div>

          {lvmData.vgs[0]?.free !== '0' ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleExpandRoot} 
                disabled={isActionLoading}
                style={{ flex: 1, height: '48px', fontSize: '1rem' }}
              >
                {isActionLoading ? <RefreshCw className="spin" size={20} /> : <Save size={20} />} 
                Expand Root to Maximum Space
              </button>
              <div style={{ flex: 2, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                This will automatically run <code>lvextend</code> and <code>resize2fs</code> to reclaim all unallocated disk space.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontSize: '0.9rem', background: 'rgba(34, 197, 94, 0.05)', padding: '12px', borderRadius: '8px' }}>
              <ShieldCheck size={18} /> Your root partition is already using all available space in the Volume Group.
            </div>
          )}

          {expansionLog && (
            <div style={{ marginTop: '20px', background: '#000', padding: '15px', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#22c55e', whiteSpace: 'pre-wrap', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                <span style={{ color: '#fff' }}>Expansion Terminal Output</span>
                <button onClick={() => setExpansionLog(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
              {expansionLog}
            </div>
          )}
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))' }}>
        {data?.devices?.map(dev => (
          <div key={dev.name} className="card disk-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                  <Database size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{dev.model || dev.name}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dev.name} • {dev.size}</div>
                </div>
              </div>
              <div className={`badge ${dev.smart_status === 'PASSED' ? 'badge-success' : 'badge-danger'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {dev.smart_status === 'PASSED' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                SMART: {dev.smart_status}
              </div>
            </div>

            {dev.bad_sectors > 0 && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} /> Critical: {dev.bad_sectors} reallocated sectors detected!
              </div>
            )}

            <div className="partition-list">
              {(dev.children || []).map(part => (
                <div key={part.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{part.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>({part.fstype || 'raw'})</span></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{part.mountpoint || 'Not mounted'} • {part.size}</div>
                  </div>
                  {part.critical ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px' }}>
                      <ShieldCheck size={12} /> System Core 🔒
                    </div>
                  ) : part.mountpoint ? (
                    <button className="btn btn-sm btn-ghost text-red" onClick={() => handleUnmount(part.mountpoint)}>
                      <Unlink size={14} /> Unmount
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-ghost text-cyan" onClick={() => {
                      setShowLocalMount(part);
                      setLocalMountPoint(`/mnt/${part.name}`);
                    }}>
                      <Plus size={14} /> Mount
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Local Mount Modal */}
      {showLocalMount && (
        <div className="modal-overlay" onClick={() => setShowLocalMount(null)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Database size={24} className="text-cyan" />
                <h3 style={{ margin: 0 }}>Mount Local Partition</h3>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowLocalMount(null)}><X size={20} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Device</label>
              <div className="input-info" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                /dev/{showLocalMount.name} ({showLocalMount.fstype || 'unknown'})
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mount Point</label>
              <input className="input" value={localMountPoint} onChange={e => setLocalMountPoint(e.target.value)} placeholder="/mnt/my_disk" />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                The folder will be created if it doesn't exist.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowLocalMount(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleMountLocal} disabled={isActionLoading || !localMountPoint}>
                {isActionLoading ? <RefreshCw className="spin" size={18} /> : "Mount & Persist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAS Wizard Modal */}
      {showNASWizard && (
        <div className="modal-overlay" onClick={() => setShowNASWizard(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Network size={24} className="text-cyan" />
                <h3 style={{ margin: 0 }}>Mount Network Storage (NAS)</h3>
              </div>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowNASWizard(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Protocol</label>
                <select className="input" value={nasForm.type} onChange={e => setNasForm({...nasForm, type: e.target.value})}>
                  <option value="nfs">NFS (Linux/Unix)</option>
                  <option value="cifs">Samba / CIFS (Windows/NAS)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mount Point</label>
                <input className="input" value={nasForm.mountpoint} onChange={e => setNasForm({...nasForm, mountpoint: e.target.value})} placeholder="/mnt/nas_share" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Server Path (IP:/path/to/share)</label>
              <input className="input" value={nasForm.path} onChange={e => setNasForm({...nasForm, path: e.target.value})} placeholder="192.168.1.10:/volume1/data" />
            </div>

            {nasForm.type === 'cifs' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="input" value={nasForm.username} onChange={e => setNasForm({...nasForm, username: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="input" type="password" value={nasForm.password} onChange={e => setNasForm({...nasForm, password: e.target.value})} />
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--accent-green)', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                <ShieldCheck size={16} /> Auto-Boot Persistence
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                This mount will be added to <code>/etc/fstab</code> automatically. EasyLin will back up your configuration before applying.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNASWizard(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleMountNAS} disabled={isActionLoading || !nasForm.path}>
                {isActionLoading ? <RefreshCw className="spin" size={18} /> : "Mount & Persist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busy Resolver Modal */}
      {busyData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', border: '1px solid var(--accent-red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-red)', marginBottom: '16px' }}>
              <AlertCircle size={24} />
              <h3 style={{ margin: 0 }}>Target is Busy</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              The following processes are currently using <code>{busyData.mountpoint}</code>. You must terminate them to unmount safely.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px' }}>PID</th>
                    <th style={{ padding: '12px 16px' }}>Process Name</th>
                    <th style={{ padding: '12px 16px' }}>User</th>
                  </tr>
                </thead>
                <tbody>
                  {busyData.processes.map(p => (
                    <tr key={p.pid}>
                      <td style={{ padding: '10px 16px' }}>{p.pid}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '10px 16px' }}>{p.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setBusyData(null)}>Cancel</button>
              <button className="btn btn-primary bg-red" style={{ flex: 2, backgroundColor: 'var(--accent-red)' }} onClick={handleForceUnmount} disabled={isActionLoading}>
                {isActionLoading ? <RefreshCw className="spin" size={18} /> : "Force Kill & Unmount"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .disk-card { border: 1px solid var(--border-color); padding: 24px; }
        .text-red { color: #ef4444 !important; }
        .bg-red { background-color: #ef4444 !important; }
        .text-cyan { color: #06b6d4 !important; }
        .icon-container.cyan { background: rgba(6, 182, 212, 0.1); color: #06b6d4; }
      `}} />
    </div>
  );
}
