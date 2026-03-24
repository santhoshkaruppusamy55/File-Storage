const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./config/database');
const redisClient = require('./config/redis');

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session with Redis Store (To be configured if needed, or we use custom token-based session stored in Redis)
// For session-based auth stored in Redis, we will use a custom middleware that handles session tokens.

app.get('/health', async (req, res) => {
  try {
    const [dbResult] = await pool.query('SELECT 1 as result');
    await redisClient.ping();
    res.status(200).json({
      status: 'ok',
      db: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      db: error.code === 'ECONNREFUSED' || error.fatal ? 'disconnected' : 'unknown',
      redis: error.message.includes('Redis') ? 'disconnected' : 'unknown'
    });
  }
});


// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const folderRoutes = require('./routes/folders');

app.use('/auth', authRoutes);
app.use('/files', fileRoutes);
app.use('/folders', folderRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
