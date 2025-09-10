import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

const app = new Hono();

app
  .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .get("/", (c) => {
    return c.text("Hello Hono! Better Auth with Resend is ready!");
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

export default app;
