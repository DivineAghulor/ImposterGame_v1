import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Initialize state from localStorage
    const [token, setToken] = useState(() => localStorage.getItem('authToken'));
    const [userId, setUserId] = useState(() => localStorage.getItem('authUserId'));

    useEffect(() => {
        // This effect handles the case where localStorage might be cleared manually
        // or by other parts of the app, keeping the state in sync.
        const handleStorageChange = () => {
            setToken(localStorage.getItem('authToken'));
            setUserId(localStorage.getItem('authUserId'));
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const login = (newToken, newUserId) => {
        // Save to localStorage
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authUserId', newUserId);
        // Update state
        setToken(newToken);
        setUserId(newUserId);
    };

    const logout = () => {
        // Clear from localStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUserId');
        // Update state
        setToken(null);
        setUserId(null);
    };

    const authValue = {
        token,
        userId,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={authValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
