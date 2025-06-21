# Matrix LMS Backend

Minimal backend for Matrix LMS, built with Node.js, Express, and MongoDB. Supports authentication with mock credentials.

## Setup Instructions

1. Install dependencies: `npm install`
2. Create `.env` file with variables (see `.env` example)
3. Start MongoDB (local or Atlas)
4. Run server: `npm run dev`

## Testing with Postman

1. Install Postman
2. Create a collection for Matrix LMS
3. Test `POST /api/auth/login` with mock credentials
