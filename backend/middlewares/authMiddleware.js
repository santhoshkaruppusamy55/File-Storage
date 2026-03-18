const redisClient = require('../config/redis');

const authenticate = async (req, res, next) => {
  const sessionId = req.headers.authorization?.split(' ')[1]; // Expecting "Bearer <session_id>"
  
  if (!sessionId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const sessionData = await redisClient.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    req.user = JSON.parse(sessionData); // { id, email }
    req.sessionId = sessionId;
    next();
  } catch (error) {
    console.error('Session Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { authenticate };
