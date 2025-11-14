// Friend routes - handles friend requests and friend management
import { Router } from 'express';
import { PrismaClient } from '@assignment/db'; // Use monorepo package
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /friend-request - Send a friend request
// Required: receiverId in request body
router.post('/friend-request', authMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.body; // ID of user to send request to
    const fromId = req.user!.id; // Current user's ID (from JWT token)
    
    // Validate input
    if (!receiverId) {
      return res.status(400).json({ error: 'receiverId is required' });
    }
    
    // Prevent self-friend requests
    if (fromId === receiverId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }
    
    // Check if receiver exists
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already friends (check both directions)
    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: fromId, friendId: receiverId },
          { userId: receiverId, friendId: fromId }
        ]
      }
    });
    
    if (existingFriend) {
      return res.status(400).json({ error: 'Already friends with this user' });
    }
    
    // Check if request already exists (pending or accepted)
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromId, toId: receiverId },
          { fromId: receiverId, toId: fromId } // Check reverse direction too
        ],
        status: { in: ['pending', 'accepted'] }
      }
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    
    // Create friend request - schema uses fromId/toId (not senderId/receiverId)
    const friendRequest = await prisma.friendRequest.create({
      data: { 
        fromId, // Current user
        toId: receiverId, // Receiver
        status: 'pending' // lowercase to match schema default
      },
      include: {
        from: { select: { id: true, name: true, email: true } },
        to: { select: { id: true, name: true, email: true } }
      }
    });
    
    res.status(201).json(friendRequest);
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /friend-request - Get pending friend requests for current user
router.get('/friend-request', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get all pending requests where current user is the receiver
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        toId: userId, // Requests sent TO current user
        status: 'pending'
      },
      include: {
        from: { // Include sender information
          select: { 
            id: true, 
            name: true, 
            email: true,
            avatarUrl: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /friend-request/respond - Accept or reject a friend request
// Required: requestId and status ('accepted' or 'rejected') in request body
router.post('/friend-request/respond', authMiddleware, async (req, res) => {
  try {
    const { requestId, status } = req.body;
    const userId = req.user!.id; // Current user's ID
    
    // Validate input
    if (!requestId || !status) {
      return res.status(400).json({ error: 'requestId and status are required' });
    }
    
    if (!['accepted', 'rejected'].includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'Status must be "accepted" or "rejected"' });
    }
    
    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });
    
    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    // Verify that current user is the receiver of this request
    if (friendRequest.toId !== userId) {
      return res.status(403).json({ error: 'Not authorized to respond to this request' });
    }
    
    // Don't allow responding to already processed requests
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Friend request already processed' });
    }
    
    const normalizedStatus = status.toLowerCase();
    
    // Update friend request status
    const updatedRequest = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: normalizedStatus },
      include: {
        from: { select: { id: true, name: true, email: true } },
        to: { select: { id: true, name: true, email: true } }
      }
    });
    
    // If accepted, create Friend records (bidirectional friendship)
    if (normalizedStatus === 'accepted') {
      // Create bidirectional friendship records
      await Promise.all([
        // Friend record: fromId -> toId
        prisma.friend.create({
          data: {
            userId: friendRequest.fromId, // User who sent request
            friendId: friendRequest.toId  // User who accepted
          }
        }),
        // Friend record: toId -> fromId (reverse direction)
        prisma.friend.create({
          data: {
            userId: friendRequest.toId,   // User who accepted
            friendId: friendRequest.fromId // User who sent request
          }
        })
      ]);
    }
    
    res.json(updatedRequest);
  } catch (error: any) {
    // Handle unique constraint violation (if friendship already exists)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Friendship already exists' });
    }
    console.error('Respond to friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /friends - Get all friends of current user
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get friends where current user is userId
    const friendsAsUser = await prisma.friend.findMany({
      where: { userId },
      include: {
        friend: { // Include friend's user details
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            createdAt: true
          }
        }
      }
    });
    
    // Get friends where current user is friendId (reverse direction)
    const friendsAsFriend = await prisma.friend.findMany({
      where: { friendId: userId },
      include: {
        user: { // Include friend's user details
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            createdAt: true
          }
        }
      }
    });
    
    // Combine both lists and extract user objects
    const allFriends = [
      ...friendsAsUser.map(f => ({ ...f.friend, friendSince: f.createdAt })),
      ...friendsAsFriend.map(f => ({ ...f.user, friendSince: f.createdAt }))
    ];
    
    // Remove duplicates (in case of data inconsistency)
    const uniqueFriends = Array.from(
      new Map(allFriends.map(f => [f.id, f])).values()
    );
    
    res.json(uniqueFriends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /search - Search for users by name or email
// Query params: q (search query), limit (optional, default 20)
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { q, limit = '20' } = req.query;
    
    // Validate search query
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    
    const searchQuery = q.trim();
    const limitNum = parseInt(limit as string, 10);
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Limit must be between 1 and 100' });
    }
    
    // Get current user's friends IDs (to exclude them)
    const friendsAsUser = await prisma.friend.findMany({
      where: { userId },
      select: { friendId: true }
    });
    
    const friendsAsFriend = await prisma.friend.findMany({
      where: { friendId: userId },
      select: { userId: true }
    });
    
    const friendIds = new Set([
      userId, // Exclude self
      ...friendsAsUser.map(f => f.friendId),
      ...friendsAsFriend.map(f => f.userId)
    ]);
    
    // Get pending/accepted friend request IDs (to show status)
    const sentRequests = await prisma.friendRequest.findMany({
      where: {
        fromId: userId,
        status: { in: ['pending', 'accepted'] }
      },
      select: { toId: true, status: true }
    });
    
    const receivedRequests = await prisma.friendRequest.findMany({
      where: {
        toId: userId,
        status: { in: ['pending', 'accepted'] }
      },
      select: { fromId: true, status: true }
    });
    
    const requestMap = new Map<string, string>();
    sentRequests.forEach(req => requestMap.set(req.toId, req.status));
    receivedRequests.forEach(req => requestMap.set(req.fromId, req.status));
    
    // Search users by name or email (case-insensitive)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } }
            ]
          },
          {
            id: { notIn: Array.from(friendIds) } // Exclude friends and self
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
        createdAt: true
      },
      take: limitNum,
      orderBy: {
        name: 'asc'
      }
    });
    
    // Add relationship status to each user
    const usersWithStatus = users.map(user => {
      const requestStatus = requestMap.get(user.id);
      return {
        ...user,
        relationshipStatus: requestStatus || 'none' // 'none', 'pending', 'accepted'
      };
    });
    
    res.json(usersWithStatus);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
