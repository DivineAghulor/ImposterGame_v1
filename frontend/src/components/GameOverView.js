import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GameOverView = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const finalResults = state?.finalResults;

    if (!finalResults) {
        return <div className="loading-container">Loading final results...</div>;
    }

    const winner = finalResults.finalScores[0];

    return (
        <div className="game-over-container">
            <h1>Game Over!</h1>
            <h2>Winner: {winner.player}</h2>
            
            <h3>Final Scoreboard</h3>
            <ul className="scoreboard">
                {finalResults.finalScores.map((p, index) => (
                    <li key={index}>
                        {p.player}: {p.score} points
                    </li>
                ))}
            </ul>

            <button onClick={() => navigate('/dashboard')} className="btn-primary">
                Return to Dashboard
            </button>
        </div>
    );
};

export default GameOverView;
