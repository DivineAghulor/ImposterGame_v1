import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const Lobby = () => {
    const { gameCode } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const { token, username } = useAuth(); // Assuming username is the user's ID for now

    const [players, setPlayers] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false); // This needs to be determined from backend
    const [originalQuestion, setOriginalQuestion] = useState('');
    const [impostorQuestion, setImpostorQuestion] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!socket) return;

        // Join the game room upon connecting
        socket.emit('joinGame', { gameCode, userId: username });

        socket.on('playerUpdate', (data) => {
            setPlayers(data.players);
            // A simple way to check for admin - the first player is the admin
            if (data.players.length > 0 && data.players[0].userId === username) {
                setIsAdmin(true);
            }
        });

        socket.on('newRound', (data) => {
            // Navigate to the round, passing state
            navigate(`/game/${gameCode}/round`, { state: { roundData: data } });
        });

        // Clean up listeners
        return () => {
            socket.off('playerUpdate');
            socket.off('newRound');
        };
    }, [socket, gameCode, username, navigate]);

    const handleStartGame = async () => {
        // Step 1: Start the game
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/games/${gameCode}/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    };

    const handleSubmitQuestions = async () => {
        if (!originalQuestion || !impostorQuestion) {
            setMessage('Please fill out both questions.');
            return;
        }
        // Step 2: Submit questions
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/games/${gameCode}/rounds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ originalQuestion, impostorQuestion })
        });
    };

    return (
        <div className="lobby-container">
            <h2>Game Lobby</h2>
            <p className="game-code-display">Game Code: <span>{gameCode}</span></p>
            
            <div className="players-list">
                <h3>Players</h3>
                <ul>
                    {players.map((p, index) => <li key={index}>{p.userId}</li>)}
                </ul>
            </div>

            {isAdmin ? (
                <div className="admin-controls">
                    <h3>Admin Controls</h3>
                    <div className="form-group">
                        <label>Originals' Question</label>
                        <input type="text" value={originalQuestion} onChange={e => setOriginalQuestion(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Impostor's Question</label>
                        <input type="text" value={impostorQuestion} onChange={e => setImpostorQuestion(e.target.value)} />
                    </div>
                    <button onClick={handleStartGame} className="btn-primary">1. Start Game</button>
                    <button onClick={handleSubmitQuestions} className="btn-primary" style={{marginTop: '10px'}}>2. Submit Questions & Begin</button>
                    {message && <p className="message-area error">{message}</p>}
                </div>
            ) : (
                <p className="waiting-message">Waiting for the Admin to start the game...</p>
            )}
        </div>
    );
};

export default Lobby;
