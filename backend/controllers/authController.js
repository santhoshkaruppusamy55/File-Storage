const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const redisClient = require('../config/redis');

const signup = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ message: 'User already exists' });

    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [id, email, hash]);
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const sessionId = uuidv4();
    const sessionData = { id: user.id, email: user.email };
    
    // Set session in Redis to expire in 24 hours (86400 seconds)
    await redisClient.setex(`session:${sessionId}`, 86400, JSON.stringify(sessionData));
    
    res.status(200).json({ message: 'Logged in', sessionId, user: sessionData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login error' });
  }
};

const logout = async (req, res) => {
  const sessionId = req.headers.authorization?.split(' ')[1];
  if (sessionId) {
    await redisClient.del(`session:${sessionId}`);
  }
  res.status(200).json({ message: 'Logged out' });
};

const getStats = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT SUM(file_size) as total_used FROM files WHERE user_id = ?', [req.user.id]);
    const totalUsed = rows[0].total_used || 0;
    const maxStorage = 10 * 1024 * 1024 * 1024; // 10GB in bytes
    
    res.status(200).json({
      totalUsed,
      maxStorage,
      percentage: Math.min((totalUsed / maxStorage) * 100, 100).toFixed(2)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

module.exports = { signup, login, logout, getStats };
