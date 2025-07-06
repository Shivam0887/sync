# Chat App Monorepo

A modern real-time chat application built with a microservices architecture and React frontend.

## 🏗️ Project Structure

```
chat-app/
├── backend/                 # Backend services
│   ├── services/
│   │   ├── api-gateway-service/  # API Gateway
│   │   └── user-service/         # User management service
│   ├── shared/                   # Shared utilities and types
│   └── packages/                 # Additional packages
└── frontend/                # React frontend application
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- Redis (for caching and sessions)
- Database (PostgreSQL/MySQL)

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables for each service:

   ```bash
   # Copy example env files
   cp services/api-gateway-service/src/config/env.example services/api-gateway-service/src/config/.env
   cp services/user-service/src/config/env.example services/user-service/src/config/.env
   ```

4. Start the services:

   ```bash
   # Start all services
   pnpm dev

   # Or start individual services
   pnpm --filter api-gateway-service dev
   pnpm --filter user-service dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

## 🛠️ Development

### Backend Services

- **API Gateway Service**: Handles routing, authentication, and request/response transformation
- **User Service**: Manages user authentication, profiles, and user-related operations
- **Shared Package**: Contains common utilities, error handlers, and types

### Frontend

- **React + TypeScript**: Modern frontend with type safety
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Beautiful and accessible UI components

## 📦 Package Management

This project uses pnpm workspaces for efficient package management:

- **Root workspace**: Manages the entire monorepo
- **Service-level workspaces**: Each service has its own package.json
- **Shared dependencies**: Common dependencies are hoisted to the root

## 🔧 Scripts

### Backend Scripts

```bash
# Install all dependencies
pnpm install

# Start all services in development mode
pnpm dev

# Build all services
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Frontend Scripts

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run tests
pnpm test

# Lint code
pnpm lint
```

## 🌐 API Documentation

### API Gateway Service

- **Port**: 3000
- **Health Check**: `GET /health`

### User Service

- **Port**: 3001
- **Health Check**: `GET /health`

## 🐳 Docker Support

Docker configurations are available for easy deployment:

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
