import { Router } from "express";
import { PrismaClient } from "@assignment/db";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

router.get("/:friendId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { friendId } = req.params;

    if (!friendId) {
      return res.status(400).json({ error: "friendId is required" });
    }

    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({ error: "Not friends with this user" });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromId: userId, toId: friendId },
          { fromId: friendId, toId: userId },
        ],
      },
      include: {
        from: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        to: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
