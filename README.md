# CIG | Event & Media Management Platform

A centralized, full-stack, and high-performance **Event & Media Management Platform** built for clubs, photographers, and members to seamlessly organize, secure, access, and interact with event media.

---
LIVE DEPLOYMET LINK-
https://cig-725y.vercel.app/

## 🚀 Key Features

1. **Event-Wise Media Organization**: Create public or private albums, organize photos/videos, search, and sort by event date, category, or title.
2. **Access Control & Authentication**: Role-based access control (Admin, Photographer, Club Member, Viewer). Private albums are securely hidden from general Viewers and guest users.
3. **Local AI/ML Facial Recognition**: Zero-dependency browser-side face recognition using `face-api.js` (TensorFlow.js-backed). Upload a selfie to instantly find all database photos containing your face.
4. **Smart Image Tagging**: Custom and automatic tagging of uploads for fast filtering.
5. **Real-time Notifications**: Instant notifications for photo likes, comments, and member tagging powered by WebSockets (`Socket.io`).
6. **Cloud Storage with Local Fallback**: Integrated S3 client that automatically falls back to local disk storage (`/uploads`) if AWS environment variables are not set.
7. **Dynamic Watermarking System**: Dynamic watermarking overlay during downloads (capturing Downloader name, role, event title, and club) powered by a fast server-side SVG overlay engine (`sharp`).

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite) + Vanilla CSS (Premium Dark Theme with Glassmorphism)
- **Backend**: Node.js + Express + Socket.io
- **Database**: SQLite + Prisma ORM (for local, zero-setup relational storage)
- **ML / AI**: `@vladmandic/face-api` (TinyFaceDetector, FaceLandmarks, FaceRecognition)
- **Image Processing**: `sharp` (Express-side dynamic SVG compositor)
- **Cloud Integration**:AWS S3
---

## 📂 Project Structure

```
D:\CIG\
├── backend\
│   ├── prisma\
│   │   └── schema.prisma    # SQLite database schema
│   ├── middleware\
│   │   └── upload.js        # Multer disk upload config
│   ├── routes\
│   │   ├── auth.js          # JWT login, signup & profile routes
│   │   ├── events.js        # Event creation & access controls
│   │   ├── media.js         # Media uploads & watermarked downloads
│   │   └── notifications.js # Notifications fetch & clear
│   ├── utils\
│   │   └── storage.js       # S3 storage helper with local fallback
│   ├── uploads\             # Local media storage directory
│   └── server.js            # Express server, Socket.io, & database seeder
├── frontend\
│   ├── src\
│   │   ├── components\
│   │   │   └── Sidebar.jsx  # Navigation layout
│   │   ├── pages\
│   │   │   ├── Dashboard.jsx# Events directory & filters
│   │   │   ├── EventDetails.jsx # Media upload, comment, tag lightbox
│   │   │   ├── FaceRecognition.jsx # Face-api selfie search
│   │   │   ├── Login.jsx    # Login / Register
│   │   │   └── Notifications.jsx # Event alerts
│   │   ├── utils\
│   │   │   └── api.js       # API fetch & auth headers
│   │   ├── App.jsx          # Route management
│   │   ├── index.css        # Core custom CSS styling system
│   │   └── main.jsx         # Render entry point
│   ├── index.html           # Main HTML with SEO meta tags
│   └── package.json         # React client configurations
└── README.md                # This documentation
```

---

## 📊 Database Schema

```mermaid
erDiagram
    User {
        Int id PK
        String email
        String password
        String name
        String role
        String avatarUrl
        String referenceSelfieUrl
        DateTime createdAt
    }
    Event {
        Int id PK
        String name
        String description
        DateTime date
        String category
        Boolean isPrivate
        String clubName
        Int creatorId FK
    }
    Media {
        Int id PK
        String filename
        String fileUrl
        String fileType
        Int size
        Boolean isPrivate
        String tags
        String faceMarkers
        DateTime uploadDate
        Int eventId FK
        Int uploaderId FK
    }
    Like {
        Int id PK
        Int mediaId FK
        Int userId FK
        DateTime createdAt
    }
    Comment {
        Int id PK
        String content
        Int mediaId FK
        Int userId FK
        DateTime createdAt
    }
    Notification {
        Int id PK
        String type
        String message
        Boolean isRead
        Int userId FK
        Int triggerUserId FK
        Int mediaId FK
    }

    User ||--o{ Event : "creates"
    User ||--o{ Media : "uploads"
    User ||--o{ Like : "likes"
    User ||--o{ Comment : "writes"
    User ||--o{ Notification : "receives"
    User ||--o{ Notification : "triggers"
    Event ||--o{ Media : "contains"
    Media ||--o{ Like : "receives"
    Media ||--o{ Comment : "has"
    Media ||--o{ Notification : "references"
```

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Git

### 1. Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the local SQLite database and client using Prisma:
   ```bash
   npx prisma db push
   ```
4. Start the Express backend:
   ```bash
   npm start
   ```
   *The backend starts on `http://localhost:5000` and automatically seeds four default test users and sample events.*

### 2. Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The frontend starts on `http://localhost:5173`.*

---

## 🔑 Demo Login Credentials (Seeded Automatically)

For easy role-based access control testing, use the following seeded accounts:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@cig.com` | `adminpassword` | Full read/write, private albums, event creation |
| **Photographer** | `photo@cig.com` | `photopassword` | Upload media, create public/private events |
| **Club Member** | `member@cig.com` | `memberpassword` | View public/private albums, like, comment, tag |
| **Viewer** | `viewer@cig.com` | `viewerpassword` | View public albums only, download watermarked |

---

## 🤖 Facial Recognition Workflow

1. **Upload Reference Selfie**: Go to the **Face Discovery** section and upload a clear picture of your face.
2. **Local AI Model Load**: The browser pulls face weights from a fast jsDelivr CDN and computes a 128-float vector representing your face structure.
3. **DB Image Analysis**:
   - When photos are uploaded by photographers, `face-api.js` runs in their browser, detects all faces in the photo, and compiles a list of face descriptors.
   - These descriptors are stored in the database's `faceMarkers` column.
4. **Vector Match**: When you request face discovery, the app checks the Euclidean distance between your selfie descriptor and all face descriptors in the database. Distances `< 0.55` are classified as matches, compiling your personalized photo stream instantly.
