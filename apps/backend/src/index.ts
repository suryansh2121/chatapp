import express from 'express';
import cors from 'cors'; 
import authRoutes from './routes/auth';
import friendRoutes from './routes/friend';
import messageRoutes from './routes/message';

const app = express();


app.use(cors()); 
app.use(express.json());

// Routes
app.use('/auth', authRoutes); 
app.use('/friend', friendRoutes); 
app.use('/messages', messageRoutes); 

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
