
import pool from '../utils/db.js';
import dotenv from 'dotenv';

dotenv.config();

// We will keep a lightweight in-memory cache for socket IDs and event emitters
const gameEmitters = new Map();
export const playerSockets = new Map(); // Exporting for server.js to use
// Utility to get game object by code
export async function getGameByCode(gameCode) {
    console.log(`[DB] Fetching game data for GameCode: ${gameCode}`);
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1', [gameCode]);
    return gameResult.rows[0] || null;
}

function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createGame(totalRounds, adminId, eventEmitter) {
    const gameCode = generateGameCode();
    console.log(`[DB] Creating game ${gameCode} for admin ${adminId}`);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const newGameResult = await client.query(
            'INSERT INTO Games (game_code, admin_id, total_rounds) VALUES ($1, $2, $3) RETURNING *',
            [gameCode, adminId, totalRounds]
        );
        const game = newGameResult.rows[0];
        
        console.log(`[GAME] Game ${gameCode} created with ID ${game.game_id}. Adding admin as player.`);
        
        await client.query(
            'INSERT INTO Players (game_id, user_id) VALUES ($1, $2)',
            [game.game_id, adminId]
        );

        await client.query('COMMIT');
        
        gameEmitters.set(gameCode, eventEmitter);
        console.log(`[GAME] Admin ${adminId} successfully added as player to game ${gameCode}.`);
        return game;
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[DB] Error creating game for admin ${adminId}:`, e);
        throw e;
    } finally {
        client.release();
    }
}

export async function joinGame(gameCode, userId, socketId) {
    console.log(`[DB] Fetching game data for code: ${gameCode}`);
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1', [gameCode]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'LOBBY') {
        console.log(`[GAME] Game ${gameCode} is in LOBBY. User ${userId} joining.`);
        const newPlayer = await pool.query(
            'INSERT INTO Players (game_id, user_id) VALUES ($1, $2) RETURNING *',
            [game.game_id, userId]
        );
        const playerId = newPlayer.rows[0].player_id;
        playerSockets.set(playerId, socketId);
        console.log(`[GAME] Player ${userId} joined with Player ID ${playerId} and Socket ID ${socketId}`);
        return { player: newPlayer.rows[0], game };
    }
    console.warn(`[GAME] Join failed for ${userId} in game ${gameCode}. State: ${game?.game_state}`);
    return { player: null, game: null };
}

export async function getPlayers(gameCode) {
    const gameResult = await pool.query('SELECT game_id FROM Games WHERE game_code = $1', [gameCode]);
    if (gameResult.rows.length === 0) return [];
    const gameId = gameResult.rows[0].game_id;

    const playersResult = await pool.query(
        'SELECT p.player_id, u.username, p.score FROM Players p JOIN Users u ON p.user_id = u.user_id WHERE p.game_id = $1', 
        [gameId]
    );
    return playersResult.rows;
}

export async function startGame(gameCode, userId) {
    console.log(`[GAME] Attempting to start game ${gameCode} by user ${userId}`);
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1 AND admin_id = $2', [gameCode, userId]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'LOBBY') {
        await pool.query("UPDATE Games SET game_state = 'QUESTION_INPUT' WHERE game_code = $1", [gameCode]);
        console.log(`[GAME] Game ${gameCode} state changed to QUESTION_INPUT`);
        return game;
    }
    console.warn(`[GAME] Start failed for game ${gameCode}. State: ${game?.game_state}`);
    return null;
}

export async function submitQuestions(gameCode, originalQuestion, impostorQuestion, userId) {
    console.log(`[GAME] Attempting to submit questions for game ${gameCode} by user ${userId}`);
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1 AND admin_id = $2', [gameCode, userId]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'QUESTION_INPUT') {
        const newRoundNumber = game.current_round + 1;
        
        const playersResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1', [game.game_id]);
        const players = playersResult.rows;
        const impostorIndex = Math.floor(Math.random() * players.length);
        const impostorPlayerId = players[impostorIndex].player_id;
        console.log(`[GAME] Round ${newRoundNumber}: Impostor is Player ID ${impostorPlayerId}`);

        const roundResult = await pool.query(
            'INSERT INTO Rounds (game_id, round_number, original_question, impostor_question, impostor_player_id) VALUES ($1, $2, $3, $4, $5) RETURNING round_id',
            [game.game_id, newRoundNumber, originalQuestion, impostorQuestion, impostorPlayerId]
        );
        const roundId = roundResult.rows[0].round_id;
        console.log(`[DB] Created Round ${roundId} for Game ${game.game_id}`);

        await pool.query("UPDATE Games SET game_state = 'ANSWERING', current_round = $1 WHERE game_code = $2", [newRoundNumber, gameCode]);
        console.log(`[GAME] Game ${gameCode} state changed to ANSWERING. Timer started.`);
        
        setTimeout(() => {
            transitionToVoting(gameCode, game.game_id, roundId);
        }, 60000); // 60 seconds

        const updatedGame = { ...game, current_round: newRoundNumber, original_question: originalQuestion, impostor_question: impostorQuestion };
        const gamePlayers = await getPlayers(gameCode);
        
        const fullPlayerInfo = await Promise.all(gamePlayers.map(async (p) => {
            const userResult = await pool.query('SELECT username FROM Users WHERE user_id = $1', [p.user_id]);
            return { ...p, username: userResult.rows[0].username, isImpostor: p.player_id === impostorPlayerId };
        }));

        return { ...updatedGame, players: fullPlayerInfo };
    }
    console.warn(`[GAME] Submit questions failed for game ${gameCode}. State: ${game?.game_state}`);
    return null;
}

export async function submitAnswer(gameCode, userId, answer) {
    const gameResult = await pool.query("SELECT game_id, current_round, game_state FROM Games WHERE game_code = $1", [gameCode]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'ANSWERING') {
        const playerResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1 AND user_id = $2', [game.game_id, userId]);
        const player = playerResult.rows[0];
        const roundResult = await pool.query('SELECT round_id FROM Rounds WHERE game_id = $1 AND round_number = $2', [game.game_id, game.current_round]);
        const round = roundResult.rows[0];

        if (player && round) {
            console.log(`[DB] Storing answer for Player ${player.player_id} in Round ${round.round_id}`);
            await pool.query(
                'INSERT INTO Submissions (round_id, player_id, answer_text) VALUES ($1, $2, $3)',
                [round.round_id, player.player_id, answer]
            );
        }
    }
}

async function transitionToVoting(gameCode, gameId, roundId) {
    console.log(`[GAME] Transitioning ${gameCode} to VOTING state for Round ID ${roundId}`);
    await pool.query("UPDATE Games SET game_state = 'VOTING' WHERE game_code = $1", [gameCode]);
    
    const submissionsResult = await pool.query('SELECT u.username, s.answer_text FROM Submissions s JOIN Players p ON s.player_id = p.player_id JOIN Users u ON p.user_id = u.user_id WHERE s.round_id = $1', [roundId]);
    const answers = submissionsResult.rows.map(r => ({ player: r.username, answer: r.answer_text }));
    
    const emit = gameEmitters.get(gameCode);
    if (emit) {
        console.log(`[SOCKET.IO] Emitting 'votingPhase' to room ${gameCode}`);
        emit('votingPhase', { answers });
    }

    setTimeout(() => {
        transitionToScoring(gameCode, gameId, roundId);
    }, 180000); // 3 minutes
}

export async function submitVote(gameCode, userId, votedForPlayerUsername) {
    const gameResult = await pool.query("SELECT game_id, game_state, current_round FROM Games WHERE game_code = $1", [gameCode]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'VOTING') {
        const voterResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1 AND user_id = $2', [game.game_id, userId]);
        const voter = voterResult.rows[0];
        
        const votedForUserResult = await pool.query('SELECT user_id FROM Users WHERE username = $1', [votedForPlayerUsername]);
        const votedForUser = votedForUserResult.rows[0];
        
        const votedForResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1 AND user_id = $2', [game.game_id, votedForUser.user_id]);
        const votedFor = votedForResult.rows[0];

        const roundResult = await pool.query('SELECT round_id FROM Rounds WHERE game_id = $1 AND round_number = $2', [game.game_id, game.current_round]);
        const round = roundResult.rows[0];

        if (voter && votedFor && round) {
            console.log(`[DB] Storing vote from Player ${voter.player_id} for Player ${votedFor.player_id} in Round ${round.round_id}`);
            await pool.query(
                `INSERT INTO Submissions (round_id, player_id, voted_for_player_id) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (round_id, player_id) 
                 DO UPDATE SET voted_for_player_id = $3`,
                [round.round_id, voter.player_id, votedFor.player_id]
            );
            return { voter: userId, votedFor: votedForPlayerUsername };
        }
    }
    return null;
}

async function transitionToScoring(gameCode, gameId, roundId) {
    console.log(`[GAME] Transitioning ${gameCode} to SCORING state for Round ID ${roundId}`);
    await pool.query("UPDATE Games SET game_state = 'SCORING' WHERE game_code = $1", [gameCode]);

    const submissionsResult = await pool.query('SELECT voted_for_player_id FROM Submissions WHERE round_id = $1 AND voted_for_player_id IS NOT NULL', [roundId]);
    const votes = {};
    submissionsResult.rows.forEach(r => {
        votes[r.voted_for_player_id] = (votes[r.voted_for_player_id] || 0) + 1;
    });
    console.log(`[GAME] Vote tally for Round ${roundId}:`, votes);

    let maxVotes = 0;
    let mostVotedPlayerIds = [];
    for (const playerId in votes) {
        if (votes[playerId] > maxVotes) {
            maxVotes = votes[playerId];
            mostVotedPlayerIds = [playerId];
        } else if (votes[playerId] === maxVotes) {
            mostVotedPlayerIds.push(playerId);
        }
    }

    const roundResult = await pool.query('SELECT impostor_player_id FROM Rounds WHERE round_id = $1', [roundId]);
    const impostorPlayerId = roundResult.rows[0].impostor_player_id;
    console.log(`[GAME] Scoring: Impostor was ${impostorPlayerId}. Most voted IDs: ${mostVotedPlayerIds.join(', ')} with ${maxVotes} votes.`);

    if (mostVotedPlayerIds.length === 1 && mostVotedPlayerIds[0] == impostorPlayerId) {
        console.log(`[GAME] Scoring: Impostor caught. Non-impostors get 2 points.`);
        await pool.query('UPDATE Players SET score = score + 2 WHERE game_id = $1 AND player_id != $2', [gameId, impostorPlayerId]);
    } else if (mostVotedPlayerIds.length > 1 && mostVotedPlayerIds.includes(String(impostorPlayerId))) {
        console.log(`[GAME] Scoring: Tie vote including impostor. Impostor gets 1 point.`);
        await pool.query('UPDATE Players SET score = score + 1 WHERE player_id = $1', [impostorPlayerId]);
    } else {
        console.log(`[GAME] Scoring: Impostor not caught. Impostor gets 2 points, correct voters get 1.`);
        await pool.query('UPDATE Players SET score = score + 2 WHERE player_id = $1', [impostorPlayerId]);
        const correctVotersResult = await pool.query('SELECT player_id FROM Submissions WHERE round_id = $1 AND voted_for_player_id = $2', [roundId, impostorPlayerId]);
        const correctVoterIds = correctVotersResult.rows.map(r => r.player_id);
        if (correctVoterIds.length > 0) {
            await pool.query('UPDATE Players SET score = score + 1 WHERE player_id = ANY($1::int[])', [correctVoterIds]);
        }
    }

    const playersResult = await pool.query('SELECT u.username, p.score FROM Players p JOIN Users u ON p.user_id = u.user_id WHERE p.game_id = $1', [gameId]);
    const scores = playersResult.rows.map(p => ({ player: p.username, score: p.score }));
    const impostorUserResult = await pool.query('SELECT u.username FROM Players p JOIN Users u ON p.user_id = u.user_id WHERE p.player_id = $1', [impostorPlayerId]);
    const impostorUsername = impostorUserResult.rows[0].username;

    const emit = gameEmitters.get(gameCode);
    if (emit) {
        console.log(`[SOCKET.IO] Emitting 'roundResult' to room ${gameCode}`);
        emit('roundResult', { impostor: impostorUsername, scores });
    }

    transitionToRoundEnd(gameCode, gameId);
}

async function transitionToRoundEnd(gameCode, gameId) {
    const gameResult = await pool.query('SELECT current_round, total_rounds FROM Games WHERE game_code = $1', [gameCode]);
    const game = gameResult.rows[0];
    console.log(`[GAME] End of Round ${game.current_round} for game ${gameCode}. Total rounds: ${game.total_rounds}`);

    if (game.current_round >= game.total_rounds) {
        console.log(`[GAME] Game ${gameCode} is over. Finalizing scores.`);
        await pool.query("UPDATE Games SET game_state = 'GAME_OVER' WHERE game_code = $1", [gameCode]);
        const finalScoresResult = await pool.query('SELECT u.username, p.score FROM Players p JOIN Users u ON p.user_id = u.user_id WHERE p.game_id = $1 ORDER BY score DESC', [gameId]);
        const finalScores = finalScoresResult.rows.map(p => ({ player: p.username, score: p.score }));
        const emit = gameEmitters.get(gameCode);
        if (emit) {
            console.log(`[SOCKET.IO] Emitting 'gameOver' to room ${gameCode}`);
            emit('gameOver', { finalScores });
        }
    } else {
        console.log(`[GAME] Preparing for next round in game ${gameCode}.`);
        await pool.query("UPDATE Games SET game_state = 'ROUND_END' WHERE game_code = $1", [gameCode]);
        setTimeout(async () => {
            await pool.query("UPDATE Games SET game_state = 'QUESTION_INPUT' WHERE game_code = $1", [gameCode]);
            const emit = gameEmitters.get(gameCode);
            if (emit) {
                console.log(`[SOCKET.IO] Emitting 'nextRoundReady' to room ${gameCode}`);
                emit('nextRoundReady');
            }
        }, 5000);
    }
}
