# Vitalyze – Health Management App

A full-stack web app for tracking personal health vitals and children's health profiles, with automatic reports and insights.

**Stack:** Node.js · Express 5 · MongoDB (Mongoose) · JWT authentication · bcrypt · Swagger · HTML / CSS / JavaScript

## Features

- **Accounts:** register and log in with hashed passwords (bcrypt) and JWT-protected routes
- **Vitals tracking:** record vitals and view the latest readings
- **Reports & insights:** generate an adult health report and see the latest insights from your data
- **Children's profiles:** add children and get an age-appropriate child health guide
- **Arabic landing page** with general health tips and guidance on when to see a doctor
- **API docs** with Swagger UI

## API overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | Current user |
| POST / GET | `/api/vitals` | Add / list vitals |
| GET | `/api/vitals/latest` | Latest vitals |
| GET | `/api/vitals/insights/latest` | Latest insights |
| POST | `/api/reports/adult/generate` | Generate an adult report |
| GET | `/api/reports/adult/latest` | Latest report |
| POST / GET | `/api/children` | Add / list children |
| GET | `/api/children/:id/guide` | Child health guide |

## Getting started

```bash
git clone https://github.com/mohamedsadeq123456789-debug/vitalyze.git
cd vitalyze
npm install
cp .env.example .env   # then fill in MONGO_URI and JWT_SECRET
npm run dev            # API on http://localhost:5000
```

Open `index.html` in the browser (or serve the folder with any static server) to use the front end. Interactive API docs are at `http://localhost:5000/docs`.

## Project structure

```
index.js          Express API, Mongoose models, auth middleware
app.js            Front-end API client (fetch + token handling)
index.html        Landing page
login.html        Login
register.html     Sign up
dashboard.html    Vitals, report and insights
children.html     Children profiles and guide
styles.css        Styles
```

## Screenshots

_Add screenshots of the dashboard and children pages here._

## Author

**Mohammad Bataineh** – [LinkedIn](https://www.linkedin.com/in/mohammad-bataineh-apex/)
