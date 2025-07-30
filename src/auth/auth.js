
import 'dotenv/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../utils/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';

export const signup = async (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Signup attempt for username: ${username}`);
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO Users (username, password_hash) VALUES ($1, $2) RETURNING user_id, username',
            [username, passwordHash]
        );
        console.log(`[AUTH] User ${username} created successfully with ID: ${newUser.rows[0].user_id}`);
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error(`[AUTH] Error during signup for ${username}:`, error);
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

export const login = async (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Login attempt for username: ${username}`);
    try {
        const userResult = await pool.query('SELECT * FROM Users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (user && await bcrypt.compare(password, user.password_hash)) {
            const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
            console.log(`[AUTH] User ${username} (ID: ${user.user_id}) logged in successfully.`);
            res.status(200).json({ token, userId: user.user_id, username: user.username });
        } else {
            console.warn(`[AUTH] Failed login attempt for username: ${username}`);
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(`[AUTH] Error during login for ${username}:`, error);
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};
