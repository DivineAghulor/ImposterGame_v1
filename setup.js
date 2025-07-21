
import pool from './src/utils/db.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Setting up database...');

const setupDatabase = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Games (
                game_id SERIAL PRIMARY KEY,
                game_code VARCHAR(8) UNIQUE NOT NULL,
                admin_id INTEGER REFERENCES Users(user_id),
                total_rounds INTEGER NOT NULL,
                current_round INTEGER DEFAULT 0,
                game_state VARCHAR(20) NOT NULL DEFAULT 'LOBBY',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Players (
                player_id SERIAL PRIMARY KEY,
                game_id INTEGER NOT NULL REFERENCES Games(game_id),
                user_id INTEGER NOT NULL REFERENCES Users(user_id),
                score INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                UNIQUE (game_id, user_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Rounds (
                round_id SERIAL PRIMARY KEY,
                game_id INTEGER NOT NULL REFERENCES Games(game_id),
                round_number INTEGER NOT NULL,
                original_question TEXT NOT NULL,
                impostor_question TEXT NOT NULL,
                impostor_player_id INTEGER REFERENCES Players(player_id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS Submissions (
                submission_id SERIAL PRIMARY KEY,
                round_id INTEGER NOT NULL REFERENCES Rounds(round_id),
                player_id INTEGER NOT NULL REFERENCES Players(player_id),
                answer_text TEXT,
                voted_for_player_id INTEGER REFERENCES Players(player_id)
            );
        `);

        console.log('Database tables created successfully.');
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await pool.end();
    }
};

setupDatabase();
