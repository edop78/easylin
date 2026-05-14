import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Package,
  Users,
  Cog,
  Container,
  Network,
  Shield,
  Globe,
  FolderOpen,
  TerminalSquare,
  ScrollText,
  RefreshCw,
} from 'lucide-react';

const navSections = [
  {
    title: 'Overview',
    links: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'System',
    links: [
      { to: '/system', icon: Server, label: 'System' },
      { to: '/system/maintenance', icon: RefreshCw, label: 'Update & Clean' },
      { to: '/packages', icon: Package, label: 'Packages' },
      { to: '/users', icon: Users, label: 'Users & Groups' },
      { to: '/services', icon: Cog, label: 'Services' },
    ],
  },
  {
    title: 'Infrastructure',
    links: [
      { to: '/docker', icon: Container, label: 'Docker' },
      { to: '/network', icon: Network, label: 'Network' },
      { to: '/firewall', icon: Shield, label: 'Firewall' },
      { to: '/proxy', icon: Globe, label: 'Reverse Proxy' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { to: '/files', icon: FolderOpen, label: 'File Manager' },
      { to: '/terminal', icon: TerminalSquare, label: 'Terminal' },
      { to: '/logs', icon: ScrollText, label: 'Logs' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">EL</div>
        <div className="sidebar-logo-text">
          Easy<span>Lin</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-title">{section.title}</div>
            {section.links.map((link) => {
              const isActive = link.to === '/'
                ? location.pathname === '/'
                : link.to === '/system'
                  ? location.pathname === '/system'
                  : location.pathname.startsWith(link.to);

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={`sidebar-link${isActive ? ' active' : ''}`}
                >
                  <link.icon />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
