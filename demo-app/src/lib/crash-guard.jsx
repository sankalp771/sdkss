import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3001/api';

// --- Context ---
const CrashGuardContext = createContext({
    getStatus: () => 'active',
    reportError: () => { },
});

// --- Provider ---
export const CrashGuardProvider = ({ children, apiKey, projectId, config = {} }) => {
    const [componentStates, setComponentStates] = useState({});

    // Polling for component status
    useEffect(() => {
        // Register components (optional in MVP, but good practice)
        // We assume the known IDs are passed or discovered

        const fetchStatus = async () => {
            try {
                // We will just poll for a known set of IDs for this demo
                const ids = ['payment-module', 'header-nav', 'hero-section'];
                const { data } = await axios.get(`${API_BASE_URL}/component-status?project_id=${projectId}&component_ids=${ids.join(',')}`);
                setComponentStates(data);
            } catch (err) {
                console.warn("CrashGuard: Failed to fetch status. Using local state.");
            }
        };

        fetchStatus(); // Initial fetch
        const interval = setInterval(fetchStatus, config.pollInterval || 5000); // 5 sec fast poll for demo
        return () => clearInterval(interval);
    }, [projectId]);

    const reportError = async (componentId, error) => {
        console.error(`[CrashGuard] 🚨 Crash Detected in ${componentId}:`, error);

        // DIRECT REPORTING: Send to our backend immediately
        try {
            await axios.post(`${API_BASE_URL}/report-crash`, {
                project_id: projectId, // "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8" for demo
                component_id: componentId,
                error_message: error.message || error.toString(),
                stack_trace: error.stack || "No stack trace available",
                metadata: { userAgent: navigator.userAgent }
            });
            console.log("[CrashGuard] Report sent to Backend ✅");
        } catch (apiErr) {
            console.error("[CrashGuard] Failed to report crash:", apiErr);
        }
    };

    const getStatus = (componentId) => {
        return componentStates[componentId]?.status || 'active';
    };

    const getFallback = (componentId) => {
        return componentStates[componentId]?.fallback_message;
    }

    return (
        <CrashGuardContext.Provider value={{ getStatus, getFallback, reportError }}>
            {children}
        </CrashGuardContext.Provider>
    );
};

// --- The Guard Wrapper Component ---
export const Guard = ({ id, children, fallback }) => {
    const { getStatus, getFallback, reportError } = useContext(CrashGuardContext);

    // 1. Check Remote Status (Circuit Breaker)
    const status = getStatus(id);
    const remoteFallback = getFallback(id);

    if (status === 'maintenance' || status === 'locked') {
        return (
            <div style={shimmerStyle}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🛠️ Feature Unavailable</div>
                <div>{remoteFallback || "We are performing maintenance on this feature."}</div>
            </div>
        );
    }

    // 2. Local Error Boundary
    return (
        <ErrorBoundary id={id} onError={reportError} fallback={fallback}>
            {children}
        </ErrorBoundary>
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.props.onError(this.props.id, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{ ...shimmerStyle, borderColor: '#f87171', background: '#fef2f2', color: '#dc2626' }}>
                    ⚠️ Something went wrong.
                </div>
            );
        }

        return this.props.children;
    }
}

const shimmerStyle = {
    padding: '20px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#64748b',
    fontFamily: 'sans-serif',
    textAlign: 'center',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
};
