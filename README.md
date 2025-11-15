# Newsletter Hub AI

Newsletter Hub AI is a full-stack, AI-powered application that aggregates user newsletter subscriptions into customizable **Feeds**. Each feed generates a curated list of summarized articles using an LLM such as **Google Gemini**. Users can authenticate, organize their sources, scan their inbox for newsletters, and view AI-generated article digests in a responsive web interface.

---

## Features

### **AI-Generated Article Summaries**

* Uses Gemini (e.g., `gemini-2.5-flash`) to generate structured JSON article summaries.
* Produces 5 concise, relevant articles per feed.
* Enforces consistent output using JSON mode or schema enforcement.

### **Newsletter Aggregation**

* Users create categorized Feeds (e.g., “Tech News”).
* Feeds reference Newsletter Sources collected manually or via an email scan.
* Each feed stores keywords/topics that guide the AI.

### **Email Newsletter Discovery**

* Backend connects to the user’s inbox (e.g., Gmail API).
* Scans emails that contain newsletter indicators (e.g., “unsubscribe”).
* Extracts sender names and addresses and deduplicates them.
* Returns suggestions to the frontend for easy inclusion.

### **Authentication**

* Email/password or OAuth (Google auth) supported.
* Backend handles registration, login, logout via JWT or session tokens.
* Avatar, name, and email displayed in the UI header.

---

## Data Models

### **User**

* `id`
* `email`
* `name`
* `avatarUrl`
* `passwordHash`
* `oauthTokens` (secure storage for OAuth workflows)

### **NewsletterSource**

* `id`
* `userId`
* `name`
* `emailAddress`

### **Feed**

* `id`
* `userId`
* `name`
* `keywords` (comma-separated)
* `newsletterSourceIds` (array of foreign keys)

### **Article** *(generated, not stored)*

* `title`
* `summary`
* `link`
* `source`

---

## Backend API

### **Auth**

* `POST /api/register`
* `POST /api/login`
* `POST /api/logout`

### **Feeds**

* `GET /api/feeds`
* `POST /api/feeds`
* `PUT /api/feeds/{id}`
* `DELETE /api/feeds/{id}`

### **Newsletter Sources**

* `GET /api/sources`
* `POST /api/sources`

### **Articles**

* `GET /api/feeds/{id}/articles`
  Retrieves feed → constructs Gemini prompt → returns JSON articles array.

### **Email Scanner**

* `POST /api/scan-email`
  Connects to email → finds newsletters → returns deduped list.

---

## Frontend Overview

### **Technology**

* Single-page application (SPA)
* Responsive layout
* Components for:

  * Sidebar
  * Feed List
  * Article Grid
  * Header with user info
  * ManageFeedsModal
* Styled with **TailwindCSS**

### **Layout Structure**

**Left Sidebar**

* App name/logo
* List of Feeds
* Highlight active feed
* “New Feed” button

**Main Content**

* Header with avatar, name, email, and logout
* Feed view with article cards
* Skeleton loaders while fetching

---

## Core Interactions

### **Selecting a Feed**

1. User clicks a Feed
2. Frontend sets it active
3. Calls `/api/feeds/{id}/articles`
4. Shows skeleton loaders
5. Displays ArticleCards in a grid

### **Creating/Editing Feeds**

* Full-screen modal with:

  * Feed name
  * Keywords/topics
  * Newsletter source list
  * “Scan Email for Newsletters”
  * Manual Add-Source fields

### **Email Scan Flow**

1. User clicks **Scan Email**
2. Frontend calls `/api/scan-email`
3. Backend queries inbox
4. Returns suggestions
5. User clicks “Add” to accept sources

---

## Technology Stack

### **Frontend**

* React / Next.js or a modern SPA framework
* TailwindCSS
* Fetch API or Axios
* JWT token handling

### **Backend**

* Node.js / Express (or similar framework)
* Google Gemini API
* Email integration (Gmail API or IMAP)
* JSON schema outputs for AI consistency

### **Database**

* PostgreSQL or MongoDB

---

## Getting Started

### 1. Clone or open the repository

Initialize environment variables for:

* Database connection
* Gemini API key
* OAuth credentials (if using Gmail/Google auth)
* JWT secret

### 2. Install dependencies

```
npm install
```

### 3. Run backend

```
npm run server
```

### 4. Run frontend

```
npm run dev
```

---

## Roadmap

* Add multi-source parsing (attachments, plaintext, HTML)
* Improve feed ranking using embeddings
* Add user analytics dashboard
* Mobile app companion (React Native)
* Multi-LLM support (Gemini, OpenAI, Anthropic)
