
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { signup, login } from './auth/auth.js';
import { authenticateToken } from './auth/middleware.js';
import { 
    createGame, 
    joinGame, 
    getPlayers, 
    startGame, 
    submitQuestions,
    submitAnswer,
    submitVote
} from './game/game.js';
import dotenv from 'dotenv';

dotenv.config();


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Auth routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);

// Game Management
app.post('/api/games', authenticateToken, async (req, res) => {
    const { totalRounds } = req.body;
    const adminId = req.user.userId;
    const game = await createGame(totalRounds, adminId, (gameCode, event, data) => {
        io.to(gameCode).emit(event, data);
    });
    res.status(201).json({ gameCode: game.gameCode });
});

app.post('/api/games/:gameCode/join', authenticateToken, async (req, res) => {
    const { gameCode } = req.params;
    const userId = req.user.userId;
    const { socketId } = req.body;
    const { player, game } = await joinGame(gameCode, userId, socketId);

    if (player) {
        const socket = io.sockets.sockets.get(socketId);
        if(socket) {
            socket.join(gameCode);
        }
        const players = await getPlayers(gameCode);
        io.to(gameCode).emit('playerUpdate', { players });
        res.status(200).json({ message: 'Joined game successfully' });
    } else {
        res.status(404).json({ message: 'Game not found or already started' });
    }
});

// Admin Actions
app.post('/api/admin/games/:gameCode/start', authenticateToken, async (req, res) => {
    const { gameCode } = req.params;
    const game = await startGame(gameCode, req.user.userId);
    if (game) {
        io.to(gameCode).emit('gameStarted');
        res.status(200).json({ message: 'Game started' });
    } else {
        res.status(403).json({ message: 'Not authorized or game not found' });
    }
});

app.post('/api/admin/games/:gameCode/rounds', authenticateToken, async (req, res) => {
    const { gameCode } = req.params;
    const { originalQuestion, impostorQuestion } = req.body;
    const game = await submitQuestions(gameCode, originalQuestion, impostorQuestion, req.user.userId);

    if (game) {
        const players = await getPlayers(gameCode);
        players.forEach(player => {
            const socket = io.sockets.sockets.get(player.socketId);
            if(socket) {
                socket.emit('newRound', {
                    roundNumber: game.current_round,
                    role: player.isImpostor ? 'IMPOSTOR' : 'ORIGINAL',
                    question: player.isImpostor ? game.impostor_question : game.original_question
                });
            }
        });
        res.status(200).json({ message: 'Questions submitted' });
    } else {
        res.status(403).json({ message: 'Not authorized or game not found' });
    }
});


io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    socket.on('submitAnswer', async ({ gameCode, userId, answer }) => {
        await submitAnswer(gameCode, userId, answer);
    });

    socket.on('submitVote', async ({ gameCode, userId, votedForPlayerId }) => {
        const vote = await submitVote(gameCode, userId, votedForPlayerId);
        if (vote) {
            io.to(gameCode).emit('voteReceived', {
                voter: userId,
                votedFor: votedForPlayerId
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
