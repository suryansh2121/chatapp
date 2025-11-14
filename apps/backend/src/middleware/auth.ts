// Authentication middleware - verifies JWT token and attaches user to request
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Extract JWT token from Authorization header (format: "Bearer <token>")
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  try {
    // Verify JWT token using secret from environment variables
    // userId is a string (UUID) not a number
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };
    
    // Attach user info to request object for use in route handlers
    req.user = { 
      id: decoded.userId,
      userId: decoded.userId // Both id and userId for compatibility
    };
    
    next(); // Continue to next middleware/route handler
  } catch (error) {
    // Token verification failed (expired, invalid, etc.)
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};