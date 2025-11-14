// WebSocket server - handles real-time messaging and notifications
// Uses Redis Pub/Sub for broadcasting messages between server instances
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { PrismaClient } from '@assignment/db'; // Use monorepo package
import jwt from 'jsonwebtoken';

const wss = new WebSocketServer({ port: 3002 });
const prisma = new PrismaClient();

// Redis clients for Pub/Sub pattern
// redisPub: publishes messages to channels
// redisSub: subscribes to channels and receives messages
const redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Map to store active WebSocket connections: userId -> WebSocket
// Uses string (UUID) not number since Prisma IDs are UUIDs
const clients = new Map<string, WebSocket>();

// Subscribe to Redis channels for real-time events
redisSub.subscribe('chat', 'notifications');

// Handle new WebSocket connection
wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection');
  
  // Handle incoming messages from client
  ws.on('message', async (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Authentication - client sends JWT token to authenticate
      if (data.type === 'auth') {
        const token = data.token; // JWT token from client
        
        if (!token) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'No token provided' 
          }));
          return;
        }
        
        try {
          // Verify JWT token and extract user ID
          const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'fallback-secret'
          ) as { userId: string };
          
          const userId = decoded.userId;
          
          // Store connection with user ID
          clients.set(userId, ws);
          
          // Send confirmation to client
          ws.send(JSON.stringify({ 
            type: 'connected', 
            userId,
            message: 'Authenticated successfully' 
          }));
          
          console.log(`User ${userId} connected`);
        } catch (error) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Invalid or expired token' 
          }));
          ws.close();
        }
      } 
      // Send message - client sends a message to another user
      else if (data.type === 'message') {
        const { content, toId } = data; // Schema uses toId (not receiverId)
        
        // Find sender's user ID from clients map
        const fromId = Array.from(clients.entries())
          .find(([_, client]) => client === ws)?.[0];
        
        if (!fromId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Not authenticated' 
          }));
          return;
        }
        
        if (!toId || !content) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'toId and content are required' 
          }));
          return;
        }
        
        // Verify friendship exists before allowing message
        const friendship = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId: fromId, friendId: toId },
              { userId: toId, friendId: fromId }
            ]
          }
        });
        
        if (!friendship) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Not friends with this user' 
          }));
          return;
        }
        
        // Save message to database - schema uses fromId/toId
        const messageRecord = await prisma.message.create({
          data: { 
            fromId,      // Current user (sender)
            toId,        // Friend (receiver)
            content,
            seen: false  // Not seen yet
          },
          include: {
            from: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            to: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            }
          }
        });
        
        // Send message to receiver if online
        if (clients.has(toId)) {
          const receiverWs = clients.get(toId);
          receiverWs?.send(JSON.stringify({ 
            type: 'message', 
            message: messageRecord 
          }));
        }
        
        // Publish to Redis for other server instances (if scaling horizontally)
        redisPub.publish('chat', JSON.stringify({ 
          type: 'message', 
          message: messageRecord 
        }));
        
        // Confirm message sent to sender
        ws.send(JSON.stringify({ 
          type: 'message_sent', 
          message: messageRecord 
        }));
      } 
      // Typing indicator - notify when user is typing
      else if (data.type === 'typing') {
        const { toId, isTyping } = data;
        
        // Find sender's user ID
        const fromId = Array.from(clients.entries())
          .find(([_, client]) => client === ws)?.[0];
        
        if (!fromId) {
          return;
        }
        
        // Send typing indicator to receiver if online
        if (toId && clients.has(toId)) {
          const receiverWs = clients.get(toId);
          receiverWs?.send(JSON.stringify({ 
            type: 'typing', 
            fromId,
            isTyping 
          }));
        }
      }
      // Mark message as seen
      else if (data.type === 'mark_seen') {
        const { messageId } = data;
        const userId = Array.from(clients.entries())
          .find(([_, client]) => client === ws)?.[0];
        
        if (!userId || !messageId) {
          return;
        }
        
        // Update message as seen in database
        await prisma.message.updateMany({
          where: {
            id: messageId,
            toId: userId // Only mark as seen if user is the receiver
          },
          data: { seen: true }
        });
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    // Remove user from clients map
    const userId = Array.from(clients.entries())
      .find(([_, client]) => client === ws)?.[0];
    
    if (userId) {
      clients.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  });
  
  // Handle connection errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle Redis messages (from other server instances or notifications)
redisSub.on('message', (channel: string, message: string) => {
  try {
    const data = JSON.parse(message);
    
    // Handle notifications channel (e.g., friend request accepted)
    if (channel === 'notifications') {
      const { userId, notification } = data;
      
      // Send notification to specific user if online
      if (userId && clients.has(userId)) {
        const clientWs = clients.get(userId);
        clientWs?.send(JSON.stringify({
          type: 'notification',
          notification
        }));
      }
    }
    
    // Handle chat channel (messages from other server instances)
    // This is mainly for horizontal scaling - not needed for single instance
    if (channel === 'chat') {
      const { type, message: messageData } = data;
      
      if (type === 'message' && messageData) {
        const { toId } = messageData;
        
        // Send to receiver if online on this server instance
        if (toId && clients.has(toId)) {
          const receiverWs = clients.get(toId);
          receiverWs?.send(JSON.stringify({
            type: 'message',
            message: messageData
          }));
        }
      }
    }
  } catch (error) {
    console.error('Redis message handling error:', error);
  }
});

console.log('WebSocket server running on ws://localhost:3002');
