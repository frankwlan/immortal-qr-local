import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import prisma from "../lib/prisma";

export const authOptions = {
 adapter: PrismaAdapter(prisma),
 session: { strategy: "database" },
 providers: [
   // Email/Password via Credentials (MVP)
   Credentials({
     name: "Credentials",
     credentials: {
       email: { label: "Email", type: "text" },
       password: { label: "Password", type: "password" },
     },
     async authorize(credentials) {
       const email = credentials?.email?.trim().toLowerCase();
       const password = credentials?.password;
       if (!email || !password) return null;

       const user = await prisma.user.findUnique({ where: { email } });
       if (!user || !user.passwordHash) return null;

       const ok = await compare(password, user.passwordHash);
       return ok ? user : null;
     },
   }),

   // Optional social providers (enable if env vars present)
   ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
     ? [
         GoogleProvider({
           clientId: process.env.GOOGLE_CLIENT_ID,
           clientSecret: process.env.GOOGLE_CLIENT_SECRET,
         }),
       ]
     : []),
   ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
     ? [
         GitHubProvider({
           clientId: process.env.GITHUB_ID,
           clientSecret: process.env.GITHUB_SECRET,
         }),
       ]
     : []),
 ],
 pages: {
   signIn: "/",
 },
 callbacks: {
   async jwt({ token, user }) {
     if (user) {
       token.id = user.id;
       token.sub = user.id;
     }
     return token;
   },
   async session({ session, token }) {
     const userId = token?.id ?? token?.sub;
     if (session?.user && userId) {
       session.user.id = userId;
     }
     return session;
   },
 },
};