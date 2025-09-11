import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { db } from "@/db/db";
import { verification, user } from "@/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { rateLimiter } from "hono-rate-limiter";
import { todos } from "@/routes/todos.routes";

const app = new Hono();

// Rate limiter for OTP endpoints - 5 requests per 15 minutes per IP
const otpRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: "draft-6",
  keyGenerator: (c) => {
    // Try to get real IP from various headers
    return c.req.header("cf-connecting-ip") || 
           c.req.header("x-forwarded-for") || 
           c.req.header("x-real-ip") ||
           "unknown";
  },
});

// Cleanup expired verification codes
async function cleanupExpiredVerifications() {
  try {
    await db.delete(verification)
      .where(lt(verification.expiresAt, new Date()));
    console.log(`Cleaned up expired verification codes`);
  } catch (error) {
    console.error('Error cleaning up expired verifications:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredVerifications, 60 * 60 * 1000);

app
  .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .route('/api/todos', todos)
  .get('/', (c) => {
    return c.text('Hello Hono!');
  })
  .post("/test-email", async (c) => {
    try {
      const { email } = await c.req.json();
      // Generate a random 6-digit code
      const testCode = Math.floor(100000 + Math.random() * 900000).toString();
      await sendVerificationEmail(email, testCode);
      return c.json({ message: "Test email sent successfully!", code: testCode });
    } catch (error) {
      return c.json({ error: "Failed to send test email" }, 500);
    }
  })
  .post("/api/verify-otp", async (c) => {
    try {
      const { email, code } = await c.req.json();
      
      if (!email || !code) {
        return c.json({ error: "Email and code are required" }, 400);
      }
      
      // Find valid verification code
      const verificationRecord = await db.select()
        .from(verification)
        .where(
          and(
            eq(verification.identifier, email),
            eq(verification.value, code),
            gt(verification.expiresAt, new Date())
          )
        )
        .limit(1);
      
      if (verificationRecord.length === 0) {
        return c.json({ error: "Invalid or expired verification code" }, 400);
      }
      
      // Update user to mark email as verified
      await db.update(user)
        .set({ emailVerified: true })
        .where(eq(user.email, email));
      
      // Clean up verification record
      await db.delete(verification)
        .where(eq(verification.identifier, email));
      
      return c.json({ 
        message: "Email verified successfully!",
        success: true 
      });
      
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: "Failed to verify code" }, 500);
    }
  })
  .post("/api/resend-otp", otpRateLimit, async (c) => {
    try {
      const { email } = await c.req.json();
      
      if (!email) {
        return c.json({ error: "Email is required" }, 400);
      }
      
      // Check if user exists and is not already verified
      const existingUser = await db.select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      
      if (existingUser.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      
      if (existingUser[0].emailVerified) {
        return c.json({ error: "Email already verified" }, 400);
      }
      
      // Generate new OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Clean up existing codes
      await db.delete(verification).where(eq(verification.identifier, email));
      
      // Store new code
      await db.insert(verification).values({
        id: crypto.randomUUID(),
        identifier: email,
        value: code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      
      // Send email
      await sendVerificationEmail(email, code);
      
      return c.json({ 
        message: "Verification code resent successfully!",
        success: true 
      });
      
    } catch (error) {
      console.error('Error resending OTP:', error);
      return c.json({ error: "Failed to resend verification code" }, 500);
    }
  })
  .get("/api/verification-status/:email", async (c) => {
    try {
      const email = c.req.param("email");
      
      if (!email) {
        return c.json({ error: "Email is required" }, 400);
      }
      
      const existingUser = await db.select({
        emailVerified: user.emailVerified
      })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      
      if (existingUser.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      
      return c.json({ 
        emailVerified: existingUser[0].emailVerified,
        email: email
      });
      
    } catch (error) {
      console.error('Error checking verification status:', error);
      return c.json({ error: "Failed to check verification status" }, 500);
    }
  })

export default app;
