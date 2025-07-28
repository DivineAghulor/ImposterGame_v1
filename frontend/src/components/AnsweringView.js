import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const AnsweringView = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const { gameCode } = useParams();
    const socket = useSocket();
    const { username } = useAuth();

    const [answer, setAnswer] = useState('');
    const [roundData, setRoundData] = useState(state?.roundData);
    const [timeLeft, setTimeLeft] = useState(60);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!socket) return;

        // Listen for the start of the voting phase
        const handleVotingPhase = (data) => {
            navigate(`/game/${gameCode}/vote`, { state: { answers: data.answers } });
        };
        socket.on('votingPhase', handleVotingPhase);

        // Timer countdown
        const timer = setInterval(() => {
            setTimeLeft(prevTime => (prevTime > 0 ? prevTime - 1 : 0));
        }, 1000);

        // If the component mounts without round data (e.g., a refresh), it should be handled.
        // For now, we assume navigation from lobby provides the state.
        if (!roundData) {
            // In a real app, you might fetch game state here or redirect.
            console.error("No round data found!");
        }

        return () => {
            socket.off('votingPhase', handleVotingPhase);
            clearInterval(timer);
        };
    }, [socket, navigate, gameCode, roundData]);

    const handleSubmit = () => {
        if (answer.trim() && !submitted) {
            socket.emit('submitAnswer', { gameCode, userId: username, answer });
            setSubmitted(true);
        }
    };

    if (!roundData) {
        return <div className="loading-container">Loading round...</div>;
    }

    const isTimeUp = timeLeft === 0;

    return (
        <div className="answering-container">
            <div className="timer-display">Time Left: {timeLeft}s</div>
            <h2 className="question-display">{roundData.question}</h2>
            <p className="role-display">Your Role: {roundData.role}</p>
            
            <textarea
                className="answer-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                disabled={isTimeUp || submitted}
            />
            <button 
                onClick={handleSubmit} 
                className="btn-primary" 
                disabled={isTimeUp || submitted}
            >
                {submitted ? 'Answer Submitted' : 'Submit Answer'}
            </button>
            {isTimeUp && !submitted && <p className="message-area error">Time's up!</p>}
        </div>
    );
};

export default AnsweringView;
