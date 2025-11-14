"use client";
import { useRouter } from "next/navigation"; 
import { useEffect, useState, useRef } from "react";

interface Friend {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status?: string;
  friendSince?: string;
}

interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  status: string;
  createdAt: string;
  from: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface SearchedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status?: string;
  relationshipStatus: 'none' | 'pending' | 'accepted';
}

interface Message {
  id: string;
  fromId: string;
  toId: string;
  content: string | null;
  createdAt: string;
  seen: boolean;
  from: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  to: {
    id: string;
    name: string;
    email: string;
  };
}

export default function Dashboard() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [notifications, setNotifications] = useState<string[]>([]); 
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isTyping, setIsTyping] = useState<{ [friendId: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";

  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem("token");

  
    if (!token) {
      router.push("/");
      return;
    }

 
    const fetchFriends = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/friend/friends`, {
          headers: {
            Authorization: `Bearer ${token}`, 
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          setFriends(data);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
      }
    };

  
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/friend/friend-request`, {
          headers: {
            Authorization: `Bearer ${token}`, 
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      } catch (error) {
        console.error("Error fetching friend requests:", error);
      }
    };

    fetchFriends();
    fetchRequests();

    
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log("WebSocket connected");
  
      websocket.send(
        JSON.stringify({
          type: "auth",
          token: token,
        })
      );
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      
      if (data.type === "connected") {
        console.log("WebSocket authenticated:", data.userId);
      } else if (data.type === "message") {
       
        const message = data.message;

        
        if (
          selectedFriend &&
          (message.fromId === selectedFriend.id ||
            message.toId === selectedFriend.id)
        ) {
          setMessages((prev) => [...prev, message]);
        }

        if (
          !selectedFriend ||
          (message.fromId !== selectedFriend.id &&
            message.toId !== selectedFriend.id)
        ) {
          setNotifications((prev) => [
            ...prev,
            `New message from ${message.from.name}`,
          ]);
        }
      } else if (data.type === "notification") {
        
        setNotifications((prev) => [
          ...prev,
          data.notification.message || "New notification",
        ]);
        
        fetchFriends();
        fetchRequests();
      } else if (data.type === "typing") {
        
        setIsTyping((prev) => ({
          ...prev,
          [data.fromId]: data.isTyping,
        }));
      } else if (data.type === "error") {
        console.error("WebSocket error:", data.message);
        setNotifications((prev) => [...prev, `Error: ${data.message}`]);
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    setWs(websocket);

  
    return () => {
      websocket.close();
    };
  }, [router, BACKEND_URL, WS_URL]); 

  
  useEffect(() => {
    if (!selectedFriend) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/messages/${selectedFriend.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`, 
              "Content-Type": "application/json",
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();
  }, [selectedFriend, BACKEND_URL]);

  // Send message via WebSocket
  const handleSendMessage = () => {
    if (
      !newMessage.trim() ||
      !selectedFriend ||
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    // Send message via WebSocket
    ws.send(
      JSON.stringify({
        type: "message",
        content: newMessage.trim(),
        toId: selectedFriend.id, 
      })
    );

    // Clear input
    setNewMessage("");

    
    setIsTyping((prev) => ({
      ...prev,
      [selectedFriend.id]: false,
    }));
  };

  // Handle typing indicator
  const handleTyping = (isTyping: boolean) => {
    if (!selectedFriend || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(
      JSON.stringify({
        type: "typing",
        toId: selectedFriend.id,
        isTyping,
      })
    );
  };

  
  const handleFriendRequest = async (
    requestId: string,
    status: "accepted" | "rejected"
  ) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/friend/friend-request/respond`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId, status }),
      });

      if (res.ok) {
  
        setRequests((prev) => prev.filter((req) => req.id !== requestId));

    
        const friendsRes = await fetch(`${BACKEND_URL}/friend/friends`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          setFriends(friendsData);
        }
      }
    } catch (error) {
      console.error("Error responding to friend request:", error);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(
        `${BACKEND_URL}/friend/search?q=${encodeURIComponent(query)}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  /
  const handleSendFriendRequestFromSearch = async (userId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/friend/friend-request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiverId: userId }),
      });

      if (res.ok) {
      
        setSearchResults((prev) =>
          prev.map((user) =>
            user.id === userId
              ? { ...user, relationshipStatus: "pending" }
              : user
          )
        );
        setNotifications((prev) => [
          ...prev,
          "Friend request sent successfully!",
        ]);
      } else {
        const errorData = await res.json();
        setNotifications((prev) => [
          ...prev,
          `Error: ${errorData.error || "Failed to send friend request"}`,
        ]);
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      setNotifications((prev) => [
        ...prev,
        "Error: Failed to send friend request",
      ]);
    }
  };


  const removeNotification = (index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchResults]);

  return (
    <div className="flex h-screen bg-gray-100">
      
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-green-600 text-white">
          <h1 className="text-xl font-bold">Chat App</h1>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              onFocus={() => {
                if (searchQuery.trim()) {
                  setShowSearchResults(true);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              </div>
            )}
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">
                  Search Results
                </div>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleSendFriendRequestFromSearch(user.id)}
                      disabled={user.relationshipStatus !== "none"}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        user.relationshipStatus === "none"
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : user.relationshipStatus === "pending"
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-blue-300 text-blue-700 cursor-not-allowed"
                      }`}
                    >
                      {user.relationshipStatus === "none"
                        ? "Add Friend"
                        : user.relationshipStatus === "pending"
                        ? "Pending"
                        : "Friends"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showSearchResults && searchQuery.trim() && searchResults.length === 0 && !isSearching && (
            <div className="absolute z-50 left-4 right-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
              <p className="text-gray-500 text-center">No users found</p>
            </div>
          )}
        </div>

        {/* Friend Requests Section */}
        {requests.length > 0 && (
          <div className="p-4 bg-yellow-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Friend Requests</h2>
            {requests.map((request) => (
              <div
                key={request.id}
                className="mb-2 p-2 bg-white rounded border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{request.from.name}</p>
                    <p className="text-sm text-gray-500">
                      {request.from.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleFriendRequest(request.id, "accepted")
                      }
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        handleFriendRequest(request.id, "rejected")
                      }
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          <h2 className="text-lg font-semibold p-4 bg-gray-50 border-b">
            Friends
          </h2>
          {friends.length === 0 ? (
            <p className="p-4 text-gray-500 text-center">No friends yet</p>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedFriend?.id === friend.id ? "bg-blue-50" : ""
                }`}
              >
                <p className="font-medium">{friend.name}</p>
                <p className="text-sm text-gray-500">{friend.email}</p>
              </div>
            ))
          )}
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              router.push("/");
            }}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Right Side - Chat Interface */}
      <div className="flex-1 flex flex-col">
        {selectedFriend ? (
          <>
            {/* Chat Header */}
            <div className="bg-white p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">{selectedFriend.name}</h2>
              {isTyping[selectedFriend.id] && (
                <p className="text-sm text-gray-500 italic">typing...</p>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwnMessage =
                  message.fromId === localStorage.getItem("user")
                    ? JSON.parse(localStorage.getItem("user") || "{}").id ===
                      message.fromId
                    : false;

                // Try to get current user ID from stored user or token
                const currentUser = JSON.parse(
                  localStorage.getItem("user") || "{}"
                );
                const isFromMe = message.fromId === currentUser.id;

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isFromMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isFromMe
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      <p>{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isFromMe ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping(true);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSendMessage();
                    }
                  }}
                  onBlur={() => handleTyping(false)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-semibold"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-2xl mb-2">👋</p>
              <p className="text-xl">Select a friend to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Notifications Toast */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {notifications.map((notification, index) => (
            <div
              key={index}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between gap-4 animate-slide-in"
            >
              <span>{notification}</span>
              <button
                onClick={() => removeNotification(index)}
                className="text-white hover:text-gray-200 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
