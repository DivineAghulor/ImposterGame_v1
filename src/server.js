
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
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
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});

// Logging Middleware
const logRequest = (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [HTTP] ${req.method} ${req.url}`);
    if (Object.keys(req.body).length > 0) {
        console.log(`  Body: ${JSON.stringify(req.body)}`);
    }
    next();
};

app.use(cors()); // Enable CORS for all routes
app.use(express.json());
// app.use(logRequest); // Add logging for all requests

// Auth routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);

// Game Management
app.post('/api/games', authenticateToken, async (req, res) => {
    const { totalRounds } = req.body;
    const adminId = req.user.userId;
    console.log(`[GAME] User ${adminId} creating game with ${totalRounds} rounds.`);
    const game = await createGame(totalRounds, adminId, (gameCode, event, data) => {
        console.log(`[SOCKET.IO] Emitting event '${event}' to room ${gameCode}`);
        io.to(gameCode).emit(event, data);
    });
    res.status(201).json({ gameCode: game.game_code });
});

app.post('/api/games/:gameCode/join', authenticateToken, async (req, res) => {
    const { gameCode } = req.params;
    const userId = req.user.userId;
    const { socketId } = req.body;
    console.log(`[GAME] User ${userId} attempting to join game ${gameCode}`);
    const { player, game } = await joinGame(gameCode, userId, socketId);

    if (player) {
        const socket = io.sockets.sockets.get(socketId);
        if(socket) {
            console.log(`[SOCKET.IO] Socket ${socketId} joining room ${gameCode}`);
            socket.join(gameCode);
        }
        const players = await getPlayers(gameCode);
        io.to(gameCode).emit('playerUpdate', { players });
        res.status(200).json({ message: 'Joined game successfully' });
    } else {
        res.status(404).json({ message: 'Game not found or already started' });
    }
});

app.get('/api/games/:gameCode', authenticateToken, async (req, res) => {
    const { gameCode } = req.params;
    console.log(`[HTTP] Fetching game state for ${gameCode}`);
    const game = await getGameByCode(gameCode);
    if (game) {
        const players = await getPlayers(gameCode);
        res.status(200).json({ game, players });
    } else {
        res.status(404).json({ message: 'Game not found' });
    }
});

// Admin Actions
app.post('/api/admin/games/:gameCode/start', authenticateToken, async (req, res) => {
    const { gameCode } = req.params;
    console.log(`[GAME] Admin ${req.user.userId} starting game ${gameCode}`);
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
    console.log(`[GAME] Admin ${req.user.userId} submitting questions for game ${gameCode}`);
    const game = await submitQuestions(gameCode, originalQuestion, impostorQuestion, req.user.userId);

    if (game) {
        const players = await getPlayers(gameCode);
        players.forEach(async (player) => {
            const playerSocketId = playerSockets.get(player.player_id);
            const socket = io.sockets.sockets.get(playerSocketId);
            if(socket) {
                const roundData = {
                    roundNumber: game.current_round,
                    role: player.isImpostor ? 'IMPOSTOR' : 'ORIGINAL',
                    question: player.isImpostor ? game.impostor_question : game.original_question
                };
                console.log(`[SOCKET.IO] Emitting 'newRound' to player ${player.user_id} in game ${gameCode}`);
                socket.emit('newRound', roundData);
            }
        });
        res.status(200).json({ message: 'Questions submitted' });
    } else {
        res.status(403).json({ message: 'Not authorized or game not found' });
    }
});


io.on('connection', (socket) => {
    console.log(`[SOCKET.IO] User connected: ${socket.id}`);

    socket.on('submitAnswer', async ({ gameCode, userId, answer }) => {
        console.log(`[SOCKET.IO] Received 'submitAnswer' from user ${userId} in game ${gameCode}`);
        await submitAnswer(gameCode, userId, answer);
    });

    socket.on('submitVote', async ({ gameCode, userId, votedForPlayerId }) => {
        console.log(`[SOCKET.IO] Received 'submitVote' from user ${userId} for ${votedForPlayerId} in game ${gameCode}`);
        const vote = await submitVote(gameCode, userId, votedForPlayerId);
        if (vote) {
            io.to(gameCode).emit('voteReceived', {
                voter: userId,
                votedFor: votedForPlayerId
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`[SOCKET.IO] User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
