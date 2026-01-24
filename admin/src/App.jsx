import React, { useState, useEffect } from 'react';

// Mock Data (until Backend is fully DB connected)
const MOCK_COMPONENTS = [
  { id: 'checkout-btn', name: 'Checkout Button', status: 'active', crashes: 2 },
  { id: 'payment-gateway', name: 'Payment Module', status: 'maintenance', crashes: 15 },
  { id: 'user-profile', name: 'Profile Header', status: 'active', crashes: 0 },
];

const MOCK_CRASHES = [
  {
    id: 101,
    component: 'payment-gateway',
    error: 'TypeError: Cannot read properties of undefined (reading "amount")',
    time: '2 mins ago',
    analysis: null
  },
  {
    id: 102,
    component: 'checkout-btn',
    error: 'NetworkError: 503 Service Unavailable',
    time: '15 mins ago',
    analysis: {
      root_cause: "API endpoint timeout",
      suggested_fix: "Implement exponential backoff in the fetch call.",
      severity: "Medium"
    }
  }
];

function App() {
  const [components, setComponents] = useState(MOCK_COMPONENTS);
  const [activeTab, setActiveTab] = useState('overview');

  // Polling Effect (simulated)
  useEffect(() => {
    // In real implementation: fetch('/api/stats')
  }, []);

  const toggleLock = (id) => {
    setComponents(prev => prev.map(c =>
      c.id === id ? { ...c, status: c.status === 'active' ? 'maintenance' : 'active' } : c
    ));
    // In real implementation: axios.post('/api/lock-component', { id, status: ... })
  };

  return (
    <div className="dashboard-grid">
      {/* Sidebar */}
      <aside className="glass-panel sidebar" style={{ padding: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(to right, #8b5cf6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          CrashGuard 🛡️
        </h2>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['Overview', 'Crash Feed', 'Component Tree'].map(tab => (
            <button key={tab}
              className={`btn-glass ${activeTab === tab.toLowerCase() ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab(tab.toLowerCase())}
              style={{ textAlign: 'left' }}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="status-badge status-active" style={{ textAlign: 'center' }}>
            System Online
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">

        {/* Header */}
        <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Dashboard / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <button className="btn-glass">🔔 Notifications (3)</button>
        </header>

        {/* Overview Widgets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div className="glass-panel stat-card">
            <span style={{ color: 'var(--text-muted)' }}>Total Crashes (24h)</span>
            <span className="stat-value">142</span>
          </div>
          <div className="glass-panel stat-card">
            <span style={{ color: 'var(--text-muted)' }}>Active Locks</span>
            <span className="stat-value" style={{ color: '#ef4444', WebkitTextFillColor: 'initial' }}>1</span>
          </div>
          <div className="glass-panel stat-card">
            <span style={{ color: 'var(--text-muted)' }}>Auto-Repaired</span>
            <span className="stat-value" style={{ color: '#10b981', WebkitTextFillColor: 'initial' }}>12</span>
          </div>
        </div>

        {/* Crash Feed Section */}
        <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0 }}>Recent Incidents</h3>
          </div>

          <div style={{ padding: '0 24px' }}>
            {MOCK_CRASHES.map(crash => (
              <div key={crash.id} className="crash-item">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#fca5a5' }}>{crash.component}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{crash.time}</span>
                  </div>
                  <code style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>{crash.error}</code>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  {crash.analysis ? (
                    <button className="btn-glass" style={{ color: '#a78bfa', borderColor: '#a78bfa' }}>✨ AI Analysis Ready</button>
                  ) : (
                    <button className="btn-glass">Analyze</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Components Status - Mini View */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Component Health</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {components.map(comp => (
              <div key={comp.id} style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{comp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {comp.id}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '8px' }}>
                  <span className={`status-badge status-${comp.status}`}>{comp.status}</span>
                  <button
                    onClick={() => toggleLock(comp.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: comp.status === 'active' ? '#ef4444' : '#10b981',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      textDecoration: 'underline'
                    }}
                  >
                    {comp.status === 'active' ? 'Lock 🔒' : 'Unlock 🔓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;
