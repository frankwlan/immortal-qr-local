import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "../lib/prisma";

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
      async authorize(credentials) {
        const { email, password } = credentials || {};
        if (!email || !password) return null;
        const normalizedEmail = email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user || !user.passwordHash) return null;
        const ok = await compare(password, user.passwordHash);
        return ok ? user : null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
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
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: { name: true, email: true, emailVerified: true, sessionVersion: true },
      });
      if (!dbUser || dbUser.sessionVersion !== (token.sessionVersion ?? 0)) {
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