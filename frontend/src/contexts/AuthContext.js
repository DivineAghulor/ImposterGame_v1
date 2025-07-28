import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [username, setUsername] = useState(null);

    const login = (newToken, newUsername) => {
        setToken(newToken);
        setUsername(newUsername);
    };

    const logout = () => {
        setToken(null);
        setUsername(null);
    };

    const authValue = {
        token,
        username,
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
