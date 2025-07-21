
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../utils/db.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';

export const signup = async (req, res) => {
    const { username, password } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO Users (username, password_hash) VALUES ($1, $2) RETURNING user_id, username',
            [username, passwordHash]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error });
    }
};

export const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM Users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (user && await bcrypt.compare(password, user.password_hash)) {
            const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
            res.status(200).json({ token });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
    }
};
