
import pool from '../utils/db.js';
import dotenv from 'dotenv';

dotenv.config();

// We will keep a lightweight in-memory cache for socket IDs and event emitters
const gameEmitters = new Map();
const playerSockets = new Map();

function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createGame(totalRounds, adminId, eventEmitter) {
    const gameCode = generateGameCode();
    const newGame = await pool.query(
        'INSERT INTO Games (game_code, admin_id, total_rounds) VALUES ($1, $2, $3) RETURNING *',
        [gameCode, adminId, totalRounds]
    );
    gameEmitters.set(gameCode, eventEmitter);
    return newGame.rows[0];
}

export async function joinGame(gameCode, userId, socketId) {
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1', [gameCode]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'LOBBY') {
        const newPlayer = await pool.query(
            'INSERT INTO Players (game_id, user_id) VALUES ($1, $2) RETURNING *',
            [game.game_id, userId]
        );
        playerSockets.set(newPlayer.rows[0].player_id, socketId);
        return { player: newPlayer.rows[0], game };
    }
    return { player: null, game: null };
}

export async function getPlayers(gameCode) {
    const gameResult = await pool.query('SELECT game_id FROM Games WHERE game_code = $1', [gameCode]);
    if (gameResult.rows.length === 0) return [];
    const gameId = gameResult.rows[0].game_id;

    const playersResult = await pool.query('SELECT user_id, score FROM Players WHERE game_id = $1', [gameId]);
    return playersResult.rows;
}

export async function startGame(gameCode, userId) {
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1 AND admin_id = $2', [gameCode, userId]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'LOBBY') {
        await pool.query("UPDATE Games SET game_state = 'QUESTION_INPUT' WHERE game_code = $1", [gameCode]);
        return game;
    }
    return null;
}

export async function submitQuestions(gameCode, originalQuestion, impostorQuestion, userId) {
    const gameResult = await pool.query('SELECT * FROM Games WHERE game_code = $1 AND admin_id = $2', [gameCode, userId]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'QUESTION_INPUT') {
        const newRoundNumber = game.current_round + 1;
        
        const playersResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1', [game.game_id]);
        const players = playersResult.rows;
        const impostorIndex = Math.floor(Math.random() * players.length);
        const impostorPlayerId = players[impostorIndex].player_id;

        const roundResult = await pool.query(
            'INSERT INTO Rounds (game_id, round_number, original_question, impostor_question, impostor_player_id) VALUES ($1, $2, $3, $4, $5) RETURNING round_id',
            [game.game_id, newRoundNumber, originalQuestion, impostorQuestion, impostorPlayerId]
        );
        const roundId = roundResult.rows[0].round_id;

        await pool.query("UPDATE Games SET game_state = 'ANSWERING', current_round = $1 WHERE game_code = $2", [newRoundNumber, gameCode]);
        
        setTimeout(() => {
            transitionToVoting(gameCode, game.game_id, roundId);
        }, 60000);

        return { ...game, current_round: newRoundNumber, original_question: originalQuestion, impostor_question: impostorQuestion };
    }
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
            await pool.query(
                'INSERT INTO Submissions (round_id, player_id, answer_text) VALUES ($1, $2, $3)',
                [round.round_id, player.player_id, answer]
            );
        }
    }
}

async function transitionToVoting(gameCode, gameId, roundId) {
    await pool.query("UPDATE Games SET game_state = 'VOTING' WHERE game_code = $1", [gameCode]);
    
    const submissionsResult = await pool.query('SELECT p.user_id, s.answer_text FROM Submissions s JOIN Players p ON s.player_id = p.player_id WHERE s.round_id = $1', [roundId]);
    const answers = submissionsResult.rows.map(r => ({ player: r.user_id, answer: r.answer_text }));
    
    const emit = gameEmitters.get(gameCode);
    if (emit) emit('votingPhase', { answers });

    setTimeout(() => {
        transitionToScoring(gameCode, gameId, roundId);
    }, 180000);
}

