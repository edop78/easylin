import { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';
import './Layout.css';

export default function Layout({ children }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      {/* Mobile Backdrop */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="layout-content">
        {/* Mobile Header */}
        <header className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>EasyLin</span>
          </div>
          {isSidebarOpen && (
            <button className="menu-toggle" onClick={() => setSidebarOpen(false)}>
              <X size={24} />
            </button>
          )}
        </header>

        {children}
      </div>
    </div>
  );
}
