import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { compare, hash } from "bcryptjs";
import prisma from "../lib/prisma";

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
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await compare(password, user.passwordHash);
        return ok ? user : null;
      },
    }),

    // Optional social providers (enable if env vars present)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [GitHubProvider({
          clientId: process.env.GITHUB_ID,
          clientSecret: process.env.GITHUB_SECRET,
        })]
      : []),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, add user.id to the token
      if (user) token.id = user.id;
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
  events: {
    // For simple email signups (register endpoint will hash & create)
  },
  adapter: {
    // Minimal DB adapter using Prisma client (simplified)
    // For MVP, rely on database session strategy and manual user create.
  },
};