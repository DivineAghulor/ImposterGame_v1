import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);

    const login = (newToken, newUserId) => {
        setToken(newToken);
        setUserId(newUserId);
    };

    const logout = () => {
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
