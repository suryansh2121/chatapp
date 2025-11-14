

A full-stack real-time chat application similar to WhatsApp, built with a monorepo architecture. Users can register, send friend requests, accept/reject them, and chat in real-time with accepted friends.


This project follows a **monorepo architecture** using **Turborepo** and includes:

- **`apps/frontend`** - Next.js App Router application (React + TypeScript + Tailwind CSS)
- **`apps/backend`** - Express.js REST API server (Node.js + TypeScript)
- **`apps/ws`** - WebSocket server for real-time messaging (Node.js + TypeScript + Redis Pub/Sub)
- **`packages/db`** - Shared Prisma database package (PostgreSQL)

## 📁 Folder Structure

assignment/
├── apps/
│   ├── frontend/          # Next.js frontend application
│   │   ├── app/           # App Router pages
│   │   │   ├── page.tsx   # Login/Signup page
│   │   │   └── dashboard/ # Dashboard page
│   │   └── ...
│   ├── backend/           # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/    # API route handlers
│   │   │   ├── middleware/# Auth middleware
│   │   │   └── index.ts   # Server entry point
│   │   └── ...
│   └── ws/                # WebSocket server
│       ├── src/
│       │   └── index.ts   # WebSocket server entry point
│       └── ...
├── packages/
│   └── db/                # Shared Prisma package
│       ├── prisma/
│       │   └── schema.prisma  # Database schema
│       └── index.ts       # Prisma Client exports
├── package.json           # Root workspace configuration
├── turbo.json             # Turborepo configuration
└── README.md              # This file
```


### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 (or yarn/pnpm)
- **PostgreSQL** (latest version)
- **Redis** (latest version)
- **Turborepo** (installed via npm)

### Installation

1. **Clone the repository**
   git clone <repository-url>
   cd assignment
   ```

2. **Install dependencies**
   npm install
  

3. **Set up environment variables**

   # Copy .env.example to .env in root
   cp .env.example .env
   
   # Edit .env with your actual values:


4. **Set up the database**
   # Generate Prisma Client
   npm run db:generate
   
   # Push schema to database (development)
   npm run db:push
  

5. **Start Redis in linux terminal**
sudo service redis-server restart
 

##  Running the Application


Run all apps in development mode simultaneously:
npm run dev

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- WebSocket Server: ws://localhost:3002

### Run Individual Apps

**Backend API:**

npm run backend:dev
# or
cd apps/backend
npm run dev


**WebSocket Server:**

npm run ws:dev
# or
cd apps/ws
npm run dev


**Frontend:**

npm run frontend:dev
# or
cd apps/frontend
npm run dev

##  Dummy User
login user1.email:rajputsuryansh491@gmail.com
password: 123456

user2:"email": john.doe@example.com,
  "password": SecurePassword123!

### Authentication (`/auth`)
- `POST /auth/signup` - Register a new user
  - Body: `{ email, password, name }`
  - Returns: `{ token, user }`
  
- `POST /auth/login` - Authenticate user
  - Body: `{ email, password }`
  - Returns: `{ token, user }`

### Friends (`/friend`)
- `POST /friend/friend-request` - Send friend request
  - Body: `{ receiverId }`
  - Requires: Authentication
  
- `GET /friend/friend-request` - Get pending friend requests
  - Returns: Array of friend requests
  - Requires: Authentication
  
- `POST /friend/friend-request/respond` - Accept/reject friend request
  - Body: `{ requestId, status: 'accepted' | 'rejected' }`
  - Requires: Authentication
  
- `GET /friend/friends` - Get all friends
  - Returns: Array of friends
  - Requires: Authentication

### Messages (`/messages`)
- `GET /messages/:friendId` - Get messages with a friend
  - Returns: Array of messages
  - Requires: Authentication


### ✅ Core Features (Implemented)
- ✅ User signup and login with JWT authentication
- ✅ Send friend requests
- ✅ Accept/reject friend requests
- ✅ Real-time messaging via WebSocket
- ✅ Friend request notifications (toast notifications)
- ✅ Dashboard with friend list and chat interface
- ✅ Redis Pub/Sub for message broadcasting

### 🎁 Bonus Features
- ✅ Typing indicators
- ✅ Message seen status
- ✅ Online user tracking via WebSocket connections
- ✅ Real-time notifications



