# Newsletter Hub AI

Newsletter Hub AI is a zero-dependency full-stack demo that lets authenticated users organize newsletter sources into feeds and request AI-inspired article summaries for each feed. The backend is a lightweight Node.js server that persists data in a JSON file and serves the static frontend built with TailwindCSS-powered vanilla JavaScript.

## Features

- Email/password registration and login with salted PBKDF2 password hashes.
- Feed management: create feeds with names, keywords, and newsletter sources.
- Newsletter source library with manual entry and mocked email scan suggestions.
- Article generation endpoint that simulates a structured LLM response.
- Responsive dashboard SPA with sidebar navigation, skeleton loaders, and a modal feed builder.

## Project Structure

```
├── client
│   ├── app.js          # Vanilla JS SPA logic
│   ├── index.html      # TailwindCSS CDN bootstrap
│   └── styles.css      # Supplemental styling
├── server
│   ├── data/db.json    # Simple JSON persistence store
│   ├── package.json
│   └── server.js       # Node.js HTTP server and REST API
└── README.md
```

## Getting Started

1. **Install Node.js 18+** (the project relies on built-in `fetch`, `crypto`, and `URL` APIs).
2. **Start the server**:

   ```bash
   cd server
   npm start
   ```

   The server listens on `http://localhost:4000` and automatically serves the frontend.

3. **Open the app**: navigate to `http://localhost:4000` in your browser.

## Development Notes

- All API routes live under `/api`. Requests must include the `Authorization: Bearer <token>` header after logging in.
- Data is stored in `server/data/db.json`. Deleting the file will reset the environment.
- The `/api/scan-email` and `/api/feeds/:id/articles` endpoints contain mocked logic so the experience works without external services.
