import { Router } from "express";
import { PrismaClient } from "@assignment/db";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

router.post("/friend-request", authMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const fromId = req.user!.id;

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required" });
    }

    if (fromId === receiverId) {
      return res
        .status(400)
        .json({ error: "Cannot send friend request to yourself" });
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
    });
    if (!receiver) {
      return res.status(404).json({ error: "User not found" });
    }

    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: fromId, friendId: receiverId },
          { userId: receiverId, friendId: fromId },
        ],
      },
    });

    if (existingFriend) {
      return res.status(400).json({ error: "Already friends with this user" });
    }

    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromId, toId: receiverId },
          { fromId: receiverId, toId: fromId },
        ],
        status: { in: ["pending", "accepted"] },
      },
    });

    if (existingRequest) {
      return res.status(400).json({ error: "Friend request already exists" });
    }

    const friendRequest = await prisma.friendRequest.create({
      data: {
        fromId,
        toId: receiverId,
        status: "pending",
      },
      include: {
        from: { select: { id: true, name: true, email: true } },
        to: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error("Friend request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/friend-request", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        toId: userId,
        status: "pending",
      },
      include: {
        from: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(pendingRequests);
  } catch (error) {
    console.error("Get friend requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/friend-request/respond", authMiddleware, async (req, res) => {
  try {
    const { requestId, status } = req.body;
    const userId = req.user!.id;

    if (!requestId || !status) {
      return res
        .status(400)
        .json({ error: "requestId and status are required" });
    }

    if (!["accepted", "rejected"].includes(status.toLowerCase())) {
      return res
        .status(400)
        .json({ error: 'Status must be "accepted" or "rejected"' });
    }

    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (friendRequest.toId !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to respond to this request" });
    }

    if (friendRequest.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Friend request already processed" });
    }

    const normalizedStatus = status.toLowerCase();

    const updatedRequest = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: normalizedStatus },
      include: {
        from: { select: { id: true, name: true, email: true } },
        to: { select: { id: true, name: true, email: true } },
      },
    });

    if (normalizedStatus === "accepted") {
      await Promise.all([
        prisma.friend.create({
          data: {
            userId: friendRequest.fromId,
            friendId: friendRequest.toId,
          },
        }),

        prisma.friend.create({
          data: {
            userId: friendRequest.toId,
            friendId: friendRequest.fromId,
          },
        }),
      ]);
    }

    res.json(updatedRequest);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Friendship already exists" });
    }
    console.error("Respond to friend request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/friends", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;

    const friendsAsUser = await prisma.friend.findMany({
      where: { userId },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const friendsAsFriend = await prisma.friend.findMany({
      where: { friendId: userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const allFriends = [
      ...friendsAsUser.map((f) => ({ ...f.friend, friendSince: f.createdAt })),
      ...friendsAsFriend.map((f) => ({ ...f.user, friendSince: f.createdAt })),
    ];

    const uniqueFriends = Array.from(
      new Map(allFriends.map((f) => [f.id, f])).values()
    );

    res.json(uniqueFriends);
  } catch (error) {
    console.error("Get friends error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { q, limit = "20" } = req.query;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query (q) is required" });
    }

    const searchQuery = q.trim();
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }

    const friendsAsUser = await prisma.friend.findMany({
      where: { userId },
      select: { friendId: true },
    });

    const friendsAsFriend = await prisma.friend.findMany({
      where: { friendId: userId },
      select: { userId: true },
    });

    const friendIds = new Set([
      userId,
      ...friendsAsUser.map((f) => f.friendId),
      ...friendsAsFriend.map((f) => f.userId),
    ]);

    const sentRequests = await prisma.friendRequest.findMany({
      where: {
        fromId: userId,
        status: { in: ["pending", "accepted"] },
      },
      select: { toId: true, status: true },
    });

    const receivedRequests = await prisma.friendRequest.findMany({
      where: {
        toId: userId,
        status: { in: ["pending", "accepted"] },
      },
      select: { fromId: true, status: true },
    });

    const requestMap = new Map<string, string>();
    sentRequests.forEach((req) => requestMap.set(req.toId, req.status));
    receivedRequests.forEach((req) => requestMap.set(req.fromId, req.status));

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: searchQuery, mode: "insensitive" } },
              { email: { contains: searchQuery, mode: "insensitive" } },
            ],
          },
          {
            id: { notIn: Array.from(friendIds) },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
      take: limitNum,
      orderBy: {
        name: "asc",
      },
    });

    const usersWithStatus = users.map((user) => {
      const requestStatus = requestMap.get(user.id);
      return {
        ...user,
        relationshipStatus: requestStatus || "none",
      };
    });

    res.json(usersWithStatus);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
