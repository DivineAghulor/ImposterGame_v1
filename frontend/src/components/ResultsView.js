import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';

const ResultsView = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { gameCode } = useParams();
    const socket = useSocket();
    const results = state?.results;

    useEffect(() => {
        if (!socket) return;

        const handleNewRound = (data) => {
            navigate(`/game/${gameCode}/round`, { state: { roundData: data } });
        };

        const handleGameOver = (data) => {
            navigate(`/game/${gameCode}/summary`, { state: { finalResults: data } });
        };

        socket.on('newRound', handleNewRound);
        socket.on('gameOver', handleGameOver);
        // The admin gets a different event to prompt for next questions
        socket.on('nextRoundReady', () => {
            // For the admin, we redirect back to the lobby to input new questions
            navigate(`/game/${gameCode}/lobby`);
        });

        return () => {
            socket.off('newRound', handleNewRound);
            socket.off('gameOver', handleGameOver);
            socket.off('nextRoundReady');
        };
    }, [socket, navigate, gameCode]);

    if (!results) {
        return <div className="loading-container">Waiting for results...</div>;
    }

    return (
        <div className="results-container">
            <h2>Round Over!</h2>
            <p className="impostor-reveal">The Impostor was: <span>{results.impostor}</span></p>
            
            <h3>Scores</h3>
            <ul className="scoreboard">
                {results.scores.sort((a, b) => b.score - a.score).map((p, index) => (
                    <li key={index}>
                        {p.player}: {p.score} points
                    </li>
                ))}
            </ul>

            <p className="next-round-message">The next round will begin shortly...</p>
        </div>
    );
};

export default ResultsView;
