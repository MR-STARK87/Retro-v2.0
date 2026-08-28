<p align="center">
  <img src="public/assets/images/logo.png" alt="Retro Logo" width="120" height="120">
</p>

<h1 align="center">Retro</h1>

<p align="center">
  <strong>AI-Powered Smart Study Assistant</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#installation">Installation</a> •
  <a href="#api-reference">API</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node Version">
  <img src="https://img.shields.io/badge/license-ISC-blue" alt="License">
  <img src="https://img.shields.io/badge/express-5.x-lightgrey" alt="Express Version">
  <img src="https://img.shields.io/badge/mongodb-8.x-green" alt="MongoDB">
  <img src="https://img.shields.io/badge/AI-Groq%20LLM-purple" alt="AI Powered">
</p>

---

## 🎯 Overview

**Retro** is an intelligent study companion that combines the power of AI with intuitive note-taking, flashcard generation, and ambient study features. Designed to enhance your learning experience, Retro helps you organize knowledge, understand complex concepts, and retain information effectively.

Whether you're a student preparing for exams, a professional learning new skills, or a lifelong learner exploring new topics, Retro adapts to your learning style and remembers your preferences across sessions.

---

## ✨ Features

### 📝 Smart Notes Management
- **Rich Text Editor** - Create notes with full formatting support (Quill Delta)
- **Organize with Tags & Categories** - Keep your knowledge structured
- **Pin, Favorite & Archive** - Quick access to important notes
- **Color Coding** - Visual organization at a glance
- **Full-Text Search** - Find anything instantly
- **AI Enhancement** - Improve your notes while preserving your voice

### 🤖 AI Chat Assistant (Retro)
- **Context-Aware Conversations** - Retro remembers your preferences and learning goals
- **Chat with Notes** - Ask questions about specific notes as reference
- **Study Help** - Get explanations, summaries, and clarifications
- **Persistent Memory** - Long-term context storage across sessions

### 🎴 Intelligent Flashcards
- **AI-Generated Flashcards** - Automatically create flashcards from any note
- **Manual Creation** - Build your own custom cards
- **Difficulty Levels** - Easy, Medium, Hard classification
- **Spaced Repetition Tracking** - Review counts and timestamps
- **Filter & Search** - Find cards by difficulty, tags, or content

### 🎵 Ambient Study Music
- **Background Music Streaming** - Focus with ambient sounds
- **Seekable Playback** - Jump to any point in the track
- **Multiple Formats** - Support for MP3, WAV, and OGG

### 🌙 Study Environment (DEN)
- **Focus Timer** - Pomodoro-style study sessions
- **Ambient Mode** - Immersive study atmosphere
- **Theme Customization** - Light/Dark modes with sky color options
- **Distraction-Free Interface** - Clean, minimal design

---

## 🖼️ Screenshots

<details>
<summary>Click to view screenshots</summary>

### Chat Interface
The AI chat interface where you can have context-aware conversations with Retro.

### Notes Dashboard
Organize, search, and manage all your notes in one place.

### Flashcards View
Review AI-generated or manually created flashcards with spaced repetition.

### DEN (Study Environment)
Ambient study space with timer and customizable atmosphere.

</details>

---

