import { useState, useEffect } from 'react';
import api from '../services/api';

function StorageWidget({ refreshTrigger }) {
  const [stats, setStats] = useState({ totalUsed: 0, maxStorage: 10 * 1024 * 1024 * 1024, percentage: 0 });

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/auth/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="storage-widget">
      <div className="storage-info">
        <span className="storage-label">Storage</span>
        <span className="storage-value">{formatSize(stats.totalUsed)} / 10 GB</span>
      </div>
      <div className="progress-bar-container">
        <div 
          className={`progress-bar-fill ${stats.percentage > 90 ? 'danger' : ''}`} 
          style={{ width: `${stats.percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default StorageWidget;
