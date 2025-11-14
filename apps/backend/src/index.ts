import express from 'express';
import cors from 'cors'; // Enable CORS for frontend requests
import authRoutes from './routes/auth';
import friendRoutes from './routes/friend';
import messageRoutes from './routes/message';

const app = express();

// Middleware
app.use(cors()); // Enable CORS - allow requests from frontend
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/auth', authRoutes); // Authentication routes (signup, login)
app.use('/friend', friendRoutes); // Friend routes (friend-request, friends)
app.use('/messages', messageRoutes); // Message routes (GET /messages/:friendId)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is running' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
