import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-left">
        <span>Linux Server Management</span>
      </div>
      <div className="header-right">
        <div className="header-user">
          <div className="header-user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span>{user?.username || 'User'}</span>
        </div>
        <button className="header-logout" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
