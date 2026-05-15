import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Package, Users, Activity, Container, Network, Shield, Globe, 
  FileText, Terminal, RefreshCw, Server, Cog, Zap, LogOut, ScrollText, Rocket, GitBranch
} from 'lucide-react';
import './Layout.css';

export default function Sidebar() {
  const { user, logout } = useAuth();

  const sections = [
    {
      title: 'Main',
      links: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }]
    },
    {
      title: 'System',
      links: [
        { to: '/system', icon: Server, label: 'System' },
        { to: '/system/maintenance', icon: RefreshCw, label: 'Update & Clean' },
        { to: '/packages', icon: Package, label: 'Packages' },
        { to: '/users', icon: Users, label: 'Users' },
        { to: '/services', icon: Cog, label: 'Services' },
      ]
    },
    {
      title: 'Management',
      links: [
        { to: '/docker', icon: Container, label: 'Docker' },
        { to: '/network', icon: Network, label: 'Network' },
        { to: '/firewall', icon: Shield, label: 'Firewall' },
        { to: '/proxy', icon: Globe, label: 'Reverse Proxy' },
        { to: '/git', icon: GitBranch, label: 'Git Projects' }
      ]
    },
    {
      title: 'Tools',
      links: [
        { to: '/files', icon: FileText, label: 'File Manager' },
        { to: '/terminal', icon: Terminal, label: 'Terminal' },
        { to: '/logs', icon: ScrollText, label: 'System Logs' }
      ]
    }
  ];

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-brand" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', padding: 'var(--space-md) var(--space-lg)' }}>
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
        <span className="brand-name" style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>EasyLin</span>
      </Link>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-title">{section.title}</div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <link.icon size={18} />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
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
