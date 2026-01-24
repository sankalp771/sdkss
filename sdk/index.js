import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// --- Configuration ---
const API_BASE_URL = 'http://localhost:3001/api'; // Default to local backend

// --- Context ---
const CrashGuardContext = createContext({
    checkStatus: () => 'active',
    reportError: () => { },
});

// --- Provider ---
export const CrashGuardProvider = ({ children, apiKey, projectId, config = {} }) => {
    const [lockedComponents, setLockedComponents] = useState({});

    // Polling for component status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                // ideally we send a list of all registered component IDs, 
                // but for now let's just fetch global locks for the project
                // implementation would differ based on the backend endpoint logic
                // const { data } = await axios.get(`${API_BASE_URL}/component-status?project_id=${projectId}`);
                // setLockedComponents(data); 
            } catch (err) {
                console.error("CrashGuard: Failed to fetch status", err);
            }
        };

        const interval = setInterval(fetchStatus, config.pollInterval || 60000); // 1 min poll
        return () => clearInterval(interval);
    }, [projectId]);

    const reportError = async (componentId, error) => {
        // In a real SDK, we might debounce this or send it to specific endpoints
        console.error(`[CrashGuard] Error in ${componentId}:`, error);
        // We could manually trigger a "lock" request if the error is critical
    };

    const getStatus = (componentId) => {
        return lockedComponents[componentId]?.status || 'active';
    };

    return (
        <CrashGuardContext.Provider value={{ getStatus, reportError }}>
            {children}
        </CrashGuardContext.Provider>
    );
};

// --- The Guard Wrapper Component ---
export const Guard = ({ id, children, fallback }) => {
    const { getStatus, reportError } = useContext(CrashGuardContext);
    const [hasError, setHasError] = useState(false);

    // 1. Check Remote Status (Circuit Breaker)
    const status = getStatus(id);

    if (status === 'maintenance' || status === 'locked') {
        return fallback || <div style={defaultFallbackStyle}>⚠️ Component Maintenance: {id}</div>;
    }

    // 2. Local Error Boundary Logic
    // Note: To properly catch errors in children, this component should technically be a Class Component
    // or use a wrapper class component since Hooks don't support getDerivedStateFromError yet.
    // For this snippet, I'll use a functional approach assuming a parent ErrorBoundary exists 
    // OR we implement a class-based boundary inside here.

    return (
        <ErrorBoundary id={id} onError={reportError} fallback={fallback}>
            {children}
        </ErrorBoundary>
    );
};

// Internal Class-based Error Boundary
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
            return this.props.fallback || <div style={defaultFallbackStyle}>⚠️ Service Interrupted</div>;
        }

        return this.props.children;
    }
}

const defaultFallbackStyle = {
    padding: '20px',
    backgroundColor: '#fff4f4',
    border: '1px solid #ffcccc',
    borderRadius: '8px',
    color: '#c00',
    fontFamily: 'sans-serif',
    textAlign: 'center'
};
