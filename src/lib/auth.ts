import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { sendVerificationEmail, sendPasswordResetEmail } from './email';
import { db } from "@/db/db";
import { verification } from "@/db/schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "mysql", "sqlite"
  }),
  secret: process.env.BETTER_AUTH_SECRET as string,
  baseURL: process.env.BETTER_AUTH_URL as string,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false, // Don't auto sign in until email is verified
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Clean up any existing verification codes for this email
      await db.delete(verification).where(eq(verification.identifier, user.email));
      
      // Store the new verification code
      await db.insert(verification).values({
        id: crypto.randomUUID(),
        identifier: user.email,
        value: code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      });
      
      await sendVerificationEmail(user.email, code);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [openAPI()],
});
