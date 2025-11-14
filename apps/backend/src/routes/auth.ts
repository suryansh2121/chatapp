// Authentication routes - handles user signup and login
import { Router } from 'express';
import { PrismaClient } from '@assignment/db'; // Use monorepo package
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// POST /auth/signup - Register a new user
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body; // Schema uses 'name' not 'username'
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    // Hash password before storing (bcrypt with 10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user in database
    const user = await prisma.user.create({
      data: { 
        email, 
        password: hashedPassword, 
        name // Use 'name' to match Prisma schema
      },
    });
    
    // Generate JWT token with user ID (expires in 7 days by default)
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    // Return token and user info (exclude password)
    res.status(201).json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error: any) {
    // Handle duplicate email error
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login - Authenticate existing user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Check if user exists and password matches
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    // Return token and user info
    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
