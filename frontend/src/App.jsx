import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import System from './pages/System/System';
import Packages from './pages/Packages/Packages';
import Users from './pages/Users/Users';
import Services from './pages/Services/Services';
import Docker from './pages/Docker/Docker';
import Network from './pages/Network/Network';
import Firewall from './pages/Firewall/Firewall';
import ReverseProxy from './pages/ReverseProxy/ReverseProxy';
import Files from './pages/Files/Files';
import Terminal from './pages/Terminal/Terminal';
import Logs from './pages/Logs/Logs';
import UpdateClean from './pages/System/UpdateClean';
import GitProjects from './pages/GitProjects/GitProjects';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/system" element={<System />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/users" element={<Users />} />
                <Route path="/services" element={<Services />} />
                <Route path="/docker" element={<Docker />} />
                <Route path="/network" element={<Network />} />
                <Route path="/firewall" element={<Firewall />} />
                <Route path="/proxy" element={<ReverseProxy />} />
                <Route path="/files" element={<Files />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/git" element={<GitProjects />} />
                <Route path="/system/maintenance" element={<UpdateClean />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
