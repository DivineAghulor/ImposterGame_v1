import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { username, token, logout } = useAuth();
    const [gameCode, setGameCode] = useState('');
    const [totalRounds, setTotalRounds] = useState(5);
    const [message, setMessage] = useState({ type: '', text: '' });
    const navigate = useNavigate();

    const handleCreateGame = async () => {
        setMessage({ type: '', text: '' });
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ totalRounds: parseInt(totalRounds, 10) }),
            });
            const data = await response.json();
            if (response.ok) {
                navigate(`/game/${data.gameCode}/lobby`);
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to create game.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Server connection error.' });
        }
    };

    const handleJoinGame = async () => {
        if (!gameCode) {
            setMessage({ type: 'error', text: 'Please enter a game code.' });
            return;
        }
        setMessage({ type: '', text: '' });
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/games/${gameCode}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await response.json();
            if (response.ok) {
                navigate(`/game/${gameCode}/lobby`);
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to join game.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Server connection error.' });
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h2>Welcome, {username}!</h2>
                <button onClick={logout} className="btn-logout">Logout</button>
            </div>
            
            <div className="game-section">
                <h3>Create a New Game</h3>
                <div className="form-group">
                    <label htmlFor="totalRounds">Number of Rounds</label>
                    <input
                        type="number"
                        id="totalRounds"
                        value={totalRounds}
                        onChange={(e) => setTotalRounds(e.target.value)}
                        min="1"
                        max="20"
                    />
                </div>
                <button onClick={handleCreateGame} className="btn-primary">Create Game</button>
            </div>

            <div className="join-divider">OR</div>

            <div className="game-section">
                <h3>Join an Existing Game</h3>
                <div className="form-group">
                    <label htmlFor="gameCode">Enter Game Code</label>
                    <input
                        type="text"
                        id="gameCode"
                        value={gameCode}
                        onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                        placeholder="ABCXYZ"
                    />
                </div>
                <button onClick={handleJoinGame} className="btn-primary">Join Game</button>
            </div>
            {message.text && (
                <div className={`message-area ${message.type}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
