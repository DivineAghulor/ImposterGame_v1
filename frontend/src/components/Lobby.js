import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const Lobby = () => {
    const { gameCode } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const { token, userId } = useAuth();

    const [players, setPlayers] = useState([]);
    const [game, setGame] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [originalQuestion, setOriginalQuestion] = useState('');
    const [impostorQuestion, setImpostorQuestion] = useState('');
    const [message, setMessage] = useState('');

    // Effect for fetching initial game data
    useEffect(() => {
        if (!token || !userId) {
            console.log('Lobby: Waiting for authentication details before fetching game info.');
            return;
        }
        
        console.log(`Lobby: Auth details available. User ID: ${userId}, Token: ${token ? 'present' : 'absent'}`);

        const fetchGameInfo = async () => {
            console.log(`Lobby: Fetching game info for game ${gameCode}...`);
            try {
                const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/games/${gameCode}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log('Lobby: Game info fetched successfully.', data);
                    setGame(data.game);
                    setPlayers(data.players);
                    // Use loose equality to handle potential type mismatch (e.g., number vs. string)
                    const adminCheck = data.game.admin_id == userId;
                    setIsAdmin(adminCheck);
                    console.log(`Lobby: Admin check result for userId '${userId}' vs admin_id '${data.game.admin_id}': ${adminCheck}`);
                } else {
                    console.error(`Lobby: Failed to fetch game info. Status: ${res.status}`);
                }
            } catch (err) {
                console.error('Lobby: An error occurred while fetching game info.', err);
            }
        };

        fetchGameInfo();
    }, [gameCode, token, userId]); // Re-run only if these core identifiers change

    // Effect for handling WebSocket events
    useEffect(() => {
        if (!socket) {
            console.log('Lobby: Socket not available yet, skipping socket event setup.');
            return;
        }

        console.log(`Lobby: Socket connected. Joining game room '${gameCode}' for user '${userId}'.`);
        socket.emit('joinGame', { gameCode, userId });

        const handlePlayerUpdate = (data) => {
            console.log('Lobby: Received playerUpdate event.', data);
            setPlayers(data.players);
        };

        const handleNewRound = (data) => {
            console.log('Lobby: Received newRound event. Navigating to round.', data);
            navigate(`/game/${gameCode}/round`, { state: { roundData: data } });
        };

        socket.on('playerUpdate', handlePlayerUpdate);
        socket.on('newRound', handleNewRound);

        return () => {
            console.log('Lobby: Cleaning up socket listeners.');
            socket.off('playerUpdate', handlePlayerUpdate);
            socket.off('newRound', handleNewRound);
        };
    }, [socket, gameCode, userId, navigate]); // Re-run if socket or identifiers change

    const handleStartGame = async () => {
        console.log('Lobby: Admin clicking "Start Game"...');
        try {
            const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/games/${gameCode}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                console.log('Lobby: Game start signal sent successfully.');
            } else {
                console.error('Lobby: Failed to send start signal.', res.status);
            }
        } catch (err) {
            console.error('Lobby: Error starting game.', err);
        }
    };

    const handleSubmitQuestions = async () => {
        console.log('Lobby: Admin submitting questions...');
        if (!originalQuestion || !impostorQuestion) {
            console.warn('Lobby: Questions submission blocked. Both questions required.');
            setMessage('Please fill out both questions.');
            return;
        }
        try {
            const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/games/${gameCode}/rounds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ originalQuestion, impostorQuestion })
            });
            if (res.ok) {
                console.log('Lobby: Questions submitted successfully.');
            } else {
                console.error('Lobby: Failed to submit questions.', res.status);
            }
        } catch (err) {
            console.error('Lobby: Error submitting questions.', err);
        }
    };

    console.log(`Lobby: Rendering component. IsAdmin: ${isAdmin}, Players: ${players.length}`);

    return (
        <div className="lobby-container">
            <h2>Game Lobby</h2>
            <p className="game-code-display">Game Code: <span>{gameCode}</span></p>
            
            <div className="players-list">
                <h3>Players</h3>
                <ul>
                    {players.map((p, index) => <li key={index}>{p.username || `User ID: ${p.userId}`}</li>)}
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
