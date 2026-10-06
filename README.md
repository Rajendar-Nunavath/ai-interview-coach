# AI Interview Coach

Practice mock interviews with spoken questions, live captions, an accurate AI transcript, and AI feedback.

## Quick start
```bash
npm run setup          # installs both apps, creates .env files with a random JWT secret
# add GEMINI_API_KEY to server/.env  (optional - demo mode works without it)
npm run dev:server     # terminal 1  -> http://localhost:3001
npm run dev            # terminal 2  -> http://localhost:5173
```
Use Chrome or Edge. Microphone needs `localhost` or HTTPS.

## Run options
```bash
npm run dev:all      # backend + frontend in ONE terminal (development)
npm run start:all    # production build + backend in one terminal - FASTEST, use this for real practice
```
Development mode (`npm run dev`) is noticeably slower than a production build, so prefer `start:all` for interviews.

## Performance and camera/microphone notes
- The microphone is opened once per interview and reused (no re-opening for every question).
- Live caption updates are throttled, and the camera is isolated so captions never re-render it.
- Transcription, follow-up generation and the camera check run in parallel after each answer.
- AI calls use low/no thinking on Gemini 2.5 and 3.x where possible (3.8 Flash default model), which makes them much faster.
- Pick the exact camera/microphone under the video (fixes virtual cameras like OBS being chosen by default); the mic level bar shows whether sound is actually arriving.
- Live captions always use the system default microphone (a browser limit); set it in Windows Sound settings.
- Close Zoom/Teams/other tabs using the camera. Use Chrome or Edge on `localhost` or HTTPS.

## Features
- **Role + difficulty:** pick a role (Frontend, Backend, Full-Stack, Data Analyst, HR/Behavioral...) and Beginner/Intermediate/Advanced; questions and scoring are calibrated to it.
- **Tailored questions:** paste a resume and/or job description and the AI writes questions about *your* projects and the role's requirements (falls back to the built-in bank if AI is off).
- **AI follow-up questions:** after a substantial answer, the interviewer may ask a short follow-up that probes what you just said (max 3 per interview).
- **Rubric scoring:** correctness (40%), depth (35%), communication (25%); the score is computed on the server from the rubric, with strengths and suggestions.
- **Transcripts + progress dashboard:** every interview is saved with its transcript; "My Progress & Data" shows trend, average rubric and past sessions.
- **Consent + data control:** a consent screen on first login; download your data, delete a single interview, delete all interviews, or delete your account (password required).
- **Camera framing:** the old "eye contact" score was replaced by an optional, unscored "face centered" tip, because a bounding-box check cannot measure eye contact.

## How the voice pipeline works
1. The browser's speech recognition (continuous mode) shows **live captions**; an answer ends after 2.5 s of silence, so natural pauses no longer cut you off.
2. At the same time `src/voice.ts` records clean mono audio (echo cancellation, noise suppression, auto-gain).
3. When you finish, the audio goes to `POST /api/transcribe`; Gemini returns an accurate transcript using your chosen technologies as context (so "JVM", "REST", "SQL" are spelled correctly). If this fails, the live captions are used.
4. Set `VITE_SPEECH_LANG` (e.g. `en-IN`) to match your accent for better live captions.

## Security in this version
- bcrypt cost 12 (async), timing-equalized login, 8-72 char passwords, case-insensitive usernames
- JWT pinned to HS256 + issuer, 2h expiry, user must still exist on every request
- Server-side validation of every field; scores are clamped to 0-100
- Gemini prompt-injection guard, validated AI output, 25 s timeout, per-user hourly AI quota
- helmet, CORS limited to `FRONTEND_URL`, rate limits, 100 KB body limit (3 MB only for audio), central error handler
- Every record is scoped to the logged-in user (other users get 404); deleting an account invalidates its tokens
- Parameterized SQL only; SQLite WAL + index; gzip compression
- `.env`, `*.db` and `node_modules` are git-ignored - never commit them

## Before deploying
Serve over HTTPS, set `VITE_API_URL`, `FRONTEND_URL`, `TRUST_PROXY=1`, move SQLite to Postgres if you expect real users, and rotate any key that was ever shared.
