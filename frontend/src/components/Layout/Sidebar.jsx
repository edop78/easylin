import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Package, Users, Activity, Container, Network, Shield, Globe, 
  FileText, Terminal, RefreshCw, Server, Cog, Zap, LogOut
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
        { to: '/users', icon: Users, label: 'Users' }
      ]
    },
    {
      title: 'Management',
      links: [
        { to: '/docker', icon: Container, label: 'Docker' },
        { to: '/network', icon: Network, label: 'Network' },
        { to: '/firewall', icon: Shield, label: 'Firewall' }
      ]
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon"><Zap size={20} fill="currentColor" /></div>
        <span className="brand-name">EasyLin</span>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-title">{section.title}</div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
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
