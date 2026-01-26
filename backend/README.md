# 🎯 ActionGuard Crash Intelligence (AGCI)

## 📖 Overview
ActionGuard Crash Intelligence is an automated observability and root-cause analysis engine designed for Flutter/Dart applications. It bridges the gap between raw Sentry crash data and actionable component-level insights by automatically identifying precisely which UI component or logic block caused a failure.

By integrating directly with **Sentry** and **GitHub**, AGCI maps every crash to a specific `actionId` defined in the application source code, allowing teams to track component health with surgical precision.

## ✨ Key Features
- **Real-time Sentry Integration**: Automatically polls Sentry for new issues and updates crash counts in real-time.
- **Intelligent Stack Parsing**: Sophisticated stack trace analyzer that filters out framework noise (Dart/Flutter internals) to pinpoint user code.
- **Dynamic GitHub Code Retrieval**: Fetches the exact version of the source code directly from GitHub, with aggressive path normalization and multi-strategy "smart-search" fallback if the filename is unknown.
- **Hybrid Extraction Engine**: Dual-mode extraction using high-speed **Regex** patterns and **Google Gemini Pro** AI for deep code understanding.
- **Component Health Mapping**: Dynamically links crashes to components, calculates `totalCrashCount`, and auto-updates component status (e.g., to `maintenance` mode) based on crash thresholds.
- **Self-Healing Pipeline**: Automatically detects failed or unlinked crashes and retries processing during every polling cycle.

## 🛠 Tech Stack
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: PostgreSQL / Supabase
- **ORM**: Prisma
- **AI**: Google Gemini Pro (Generative AI SDK)
- **Monitoring**: Sentry Issues API
- **Code Access**: GitHub REST API

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL or Supabase instance
- Sentry Auth Token (with project read access)
- GitHub Personal Access Token (with repo access)

### Installation
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd backend
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Initialize the database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Configuration (.env)
Create a `.env` file in the root with the following keys:
```env
PORT=3001
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
GITHUB_TOKEN="..."
GITHUB_REPO_OWNER="..."
GITHUB_REPO_NAME="..."
GITHUB_BRANCH="master"
SENTRY_AUTH_TOKEN="..."
SENTRY_POLLING_ENABLED=true
```

## 📂 Core Architecture
- `index.js`: Main entry point. Manages the server, API endpoints, and the Sentry polling interval.
- `crash-processor.js`: The central orchestrator for the analysis pipeline (Parse -> Fetch -> Extract -> Link).
- `stack-parser.js`: Specialized logic for identifying user files vs core framework files in stack traces.
- `github-fetcher.js`: Handles all interactions with the GitHub API, including path normalization and symbol search.
- `gemini-analyzer.js`: Uses Gemini AI to extract `actionId` symbols when regex rules are insufficient.
- `manual-crash-processor.js`: Contains robust regex extraction patterns used as the primary high-speed extraction method.

## 🚦 Usage & APIs

### Automatic Monitoring
Run the server to start the automatic polling loop:
```bash
node index.js
```

### Manual Extraction
To process a specific crash manually by its ID:
```bash
node manual-crash-processor.js <crash-id>
```

### Key API Endpoints
- `POST /api/crashes/process-all`: Trigger processing for all unlinked crashes in the database.
- `POST /api/crashes/:id/process`: Manually trigger processing for a single crash.
- `POST /api/components/sync-stats`: Re-calculate crash counts and health status for all components.

---
**Built for the Hackathon.** Bridging the gap between monitoring and source code awareness. 🚀