export async function submitVote(gameCode, userId, votedForPlayerId) {
    const gameResult = await pool.query("SELECT game_id, game_state, current_round FROM Games WHERE game_code = $1", [gameCode]);
    const game = gameResult.rows[0];

    if (game && game.game_state === 'VOTING') {
        const voterResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1 AND user_id = $2', [game.game_id, userId]);
        const voter = voterResult.rows[0];
        const votedForResult = await pool.query('SELECT player_id FROM Players WHERE game_id = $1 AND user_id = $2', [game.game_id, votedForPlayerId]);
        const votedFor = votedForResult.rows[0];
        const roundResult = await pool.query('SELECT round_id FROM Rounds WHERE game_id = $1 AND round_number = $2', [game.game_id, game.current_round]);
        const round = roundResult.rows[0];

        if (voter && votedFor && round) {
            // Use an existing submission or create a new one
            await pool.query(
                `INSERT INTO Submissions (round_id, player_id, voted_for_player_id) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (round_id, player_id) 
                 DO UPDATE SET voted_for_player_id = $3`,
                [round.round_id, voter.player_id, votedFor.player_id]
            );
            return { voter: userId, votedFor: votedForPlayerId };
        }
    }
    return null;
}

async function transitionToScoring(gameCode, gameId, roundId) {
    await pool.query("UPDATE Games SET game_state = 'SCORING' WHERE game_code = $1", [gameCode]);

    const submissionsResult = await pool.query('SELECT voted_for_player_id FROM Submissions WHERE round_id = $1 AND voted_for_player_id IS NOT NULL', [roundId]);
    const votes = {};
    submissionsResult.rows.forEach(r => {
        votes[r.voted_for_player_id] = (votes[r.voted_for_player_id] || 0) + 1;
    });

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

    if (mostVotedPlayerIds.length === 1 && mostVotedPlayerIds[0] == impostorPlayerId) {
        await pool.query('UPDATE Players SET score = score + 2 WHERE game_id = $1 AND player_id != $2', [gameId, impostorPlayerId]);
    } else if (mostVotedPlayerIds.length > 1 && mostVotedPlayerIds.includes(String(impostorPlayerId))) {
        await pool.query('UPDATE Players SET score = score + 1 WHERE player_id = $1', [impostorPlayerId]);
    } else {
        await pool.query('UPDATE Players SET score = score + 2 WHERE player_id = $1', [impostorPlayerId]);
        const correctVotersResult = await pool.query('SELECT player_id FROM Submissions WHERE round_id = $1 AND voted_for_player_id = $2', [roundId, impostorPlayerId]);
        const correctVoterIds = correctVotersResult.rows.map(r => r.player_id);
        if (correctVoterIds.length > 0) {
            await pool.query('UPDATE Players SET score = score + 1 WHERE player_id = ANY($1::int[])', [correctVoterIds]);
        }
    }

    const playersResult = await pool.query('SELECT user_id, score FROM Players WHERE game_id = $1', [gameId]);
    const scores = playersResult.rows.map(p => ({ player: p.user_id, score: p.score }));
    const impostorUserResult = await pool.query('SELECT user_id FROM Players WHERE player_id = $1', [impostorPlayerId]);
    const impostorUserId = impostorUserResult.rows[0].user_id;

    const emit = gameEmitters.get(gameCode);
    if (emit) emit('roundResult', { impostor: impostorUserId, scores });

    transitionToRoundEnd(gameCode, gameId);
}

async function transitionToRoundEnd(gameCode, gameId) {
    const gameResult = await pool.query('SELECT current_round, total_rounds FROM Games WHERE game_code = $1', [gameCode]);
    const game = gameResult.rows[0];

    if (game.current_round >= game.total_rounds) {
        await pool.query("UPDATE Games SET game_state = 'GAME_OVER' WHERE game_code = $1", [gameCode]);
        const finalScoresResult = await pool.query('SELECT user_id, score FROM Players WHERE game_id = $1 ORDER BY score DESC', [gameId]);
        const finalScores = finalScoresResult.rows.map(p => ({ player: p.user_id, score: p.score }));
        const emit = gameEmitters.get(gameCode);
        if (emit) emit('gameOver', { finalScores });
    } else {
        await pool.query("UPDATE Games SET game_state = 'ROUND_END' WHERE game_code = $1", [gameCode]);
        setTimeout(async () => {
            await pool.query("UPDATE Games SET game_state = 'QUESTION_INPUT' WHERE game_code = $1", [gameCode]);
            const emit = gameEmitters.get(gameCode);
            if (emit) emit('nextRoundReady');
        }, 5000);
    }
}
