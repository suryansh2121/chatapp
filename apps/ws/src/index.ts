import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import { PrismaClient } from "@assignment/db";
import jwt from "jsonwebtoken";

const wss = new WebSocketServer({ port: 3002 });
const prisma = new PrismaClient();

const redisPub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const redisSub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const clients = new Map<string, WebSocket>();

redisSub.subscribe("chat", "notifications");

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection");

  ws.on("message", async (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "auth") {
        const token = data.token;

        if (!token) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "No token provided",
            })
          );
          return;
        }

        try {
          // Verify JWT token and extract user ID
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "fallback-secret"
          ) as { userId: string };

          const userId = decoded.userId;

          // Store connection with user ID
          clients.set(userId, ws);

          // Send confirmation to client
          ws.send(
            JSON.stringify({
              type: "connected",
              userId,
              message: "Authenticated successfully",
            })
          );

          console.log(`User ${userId} connected`);
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Invalid or expired token",
            })
          );
          ws.close();
        }
      }
      // Send message - client sends a message to another user
      else if (data.type === "message") {
        const { content, toId } = data;
        const fromId = Array.from(clients.entries()).find(
          ([_, client]) => client === ws
        )?.[0];

        if (!fromId) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Not authenticated",
            })
          );
          return;
        }

        if (!toId || !content) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "toId and content are required",
            })
          );
          return;
        }

        // Verify friendship exists before allowing message
        const friendship = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId: fromId, friendId: toId },
              { userId: toId, friendId: fromId },
            ],
          },
        });

        if (!friendship) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Not friends with this user",
            })
          );
          return;
        }

        // Save message to database - schema uses fromId/toId
        const messageRecord = await prisma.message.create({
          data: {
            fromId,
            toId,
            content,
            seen: false,
          },
          include: {
            from: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            to: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        });

        if (clients.has(toId)) {
          const receiverWs = clients.get(toId);
          receiverWs?.send(
            JSON.stringify({
              type: "message",
              message: messageRecord,
            })
          );
        }

        redisPub.publish(
          "chat",
          JSON.stringify({
            type: "message",
            message: messageRecord,
          })
        );

        ws.send(
          JSON.stringify({
            type: "message_sent",
            message: messageRecord,
          })
        );
      } else if (data.type === "typing") {
        const { toId, isTyping } = data;

        const fromId = Array.from(clients.entries()).find(
          ([_, client]) => client === ws
        )?.[0];

        if (!fromId) {
          return;
        }

        if (toId && clients.has(toId)) {
          const receiverWs = clients.get(toId);
          receiverWs?.send(
            JSON.stringify({
              type: "typing",
              fromId,
              isTyping,
            })
          );
        }
      } else if (data.type === "mark_seen") {
        const { messageId } = data;
        const userId = Array.from(clients.entries()).find(
          ([_, client]) => client === ws
        )?.[0];

        if (!userId || !messageId) {
          return;
        }

        // Update message as seen in database
        await prisma.message.updateMany({
          where: {
            id: messageId,
            toId: userId,
          },
          data: { seen: true },
        });
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  });

  // Handle connection close
  ws.on("close", () => {
    const userId = Array.from(clients.entries()).find(
      ([_, client]) => client === ws
    )?.[0];

    if (userId) {
      clients.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  });

  // Handle connection errors
  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

redisSub.on("message", (channel: string, message: string) => {
  try {
    const data = JSON.parse(message);

    if (channel === "notifications") {
      const { userId, notification } = data;

      if (userId && clients.has(userId)) {
        const clientWs = clients.get(userId);
        clientWs?.send(
          JSON.stringify({
            type: "notification",
            notification,
          })
        );
      }
    }

    if (channel === "chat") {
      const { type, message: messageData } = data;

      if (type === "message" && messageData) {
        const { toId } = messageData;

        if (toId && clients.has(toId)) {
          const receiverWs = clients.get(toId);
          receiverWs?.send(
            JSON.stringify({
              type: "message",
              message: messageData,
            })
          );
        }
      }
    }
  } catch (error) {
    console.error("Redis message handling error:", error);
  }
});

console.log("WebSocket server running on ws://localhost:3002");
