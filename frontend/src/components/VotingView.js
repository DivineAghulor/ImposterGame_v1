import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const VotingView = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { gameCode } = useParams();
    const socket = useSocket();
    const { username } = useAuth();

    const [answers, setAnswers] = useState(state?.answers || []);
    const [votes, setVotes] = useState({}); // { playerId: count }
    const [voteLog, setVoteLog] = useState([]); // ["Player A voted for Player B"]
    const [hasVoted, setHasVoted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(180);

    useEffect(() => {
        if (!socket) return;

        const handleVoteReceived = (data) => {
            setVotes(prevVotes => ({
                ...prevVotes,
                [data.votedFor]: (prevVotes[data.votedFor] || 0) + 1
            }));
            setVoteLog(prevLog => [...prevLog, `${data.voter} voted for ${data.votedFor}`]);
        };

        const handleRoundResult = (data) => {
            navigate(`/game/${gameCode}/results`, { state: { results: data } });
        };

        socket.on('voteReceived', handleVoteReceived);
        socket.on('roundResult', handleRoundResult);

        const timer = setInterval(() => {
            setTimeLeft(prevTime => (prevTime > 0 ? prevTime - 1 : 0));
        }, 1000);

        return () => {
            socket.off('voteReceived', handleVoteReceived);
            socket.off('roundResult', handleRoundResult);
            clearInterval(timer);
        };
    }, [socket, navigate, gameCode]);

    const handleVote = (votedForPlayerId) => {
        if (!hasVoted) {
            socket.emit('submitVote', { gameCode, userId: username, votedForPlayerId });
            setHasVoted(true);
        }
    };

    const isTimeUp = timeLeft === 0;

    return (
        <div className="voting-container">
            <div className="timer-display">Voting Ends In: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
            <h2>Vote for the Impostor!</h2>
            
            <div className="answers-grid">
                {answers.map((a, index) => (
                    <div key={index} className="answer-card">
                        <p className="answer-text">"{a.answer}"</p>
                        <p className="answer-author">- {a.player}</p>
                    </div>
                ))}
            </div>

            <div className="voting-section">
                <h3>Players</h3>
                <ul className="players-to-vote">
                    {answers.map((a, index) => (
                        <li key={index}>
                            <span>{a.player} ({votes[a.player] || 0} votes)</span>
                            {a.player !== username && (
                                <button 
                                    onClick={() => handleVote(a.player)} 
                                    disabled={hasVoted || isTimeUp}
                                    className="btn-vote"
                                >
                                    Vote
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="vote-log">
                <h4>Live Vote Feed</h4>
                {voteLog.map((log, i) => <p key={i}>{log}</p>)}
            </div>
        </div>
    );
};

export default VotingView;
