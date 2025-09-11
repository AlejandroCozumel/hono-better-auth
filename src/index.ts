import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { db } from "@/db/db";
import { verification, user } from "@/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { rateLimiter } from "hono-rate-limiter";
import { todos } from "@/routes/todos.routes";
import { createOpenAPIApp } from "@/lib/openapi";
import { testEmailRoute, verifyOTPRoute, resendOTPRoute, verificationStatusRoute, signUpRoute, signInRoute } from "@/schemas/auth.schemas";

// Create OpenAPI app for documentation
const app = createOpenAPIApp();

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

// Register all OpenAPI routes
app.openapi(signUpRoute, async (c) => {
  const { email, password, name } = c.req.valid('json');
  
  try {
    const response = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: c.req.raw.headers,
    });
    
    if (!response.token) {
      return c.json({ error: 'Failed to create user session' }, 400);
    }
    
    return c.json({
      user: {
        ...response.user,
        image: response.user.image || null,
        createdAt: response.user.createdAt.toISOString(),
        updatedAt: response.user.updatedAt.toISOString(),
      },
      session: {
        id: response.user.id,
        token: response.token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      }
    }, 200);
  } catch (error: any) {
    console.error('Sign up error:', error);
    
    // Handle Better Auth specific errors
    if (error.statusCode === 400) {
      return c.json({ error: 'User already exists or invalid input' }, 400);
    }
    
    // Handle other Better Auth errors
    if (error.statusCode && error.body?.message) {
      return c.json({ error: error.body.message }, error.statusCode);
    }
    
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.openapi(signInRoute, async (c) => {
  const { email, password } = c.req.valid('json');
  
  try {
    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: c.req.raw.headers,
    });
    
    if (!response.token) {
      return c.json({ error: 'Invalid credentials' }, 400);
    }
    
    return c.json({
      user: {
        ...response.user,
        image: response.user.image || null,
        createdAt: response.user.createdAt.toISOString(),
        updatedAt: response.user.updatedAt.toISOString(),
      },
      session: {
        id: response.user.id,
        token: response.token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      }
    }, 200);
  } catch (error: any) {
    console.error('Sign in error:', error);
    
    // Handle Better Auth specific errors
    if (error.statusCode === 401 || error.status === 'UNAUTHORIZED') {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    
    // Handle other Better Auth errors with specific messages
    if (error.statusCode && error.body?.message) {
      return c.json({ error: error.body.message }, error.statusCode);
    }
    
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.openapi(testEmailRoute, async (c) => {
  try {
    const { email } = c.req.valid('json');
    // Generate a random 6-digit code
    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    await sendVerificationEmail(email, testCode);
    return c.json({ message: "Test email sent successfully!", code: testCode }, 200);
  } catch (error) {
    return c.json({ error: "Failed to send test email" }, 500);
  }
});

app.openapi(verifyOTPRoute, async (c) => {
  try {
    const { email, code } = c.req.valid('json');
    
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
    }, 200);
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return c.json({ error: "Failed to verify code" }, 500);
  }
});

app.use('/api/resend-otp', otpRateLimit);
app.openapi(resendOTPRoute, async (c) => {
  try {
    const { email } = c.req.valid('json');
    
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
    }, 200);
    
  } catch (error) {
    console.error('Error resending OTP:', error);
    return c.json({ error: "Failed to resend verification code" }, 500);
  }
});

app.openapi(verificationStatusRoute, async (c) => {
  try {
    const { email } = c.req.valid('param');
    
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
    }, 200);
    
  } catch (error) {
    console.error('Error checking verification status:', error);
    return c.json({ error: "Failed to check verification status" }, 500);
  }
});

// Custom doc route with proper security schemes
app.get('/doc-custom', (c) => {
  // Get the auto-generated spec and add security schemes
  const baseSpec = app.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      title: 'Todo API',
      version: '1.0.0',
      description: 'A simple Todo API built with Hono and Better Auth',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Development server' }],
  });

  // Add security schemes to the auto-generated spec
  const customSpec = {
    ...baseSpec,
    components: {
      ...baseSpec.components,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Bearer token from Better Auth'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  };

  return c.json(customSpec);
});

// Official API Documentation endpoint - Custom Swagger UI with Bearer auth support
app.get('/docs', (c) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/doc-custom',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone
      ],
      persistAuthorization: true,
      tryItOutEnabled: true
    });
  </script>
</body>
</html>`;
  return c.html(html);
});

// Mount todos routes
app.route('/api/todos', todos);

// Regular routes
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.get('/', (c) => {
  return c.text('Hello Hono!');
})

export default app;