## 🚀 Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **MongoDB** >= 6.0 (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Groq API Key** (for AI features) - [Get one here](https://console.groq.com/)
- **Mailtrap Account** (for emails) - [Sign up here](https://mailtrap.io/)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/retro.git
   cd retro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database
   MONGO_URI=mongodb://localhost:27017/retro

   # JWT Authentication
   ACCESS_TOKEN_SECRET=your-super-secret-access-token-key-min-256-bits
   REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key-min-256-bits
   ACCESS_TOKEN_EXPIRY=86400
   REFRESH_TOKEN_EXPIRY=604800

   # AI Service (Groq)
   GROQ_API_KEY=your-groq-api-key

   # Email Service (Mailtrap)
   MAILTRAP_SMTP_HOST=sandbox.smtp.mailtrap.io
   MAILTRAP_SMTP_PORT=587
   MAILTRAP_SMTP_USER=your-mailtrap-user
   MAILTRAP_SMTP_PASS=your-mailtrap-pass

   # Frontend URL (for CORS in production)
   FRONTEND_URL=http://localhost:3000
   ```

4. **Add music files** (optional)
   
   Place your MP3, WAV, or OGG files in `public/music/` directory for ambient music feature.

5. **Start the server**
   ```bash
   # Development mode with hot reload
   npm run code

   # Or standard start
   node src/index.js
   ```

6. **Open in browser**
   
   Navigate to `http://localhost:3000`

---

## 📖 API Reference

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All protected routes require a JWT token via:
- **Cookie**: `accessToken` (HTTP-only)
- **Header**: `Authorization: Bearer <token>`

---

### 🔐 Auth Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Register new user | ❌ |
| `POST` | `/auth/login` | Login user | ❌ |
| `POST` | `/auth/logout` | Logout user | ✅ |
| `GET` | `/auth/me` | Get current user | ✅ |
| `GET` | `/auth/verify-email` | Verify email address | ❌ |
| `POST` | `/auth/forgot-password` | Request password reset | ❌ |
| `POST` | `/auth/reset-password` | Reset password | ❌ |
| `POST` | `/auth/refresh-token` | Refresh access token | ❌ |
| `POST` | `/auth/resend-verification-email` | Resend verification | ✅ |

<details>
<summary>View Request/Response Examples</summary>

#### Register User
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

#### Login
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

</details>

---

### 📝 Notes Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/notes` | Create note | ✅ |
| `GET` | `/notes` | Get all notes | ✅ |
| `GET` | `/notes/:id` | Get note by ID | ✅ |
| `PUT` | `/notes/:id` | Update note | ✅ |
| `DELETE` | `/notes/:id` | Delete note | ✅ |
| `GET` | `/notes/search?query=` | Search notes | ✅ |
| `GET` | `/notes/tags` | Get user tags | ✅ |
| `GET` | `/notes/categories` | Get user categories | ✅ |
| `PATCH` | `/notes/:id/pin` | Toggle pin | ✅ |
| `PATCH` | `/notes/:id/favorite` | Toggle favorite | ✅ |
| `PATCH` | `/notes/:id/archive` | Toggle archive | ✅ |
| `POST` | `/notes/enhance` | AI enhance note | ✅ |

<details>
<summary>View Request/Response Examples</summary>

#### Create Note
```bash
POST /api/v1/notes
Content-Type: application/json

{
  "title": "Introduction to Machine Learning",
  "content": {
    "ops": [
      { "insert": "Machine learning is a subset of AI...\n" }
    ]
  },
  "tags": ["ai", "ml", "data-science"],
  "category": "Computer Science",
  "color": "#4a90d9"
}
```

#### Response
```json
{
  "success": true,
  "message": "Note created successfully",
  "data": {
    "_id": "64abc123...",
    "title": "Introduction to Machine Learning",
    "content": { "ops": [...] },
    "plainText": "Machine learning is a subset of AI...",
    "tags": ["ai", "ml", "data-science"],
    "category": "Computer Science",
    "color": "#4a90d9",
    "isPinned": false,
    "isFavorite": false,
    "isArchived": false,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

</details>

---

### 🤖 Chat Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/chat` | Send message to AI | ✅ |
| `POST` | `/chat-with-note` | Chat with note context | ✅ |

<details>
<summary>View Request/Response Examples</summary>

#### Chat with Retro
```bash
POST /api/v1/chat
Content-Type: application/json

{
  "message": "Explain the concept of neural networks",
  "chatSessionId": "64abc123..."
}
```

#### Response
```json
{
  "success": true,
  "response": "Neural networks are computing systems inspired by biological neural networks...",
  "meta": "Explained neural networks concept"
}
```

#### Chat with Note
```bash
POST /api/v1/chat-with-note
Content-Type: application/json

{
  "message": "Summarize the key points from this note",
  "noteId": "64abc123..."
}
```

</details>

---

### 🎴 Flashcards Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/cards` | Create card | ✅ |
| `POST` | `/cards/ai` | Generate from note | ✅ |
| `GET` | `/cards` | Get all cards | ✅ |
| `GET` | `/cards/:id` | Get card by ID | ✅ |
| `PUT` | `/cards/:id` | Update card | ✅ |
| `DELETE` | `/cards/:id` | Delete card | ✅ |
| `GET` | `/cards/search?query=` | Search cards | ✅ |
| `GET` | `/cards/note/:noteId` | Get cards by note | ✅ |
| `DELETE` | `/cards/note/:noteId` | Delete cards by note | ✅ |
| `PATCH` | `/cards/:id/pin` | Toggle pin | ✅ |
| `PATCH` | `/cards/:id/favorite` | Toggle favorite | ✅ |
| `PATCH` | `/cards/:id/review` | Mark reviewed | ✅ |

<details>
<summary>View Request/Response Examples</summary>

#### Generate Flashcards from Note
```bash
POST /api/v1/cards/ai
Content-Type: application/json

{
  "noteId": "64abc123..."
}
```

#### Response
```json
{
  "success": true,
  "message": "Flashcards generated successfully",
  "data": {
    "noteId": "64abc123...",
    "noteTitle": "Introduction to Machine Learning",
    "numberOfCards": 5,
    "cards": [
      {
        "title": "What is machine learning?",
        "content": "Machine learning is a subset of AI that enables systems to learn from data..."
      },
      {
        "title": "What are the types of machine learning?",
        "content": "The three main types are: supervised, unsupervised, and reinforcement learning."
      }
    ]
  }
}
```

</details>

---

### 💬 Chat Sessions Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/chat-sessions` | Create session | ✅ |
| `GET` | `/chat-sessions` | Get all sessions | ✅ |
| `GET` | `/chat-sessions/:sessionId` | Get session | ✅ |
| `DELETE` | `/chat-sessions/:sessionId` | Delete session | ✅ |

---

### 🎵 Music Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/music` | Get music list | ❌ |
| `GET` | `/music/stream/:filename` | Stream music | ❌ |
| `GET` | `/music/info/:filename` | Get file info | ❌ |

---

## 🏗️ Project Structure

```
retro/
├── 📁 public/
│   ├── 📁 assets/
│   │   └── 📁 images/          # Static images
│   ├── 📁 music/               # Music files for streaming
│   ├── 📄 *.html               # Static HTML pages
│   └── 📄 *.css                # Stylesheets
│
├── 📁 src/
│   ├── 📁 controllers/         # Request handlers
│   │   ├── auth.js             # Authentication logic
│   │   ├── card.js             # Flashcard operations
│   │   ├── chat.js             # AI chat functionality
│   │   ├── chatSession.js      # Session management
│   │   ├── musicController.js  # Music streaming
│   │   └── note.js             # Notes CRUD
│   │
│   ├── 📁 db/
│   │   └── dbConnection.js     # MongoDB connection
│   │
│   ├── 📁 middlewares/
│   │   ├── tokenChecker.js     # JWT verification
│   │   ├── validate.js         # Zod validation
│   │   └── ...                 # Other middlewares
│   │
│   ├── 📁 models/              # Mongoose schemas
│   │   ├── user.js
│   │   ├── note.js
│   │   ├── card.js
│   │   ├── chatSession.js
│   │   └── userContext.js
│   │
│   ├── 📁 routes/              # API route definitions
│   │   ├── authRoutes.js
│   │   ├── noteRoutes.js
│   │   ├── cardRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── chatSessionRoutes.js
│   │   ├── musicRoutes.js
│   │   └── viewRoutes.js
│   │
│   ├── 📁 utils/
│   │   ├── 📁 prompts/         # AI prompt templates
│   │   │   ├── answeringPrompt.txt
│   │   │   ├── contextPrompt.txt
│   │   │   ├── flashcardPrompt.txt
│   │   │   ├── noteEnhancePrompt.txt
│   │   │   └── noteReferencePrompt.txt
│   │   ├── asyncHandler.js     # Async error wrapper
│   │   ├── mail.js             # Email utilities
│   │   └── openai.js           # AI API client
│   │
│   ├── 📁 validators/          # Zod validation schemas
│   │   ├── registerSchema.js
│   │   ├── loginSchema.js
│   │   ├── noteSchemas.js
│   │   ├── flashcardSchemas.js
│   │   └── validationRules.js
│   │
│   ├── 📁 views/               # EJS templates
│   │   ├── 📁 partials/
│   │   ├── app.ejs
│   │   └── loginSignUp.ejs
│   │
│   └── 📄 index.js             # Application entry point
│
├── 📄 .env                     # Environment variables
├── 📄 package.json
├── 📄 SRS_DOCUMENT.md          # Software Requirements Spec
└── 📄 README.md
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js 5** | Web framework |
| **MongoDB** | Database |
| **Mongoose** | ODM |
| **JWT** | Authentication |
| **bcrypt** | Password hashing |
| **Zod** | Input validation |

### AI & Services
| Service | Purpose |
|---------|---------|
| **Groq API** | LLM inference (Llama 4 Maverick) |
| **Mailtrap** | Email delivery |

### Frontend
| Technology | Purpose |
|------------|---------|
| **EJS** | Templating |
| **Tailwind CSS** | Styling |
| **Quill** | Rich text editor |

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|:--------:|
| `PORT` | Server port | ❌ |
| `NODE_ENV` | `development` or `production` | ✅ |
| `MONGO_URI` | MongoDB connection string | ✅ |
| `ACCESS_TOKEN_SECRET` | JWT signing secret | ✅ |
| `REFRESH_TOKEN_SECRET` | Refresh token secret | ✅ |
| `ACCESS_TOKEN_EXPIRY` | Token expiry in seconds | ✅ |
| `REFRESH_TOKEN_EXPIRY` | Refresh expiry in seconds | ✅ |
| `GROQ_API_KEY` | Groq API key | ✅ |
| `MAILTRAP_SMTP_HOST` | SMTP host | ✅ |
| `MAILTRAP_SMTP_PORT` | SMTP port | ✅ |
| `MAILTRAP_SMTP_USER` | SMTP username | ✅ |
| `MAILTRAP_SMTP_PASS` | SMTP password | ✅ |
| `FRONTEND_URL` | Frontend URL for CORS | ❌ |

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```

4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Use conventional commits format

---

## 📋 Roadmap

- [ ] **Subscription System** - Tiered access (Free, Pro, Premium)
- [ ] **Rate Limiting** - API usage quotas
- [ ] **Note Sharing** - Collaborate with others
- [ ] **Export Options** - PDF, Markdown, Word
- [ ] **Offline Mode** - PWA support
- [ ] **Mobile App** - React Native/Flutter
- [ ] **Advanced Search** - AI-powered semantic search
- [ ] **Note Templates** - Pre-built templates
- [ ] **Analytics Dashboard** - Study statistics

---

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Syed Zaid Ali**

- GitHub: [@yourusername](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- [Groq](https://groq.com/) for lightning-fast LLM inference
- [MongoDB](https://www.mongodb.com/) for the database
- [Express.js](https://expressjs.com/) team for the amazing framework
- The open-source community for inspiration and tools

---

<p align="center">
  Made with ❤️ for learners everywhere
</p>

<p align="center">
  <a href="#retro">⬆️ Back to Top</a>
</p>