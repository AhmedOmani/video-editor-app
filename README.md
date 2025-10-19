# Video Editor Application

An educational project designed to explore advanced Node.js concepts, system programming, and video processing. This project demonstrates real-world implementation of clustering, job queues, and efficient stream processing.

## Educational Objectives

This project serves as a comprehensive learning experience covering:

- **Unix Process Management**: Understanding how to spawn and manage child processes effectively
- **Stream Processing**: Implementing efficient data transfer using Node.js streams for large file operations
- **Cluster Architecture**: Learning how to scale applications using Node.js cluster module
- **Job Queue Design Patterns**: Implementing centralized job processing systems
- **Database Integration**: Working with PostgreSQL and JSONB for complex data structures
- **Video Processing**: Integrating FFmpeg for real-world media processing tasks
- **Custom Framework Development**: Building a lightweight web framework from scratch

## Features

### Video Processing
- Upload and store video files with metadata extraction
- Resize videos to custom dimensions
- Convert videos between different formats (MP4, MOV, WebM)
- Extract audio tracks from video files
- Generate video thumbnails

### User Management
- User registration and authentication
- JWT-based session management
- Protected routes and middleware

### Job Processing System
- Centralized database-based job queue
- Worker clustering for optimal resource utilization
- Job recovery and error handling
- Real-time job status tracking

### Storage Management
- Efficient file storage and retrieval
- Automatic cleanup of failed operations
- Metadata management for all uploaded content

## Technical Architecture

### Custom Framework
The application uses a custom-built web framework that provides:
- RESTful routing
- Middleware support
- Request/response handling
- Static file serving

### Database Design
- PostgreSQL with JSONB for flexible data storage
- Optimized queries for job processing
- Proper indexing for performance

### Process Management
- Cluster-based worker distribution
- Centralized job processing to prevent resource conflicts
- Proper error handling and recovery mechanisms

## Installation

### Using Docker (Recommended)

1. Clone the repository
2. Run the application with Docker Compose:
```bash
cd video-editor-app
docker-compose up -d
```

The application will be available at `http://localhost:3000`

### Default Test Credentials

A default admin user is automatically created for testing purposes:
- **Username**: `admin`
- **Password**: `123`

You can use these credentials to log in and test the application immediately after running Docker Compose.

### Manual Installation

1. Install PostgreSQL and FFmpeg
2. Install Node.js dependencies:
```bash
npm install
```
3. Set up environment variables
4. Start the application:

For single process:
```bash
npm start
# or
npm run dev
```

For cluster mode:
```bash
npm run cluster
```

## Configuration

The application uses environment variables for configuration. Key settings include:

- Database connection parameters
- JWT secret and expiration
- Application port
- Storage paths
- FFmpeg binary paths

## API Endpoints

### Authentication
- POST /api/login
- POST /api/logout
- GET /api/user

### Video Management
- POST /api/upload-video
- GET /api/videos
- PUT /api/video/resize
- PUT /api/video/change-format
- PATCH /api/video/extract-audio
- GET /get-video-asset

## Learning Outcomes

This project demonstrates:
- Advanced Node.js programming patterns
- System-level programming concepts
- Database design and optimization
- Process management and clustering
- Error handling and recovery strategies
- Performance optimization techniques

