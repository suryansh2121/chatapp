
import { Router } from 'express';
import { PrismaClient } from '@assignment/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /messages/:friendId - Get messages with a specific friend
// Required by assignment specification
router.get('/:friendId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { friendId } = req.params;
    
    // Validate input
    if (!friendId) {
      return res.status(400).json({ error: 'friendId is required' });
    }
    
    // Verify friendship exists (check both directions)
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId },     // Current user -> friend
          { userId: friendId, friendId: userId } // Friend -> current user
        ]
      }
    });
    
    if (!friendship) {
      return res.status(403).json({ error: 'Not friends with this user' });
    }
    
    // Get all messages between current user and friend (both directions)
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromId: userId, toId: friendId }, // Messages sent by current user
          { fromId: friendId, toId: userId }  // Messages received from friend
        ]
      },
      include: {
        from: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        },
        to: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Oldest first, can change to 'desc' for newest first
      }
    });
    
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

