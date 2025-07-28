import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
        try {
            const url = `${process.env.REACT_APP_BACKEND_URL}${endpoint}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                if (isLogin) {
                    // Expect backend to return userId in login response
                    login(data.token, data.userId);
                    navigate('/dashboard');
                } else {
                    setMessage({ type: 'success', text: 'Signup successful! Please log in.' });
                    setIsLogin(true);
                }
            } else {
                setMessage({ type: 'error', text: data.message || 'An error occurred.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Could not connect to the server.' });
        }
    };

    return (
        <div className="auth-container">
            <div className="tab-buttons">
                <button onClick={() => setIsLogin(true)} className={`tab-button ${isLogin ? 'active' : ''}`}>
                    Login
                </button>
                <button onClick={() => setIsLogin(false)} className={`tab-button ${!isLogin ? 'active' : ''}`}>
                    Sign Up
                </button>
            </div>
            <form onSubmit={handleSubmit}>
                <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn-primary">
                    {isLogin ? 'Login' : 'Create Account'}
                </button>
            </form>
            {message.text && (
                <div className={`message-area ${message.type}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
};

export default Auth;
