import React, { useState } from 'react';
import { CrashGuardProvider, Guard } from './lib/crash-guard';
import './App.css';

// --- Buggy Components ---

const PaymentModule = () => {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error("PaymentGatewayTimeout: 504 Gateway Time-out");
  }

  return (
    <div className="feature-card">
      <h3>💳 Payment Gateway</h3>
      <p>Securely process your payments here.</p>
      <button onClick={() => setShouldCrash(true)} className="danger-btn">
        🧨 Trigger Crash
      </button>
    </div>
  );
};

const HeaderNav = () => {
  return (
    <div className="header-nav">
      <h2>MyApp 🚀</h2>
      <div style={{ display: 'flex', gap: '15px' }}>
        <span>Home</span>
        <span>Profile</span>
        <span>Settings</span>
      </div>
    </div>
  );
};

function App() {
  // Using the Seeded Project ID for direct DB linking
  return (
    <CrashGuardProvider projectId="41ed4c1c-683d-4ccc-a526-0d8cb7a015c8" apiKey="demo-key">
      <div className="app-container">
        {/* Header - Protected */}
        <Guard id="header-nav">
          <HeaderNav />
        </Guard>

        <main style={{ padding: '40px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

          {/* Robust Feature */}
          <div className="feature-card">
            <h3>📝 User Profile</h3>
            <p>This component is stable and working fine.</p>
            <button>Edit Profile</button>
          </div>

          {/* Risky Feature - Protected */}
          <Guard id="payment-module">
            <PaymentModule />
          </Guard>

        </main>
      </div>
    </CrashGuardProvider>
  );
}

export default App;
