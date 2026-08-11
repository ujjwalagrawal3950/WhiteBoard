# Collaborative Whiteboard

A fully-featured, real-time collaborative whiteboard application inspired by tools like Excalidraw and Miro. Built with a modern technology stack, it enables users to draw, brainstorm, and collaborate in real-time on an infinite canvas.

## ✨ Features

### 🖌️ Infinite Canvas & Drawing
- **Infinite Canvas**: Zoom in/out, pan seamlessly across a boundless workspace.
- **Rich Drawing Tools**: Pencil (with smooth quadratic curves), Line, Arrow, Rectangle, Ellipse, Triangle, and Diamond.
- **Smart Text & Sticky Notes**: Native inline text editing that automatically scales and centers. Double-click to instantly edit any text or sticky note without the visual clutter of boundary boxes.
- **Image Support**: Upload and seamlessly resize/move images on the board.
- **Premium Eraser**: Animated, stretchy circular eraser that tracks your mouse path for an intuitive clearing experience.

### 👥 Real-Time Collaboration
- **Live Syncing**: Every stroke, movement, and text edit syncs instantaneously with all other users viewing the board via WebSockets.
- **Multiplayer Cursors**: See where your team members are pointing in real-time with their custom cursors and nametags.

### 🛠️ Advanced Object Management
- **Selection & Manipulation**: Select single or multiple objects with a drag-and-drop bounding box.
- **Contextual Toolbar**: A sleek floating toolbar appears instantly above selected elements, giving you one-click access to:
  - 🔼 **Bring Forward** / 🔽 **Send Backward** (Z-Index management)
  - 📄 **Duplicate**
  - 🗑️ **Delete**
- **Grouping**: Group multiple shapes into a single movable, resizable component.

### 🎨 Styling & Theming
- **Premium Color Palette**: 5 meticulously chosen, dark-mode optimized colors (Neon Blue, Purple, Pink, Green, and White), alongside a custom RGB color picker.
- **Customizable Strokes**: Adjustable stroke widths (XS to XL), stroke colors, fill colors, and line styles (Solid, Dashed, Dotted).
- **Typography**: 8 unique font families ranging from sans-serif to handwriting, with scalable font sizes (S to XL) and alignment options.
- **Dark/Light Mode**: Toggle instantly between a sleek dark theme and a clean light theme.

## 🚀 Tech Stack

### Frontend (`/my-app`)
- **React 19** & **Vite**: Ultra-fast development and rendering.
- **Redux Toolkit**: Predictable state management handling board elements, UI tools, and interaction history (Undo/Redo).
- **HTML5 Canvas API**: High-performance custom rendering loop for all shapes and drawings.
- **Socket.io-client**: For seamless, low-latency real-time communication.

### Backend (`/my-app-server`)
- **Node.js** & **Express**: Robust and scalable API architecture.
- **Socket.io**: Real-time bidirectional event-based communication.
- **MongoDB (Mongoose)**: Document database for persistent storage of boards, elements, and user data.
- **Passport.js (Google OAuth 2.0)**: Secure authentication and JSON Web Tokens (JWT) for session management.

## 📦 Installation & Setup

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [MongoDB](https://www.mongodb.com/) installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/whiteboard.git
cd whiteboard
```

### 2. Backend Setup
```bash
cd my-app-server
npm install
```

Create a `.env` file in the `my-app-server` directory with the following variables:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FRONTEND_URL=http://localhost:5173
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd my-app
npm install
```

Start the frontend development server:
```bash
npm run dev
```

The application will be running at `http://localhost:5173`.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## 📜 License
This project is licensed under the ISC License.
