import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { 
  LayoutDashboard, Package, Users, Activity, Container, Network, Shield, Globe, 
  FileText, Terminal, RefreshCw, Server, Cog, Zap, LogOut, ScrollText, Rocket, GitBranch, HardDrive, Bot, ShieldCheck, BookOpen,
  Search, ChevronDown, ChevronRight, X
} from 'lucide-react';
import './Layout.css';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { data: versionData } = useApi('/system/version');

  // Live status badge data fetches
  const { data: containersData } = useApi('/docker/containers', { interval: 10000 });
  const { data: aiStatus, loading: aiStatusLoading } = useApi('/ai/status', { interval: 15000 });
  const { data: aiModelsData } = useApi('/ai/models', { interval: 30000 });
  const { data: updateCheckData } = useApi('/system/update/check', { interval: 60000 });
  const { data: updateStatus } = useApi('/system/update/status', { interval: 5000 });

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      const stored = localStorage.getItem('easylin_sidebar_collapsed');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const toggleSection = (title) => {
    setCollapsedSections(prev => {
      const updated = { ...prev, [title]: !prev[title] };
      localStorage.setItem('easylin_sidebar_collapsed', JSON.stringify(updated));
      return updated;
    });
  };

  const sections = [
    {
      title: 'Main',
      links: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }]
    },
    {
      title: 'System',
      links: [
        { to: '/system', icon: Server, label: 'System' },
        { to: '/storage', icon: HardDrive, label: 'Storage Manager' },
        { to: '/packages', icon: Package, label: 'Packages' },
        { to: '/services', icon: Cog, label: 'Services' },
        { to: '/users', icon: Users, label: 'Users' },
        { to: '/system/maintenance', icon: RefreshCw, label: 'Update & Clean' }
      ]
    },
    {
      title: 'Network & Security',
      links: [
        { to: '/network', icon: Network, label: 'Network' },
        { to: '/firewall', icon: Shield, label: 'Firewall' },
        { to: '/security', icon: ShieldCheck, label: 'Security' }
      ]
    },
    {
      title: 'Apps & Deploy',
      links: [
        { to: '/docker', icon: Container, label: 'Docker' },
        { to: '/proxy', icon: Globe, label: 'Reverse Proxy' },
        { to: '/git', icon: GitBranch, label: 'Git Projects' },
        { to: '/ai', icon: Bot, label: 'AI Manager' }
      ]
    },
    {
      title: 'Tools & Reference',
      links: [
        { to: '/files', icon: FileText, label: 'File Manager' },
        { to: '/terminal', icon: Terminal, label: 'Terminal' },
        { to: '/logs', icon: ScrollText, label: 'System Logs' },
        { to: '/dictionary', icon: BookOpen, label: 'Command Dictionary' }
      ]
    }
  ];

  // Filtering sections and links based on search query
  const filteredSections = sections.map(section => {
    const matchedLinks = section.links.filter(link => 
      link.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...section, links: matchedLinks };
  }).filter(section => section.links.length > 0);

  const renderBadge = (link) => {
    if (link.to === '/docker') {
      const runningCount = containersData?.containers?.filter(c => c.state === 'running')?.length || 0;
      if (runningCount > 0) {
        return <span className="sidebar-badge badge-docker">{runningCount}</span>;
      }
    }
    if (link.to === '/system/maintenance') {
      const isUpdating = updateStatus?.status === 'running' || updateStatus?.step === 'started';
      const hasUpdates = updateCheckData?.update_available;
      if (isUpdating) {
        return <span className="sidebar-badge badge-maintenance pulse">UPDATING</span>;
      } else if (hasUpdates) {
        return <span className="sidebar-badge badge-maintenance-warn" title="Updates pending"></span>;
      }
    }
    if (link.to === '/ai') {
      const isOnline = aiStatus?.active;
      const modelsCount = aiModelsData?.models?.length || 0;
      if (isOnline) {
        return <span className="sidebar-badge badge-ai-online" title={`${modelsCount} models installed`}>{modelsCount}</span>;
      } else if (aiStatusLoading) {
        return <span className="sidebar-badge badge-ai-loading">...</span>;
      }
    }
    return null;
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <Link to="/" className="sidebar-brand" onClick={handleLinkClick} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', padding: 'var(--space-md) var(--space-lg)' }}>
        <div className="brand-icon" style={{ 
          background: 'linear-gradient(135deg, var(--accent-blue) 0%, #3b82f6 100%)', 
          color: 'white', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          borderRadius: '10px', 
          padding: '6px',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
        }}>
          <Rocket size={18} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="brand-name" style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: '1.1' }}>EasyLin</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px', opacity: 0.8 }}>{versionData?.version || ''}</span>
        </div>
      </Link>

      {/* Sidebar Search */}
      <div className="sidebar-search-container">
        <div className="sidebar-search-wrapper">
          <Search size={14} className="sidebar-search-icon" />
          <input 
            type="text" 
            placeholder="Search tools..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
          />
          {searchQuery && (
            <button className="sidebar-search-clear" onClick={() => setSearchQuery('')} title="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredSections.map((section) => {
          const isCollapsed = collapsedSections[section.title] && !searchQuery;
          return (
            <div key={section.title} className="sidebar-section">
              <div 
                className="sidebar-section-header" 
                onClick={() => toggleSection(section.title)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  padding: '6px var(--space-md)',
                  userSelect: 'none',
                  marginBottom: '4px'
                }}
              >
                <div className="sidebar-section-title" style={{ padding: 0, margin: 0 }}>{section.title}</div>
                <span className="sidebar-section-chevron" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', opacity: searchQuery ? 0 : 0.6 }}>
                  {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                </span>
              </div>
              
              {!isCollapsed && (
                <div className="sidebar-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {section.links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end
                      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                      onClick={handleLinkClick}
                    >
                      <link.icon size={18} />
                      <span>{link.label}</span>
                      <div className="sidebar-badge-container">
                        {renderBadge(link)}
                      </div>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">{user?.username?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user?.username || 'User'}</div>
            <div className="user-role">Administrator</div>
          </div>
          <button className="logout-btn" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
