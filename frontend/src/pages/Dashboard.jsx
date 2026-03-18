import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileManager from '../components/Files/FileManager';
import StorageWidget from '../components/StorageWidget';

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="app-container">
      <nav className="dashboard-nav">
        <div className="nav-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary-color)">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
          </svg>
          Drive Clone
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <StorageWidget refreshTrigger={refreshTrigger} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{user.email}</span>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </div>
      </nav>
      <main className="dashboard-content">
        <FileManager onStorageChanged={() => setRefreshTrigger(prev => prev + 1)} />
      </main>
    </div>
  );
}

export default Dashboard;
