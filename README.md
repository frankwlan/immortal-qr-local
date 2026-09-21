# immortal-qr-local

Local deployment process:

1. Install dependencies:
   ```
   npm install
   ```

2. Copy the environment template and fill in real values:
   ```
   cp .env.example .env
   ```
   At minimum set `DATABASE_URL` and a strong `NEXTAUTH_SECRET`
   (e.g. `openssl rand -base64 32`).

3. Start Postgres:
   ```
   postgres -D "C:\Program Files\PostgreSQL\18\data"
   ```
   (TODO: remove -D portion)

4. Apply database migrations:
   ```
   npm run prisma:migrate
   ```

5. Run the dev server:
   ```
   npm run dev
   ```

6. Access the app at http://localhost:3000

Note: Google/GitHub sign-in buttons have been removed for now — the
JWT session strategy has no database adapter wired up, so OAuth
logins wouldn't have a matching user record. Email/password is the
only working login method until that's added.
