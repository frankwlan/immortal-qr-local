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
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, add user.id to the token
      if (user) token.id = user.id;

      // The settings page calls useSession().update() after a successful
      // profile save. Without this, the JWT (and therefore the session)
      // would keep showing the old name/email until the next full login.
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true },
        });
        if (dbUser) {
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Copy the user.id from the token into the session
      if (session?.user && token?.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};