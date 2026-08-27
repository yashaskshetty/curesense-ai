# CureSense AI — AI-Powered Healthcare Assistant

A full-stack healthcare platform with a polyglot service architecture: a Node/Express + MongoDB API, a separate FastAPI microservice for prescription OCR, and a React frontend.

## Architecture

```text
frontend/    React (Vite) — dashboard, chatbot, symptom checker, prescription reader, reminders
backend/     Node.js + Express + MongoDB — auth, reminders, doctor contact, AI proxy routes
ai_service/  FastAPI — OCR microservice for prescription reading (EasyOCR)
```

## Features

- **Symptom Checker** — Gemini-powered assessment returning structured JSON (condition, confidence, severity, precautions).
- **Prescription Reader** — EasyOCR extracts text from a photographed prescription; Gemini Vision cross-references it to identify medicines, dosage, and instructions.
- **Medicine Reminders** — cron-based scheduler checks active reminders every minute and emails dosage-time alerts.
- **Doctor Contact** — patient-to-doctor consultation request routed through email.
- **Auth** — JWT-based authentication.

## Operational Resilience & Diagnostics

While extending this project, two reliability issues were found and fixed, and a health-check layer was added:

**1. Server-wide crash from a single missing API key.** `routes/ai.js` constructed the Gemini client at module load time (`new GoogleGenAI({...})`), which throws synchronously if `GEMINI_API_KEY` is unset. Because `server.js` `require()`s every route file eagerly, this crashed the *entire* API on startup — auth, reminders, doctor contact, everything — not just the AI endpoints. Fixed by constructing the client lazily on first use (`getAiClient()`), so a missing key now only fails the specific AI request that needs it.

**2. Hard exit on a DB connection failure.** `config/db.js` called `process.exit(1)` if MongoDB was unreachable, taking down routes that don't even touch the database. It now logs the failure and keeps the process running in a degraded state.

**3. `GET /api/health`** — reports the live status of every external dependency (MongoDB, email credentials, JWT secret, Gemini API key) in one place, instead of requiring someone to read scattered server logs to figure out what's misconfigured:

```json
{
  "status": "degraded",
  "timestamp": "2026-08-27T13:42:40.521Z",
  "uptimeSeconds": 35,
  "checks": {
    "mongodb": { "status": "down", "state": "disconnected" },
    "email":   { "status": "not_configured", "note": "EMAIL_USER/EMAIL_PASS missing — emails will be mocked (logged, not sent)" },
    "jwt":     { "status": "not_configured", "note": "JWT_SECRET missing — authenticated routes will fail" },
    "ai":      { "status": "not_configured", "note": "No Gemini/Google API key found — symptom checker will fail" }
  }
}
```

**4. Centralized error handling & request logging** (`middleware/errorHandler.js`, `middleware/requestLogger.js`) — every request now gets one structured log line (`METHOD path -> status (Nms)`), unknown routes return a clean 404 JSON body instead of hanging, and unhandled errors return a consistent JSON shape instead of crashing the process.

Verified locally by running the server with zero environment configuration: it now starts successfully, `/` and `/api/health` respond correctly (health reports `degraded` with the exact missing pieces), and an unknown route returns a proper 404 — instead of the server crashing outright, which was the previous behavior.

## Manual Verification Scripts

`backend/verify_doctors.js` and `backend/verify_reminder.js` are standalone scripts that exercise the live API end-to-end (register/login, hit real endpoints, assert on responses) and print explicit reproduction/verification steps — written during development to manually confirm each feature end-to-end before relying on it.

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express, MongoDB (Mongoose), JWT, Nodemailer, node-cron |
| AI/OCR | Google Gemini API, FastAPI, EasyOCR |
| Diagnostics | Custom health-check route, centralized error handling, request logging |

## Author

**Yashas K** — MCA, REVA University, Bengaluru
GitHub: [yashaskshetty](https://github.com/yashaskshetty)
