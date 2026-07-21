# ApexSupport - Customer Support Management Desk

A modern, full-stack web application for managing customer support tickets, featuring role-based dashboards, automated category routing, and an AI Copilot assistant powered by Groq.

Built as an assessment project for full-stack engineering evaluation.

---

## 🌟 Key Features

### 👤 1. Role-Based Portals & Access Control
- **Customer Portal**: Allows users to log support incidents, view their ticket history, and track status updates.
- **Agent Dashboard**: Gives support representatives a complete overview of all organization tickets, KPI metric cards (Total, Open, In Progress, Closed), priority management, and agent reassignment tools.
- **Security**: Secured with JSON Web Tokens (JWT) and `bcryptjs` password hashing.

### 🎫 2. Ticket Management & Triage
- **Create Tickets**: Simple incident logging form capturing name, contact email, category, title, and description.
- **Auto-Generated IDs**: Sequential IDs (e.g. `TKT-001`) generated automatically on the backend.
- **Debounced Search**: Search-as-you-type filtering matching across ticket IDs, customer names, emails, and subjects.
- **Status Filter**: Instant filtering by status (`Open`, `In Progress`, `Closed`).
- **Instant Status Transitions**: Support agents can update ticket statuses seamlessly.

### 🔀 3. Automated Category Routing
Tickets are auto-assigned to specialized representatives based on category selection:
- `Technical Support` ➔ Auto-routed to **agent_tech**
- `Billing` ➔ Auto-routed to **agent_billing**
- `General Inquiry` ➔ Auto-routed to **agent_general**
- `Bug Report` & `Feature Request` ➔ Default support queue

### 🤖 4. AI Copilot Desk (Groq API Integration)
Integrated in the Agent's ticket details view using Groq's fast `llama-3.1-8b-instant` model:
- **TL;DR Summary**: Summarizes long customer descriptions into a single clear sentence.
- **Sentiment Analysis**: Evaluates customer tone (`Frustrated`, `Neutral`, `Positive`).
- **Suggested Response**: Generates a polite, structured email draft addressing the issue.
- **One-Click Reply**: Agents can click *"Copy to Reply Box"* to paste the AI draft directly into their response input.

---

## 🛠️ Tech Stack

- **Frontend**: React.js, Vite, Vanilla CSS3 (Custom Glassmorphism Dark Theme)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose ORM (MongoDB Compass compatible)
- **Authentication**: JWT (JSON Web Tokens), bcryptjs
- **AI Integration**: Groq API (`llama-3.1-8b-instant` model)

---

## 🔑 Demo Login Credentials

Upon first boot, the system auto-seeds demo credentials into MongoDB:

| Account Type | Username | Password | Role / Specialty |
| :--- | :--- | :--- | :--- |
| **Customer Account** | `customer1` | `password123` | Customer (View own tickets) |
| **Customer Account** | `customer2` | `password123` | Customer (View own tickets) |
| **Tech Specialist Agent** | `agent_tech` | `password123` | Agent (Technical Support) |
| **Billing Agent** | `agent_billing` | `password123` | Agent (Billing Desk) |
| **General Support Agent** | `agent_general` | `password123` | Agent (General Inquiries) |
| **Fallback Support Agent** | `agent` | `password123` | Agent (All tickets) |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) running locally on default port `27017`

### Installation

1. **Clone or open the repository**:
   ```bash
   cd customer-support-system
   ```

2. **Install all workspace dependencies**:
   ```bash
   npm install && npm run install-all
   ```

3. **Environment Setup**:
   Ensure `backend/.env` contains your MongoDB URI and API keys:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/support_db
   JWT_SECRET=super_secret_session_key_123!
   GROQ_API_KEY=your_groq_api_key_here
   ```

---

## 💻 Running the Application

### Option A: Development Mode (Concurrently)
Runs the Express backend (port 5000) and Vite frontend dev server (port 5173) together:
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### Option B: Production Build & Serve
Builds the production React bundle and serves it through Express on a single port:
```bash
npm run build
npm start
```
Open **`http://localhost:5000`** in your browser.

---

## 📡 REST API Specifications

| Method | Endpoint | Description | Expected Return |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | User login | `{ token, user }` |
| `POST` | `/api/tickets` | Create ticket | `{ ticket_id, created_at }` |
| `GET` | `/api/tickets` | Catalog list (optional `?status=` & `?search=`) | `[{ ticket_id, customer_name, subject, status, created_at }]` |
| `GET` | `/api/tickets/:id` | Detailed view | `{ ticket_id, customer_name, customer_email, subject, description, status, notes }` |
| `PUT` | `/api/tickets/:id` | Update status/notes/priority | `{ success: true, updated_at }` |
| `POST` | `/api/tickets/:id/copilot` | Generate AI summary & reply draft | `{ summary, sentiment, suggested_reply }` |

---

## 📂 Project Structure

```text
customer-support-system/
├── backend/
│   ├── .env               # Database URI & API keys
│   ├── server.js          # REST API Controllers, Mongoose Models & Groq Copilot
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main Single Page Application & Dashboards
│   │   ├── index.css      # Design Tokens & Responsive Glassmorphism Styling
│   │   └── main.jsx
│   ├── vite.config.js     # Dev proxy rules (/api -> localhost:5000)
│   └── package.json
├── README.md              # Documentation
└── package.json           # Root scripts
```

---

## 📄 License
Created for internship evaluation. Free to use for assessment and demonstration purposes.
