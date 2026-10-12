import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import * as Sentry from "@sentry/nextjs";
import prisma from "../lib/prisma";
import { createLimiter, getClientIp } from "./rateLimit";
import { sendAccountRestoredNotice } from "./email";
import { isRestorable } from "./retention";

// Sign-in is the one endpoint where guessing passwords is the whole attack,
// so it gets two independent limits: per IP (stops one machine trying many
// accounts) and per email (stops many machines hammering one account).
// Both count every attempt, so a determined attacker can briefly lock a
// victim out of sign-in; password reset still works, and that's the safer
// failure than unlimited guessing.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginIpLimiter = createLimiter("login-ip", { windowMs: LOGIN_WINDOW_MS, max: 30 });
const loginEmailLimiter = createLimiter("login-email", { windowMs: LOGIN_WINDOW_MS, max: 10 });

// A real bcrypt hash of a throwaway string. Comparing against it when the
// account doesn't exist keeps response time about the same either way, so
// timing can't be used to find out which emails are registered.
const DUMMY_HASH = "$2a$10$9ZLQ6hhhV6hzcQuKib5i2eomio1J8yvXXEa4IEARny1RbF1PRuhui";

// NOTE: Google/GitHub OAuth are intentionally left out for now. With JWT
// sessions and no database adapter configured, an OAuth sign-in would never
// create a matching User row, and the first QR-link creation after such a
// login would fail on the QrLink.userId foreign key. Add
// @next-auth/prisma-adapter (and re-add the providers) before enabling
// social login.

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    // Email/Password via Credentials (MVP)
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const { email, password } = credentials || {};
        if (typeof email !== "string" || typeof password !== "string" || !email || !password) return null;
        const normalizedEmail = email.trim().toLowerCase().slice(0, 254);

        const [byIp, byEmail] = await Promise.all([
          loginIpLimiter.check(getClientIp(req || { headers: {} })),
          loginEmailLimiter.check(normalizedEmail),
        ]);
        // Throwing (rather than returning null) lets the login page show a
        // specific message: NextAuth redirects to /login?error=RateLimited.
        if (!byIp.allowed || !byEmail.allowed) throw new Error("RateLimited");

        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        const ok = await compare(password, user?.passwordHash || DUMMY_HASH);
        if (!user || !user.passwordHash || !ok) return null;

        // Signing in to a deleted account (within the restore window) undoes the deletion. Only a correct
        // password gets here, and the owner is emailed so a restore they
        // didn't do themselves doesn't go unnoticed. Links are brought back
        // by matching the deletion timestamp, so ones the user had deleted
        // individually beforehand stay deleted.
        if (user.deletedAt) {
          // Past the restore window the account is only waiting for the
          // purge job; it must not be revivable in that gap.
          if (!isRestorable(user.deletedAt)) return null;
          const [restored] = await prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } }),
            prisma.qrLink.updateMany({
              where: { userId: user.id, deletedAt: user.deletedAt },
              data: { deletedAt: null },
            }),
          ]);
          try {
            await sendAccountRestoredNotice(user.email);
          } catch (err) {
            console.error("Failed to send account-restored notice:", err);
            Sentry.captureException(err);
          }
          return restored;
        }
        return user;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    // Errors thrown from authorize() (like "RateLimited") are redirected to
    // this page as ?error=<message>. Without it, NextAuth would show its own
    // generic error screen instead of our login page.
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, add user.id (and verified status) to the token
      if (user) {
        token.id = user.id;
        token.emailVerified = Boolean(user.emailVerified);
        token.sessionVersion = user.sessionVersion ?? 0;
        return token;
      }

      if (!token.id) return token;

      // JWT sessions have no server-side record to delete, so revocation
      // works by comparing the sessionVersion baked into this token against
      // the user's current one. A password reset bumps the DB value, which
      // makes every token issued before it fail here. Throwing (rather than
      // returning null) is what NextAuth v4 needs to clear the cookie:
      // useSession() then reports "unauthenticated" and getServerSession()
      // returns null, so API routes reject the request too.
      // Tokens issued before this field existed count as version 0, so
      // deploying this doesn't log anyone out.
      //
      // A database failure is NOT a revocation: any error thrown from this
      // callback clears the session cookie, so a brief Neon timeout would
      // sign every active user out. On infrastructure errors we keep the
      // token as-is instead (revocations take effect again once the
      // database is reachable).
      let dbUser;
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true, emailVerified: true, sessionVersion: true, deletedAt: true },
        });
      } catch (err) {
        console.error("Session check failed; keeping existing session:", err);
        Sentry.captureException(err);
        return token;
      }
      if (!dbUser || dbUser.deletedAt || dbUser.sessionVersion !== (token.sessionVersion ?? 0)) {
        throw new Error("Session revoked");
      }

      // The settings page calls useSession().update() after a successful
      // profile save. Without this, the JWT (and therefore the session)
      // would keep showing the old name/email until the next full login.
      // Also refresh whenever the token still says "unverified": a user can
      // verify in another tab/browser, or a client-side refresh can no-op,
      // and this lets the stale JWT heal itself on the next session fetch.
      if (trigger === "update" || !token.emailVerified) {
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.emailVerified = Boolean(dbUser.emailVerified);
      }
      return token;
    },
    async session({ session, token }) {
      // Copy the user.id from the token into the session
      if (session?.user && token?.id) {
        session.user.id = token.id;
        session.user.emailVerified = Boolean(token.emailVerified);
      }
      return session;
    },
  },
};