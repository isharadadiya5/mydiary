# MyDiary — Private Digital Journal & MySQL Backend

A feature-rich private digital diary web application powered by **Node.js, Express, MySQL, and Three.js**.

## Features Included
- **Articulated 3D Companion**: Animated 3D robot character (Pink & Blue models) moving head, arms, legs, and 5 facial expressions.
- **5 Custom Color Themes**: Soft Rose Light, Midnight Dark, Warm Paper, Purple Velvet (`#975C8D`), and Ocean Deep (`#146C94`).
- **Dashboard & Writing Editor**: Rich formatting toolbar, voice dictation, and prompt generator.
- **Voice Note Attachments**: Record, preview, and play back voice notes directly with entries using Web Audio (`MediaRecorder`).
- **Mood Analytics & Activity Heatmap**: Interactive emotional progress bars and 30-day writing consistency grid.
- **Daily 3 Gratitudes**: Positivity logging widget with history tracking.
- **Calendar & Search**: Highlighted entry days, keyword search, tag filtering.
- **PDF & Printable Export**: One-click printable PDF generator for journal entries.
- **Security & Privacy**: Passcode PIN lock with 5-minute inactivity auto-lock, bcrypt password hashing, and AES-256 encryption.
- **MySQL Database Storage**: Powered by `mysql2` connection pool with automatic schema initialization.

## Environment Configuration
Copy `.env.example` to `.env` and set your MySQL credentials:
```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=mydiary
MYSQL_PORT=3306
```

## Running Locally
1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open `http://localhost:3000` in your browser.
