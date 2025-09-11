import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

export const EmailSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
});

export const OTPVerifySchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  code: z.string().length(6).openapi({ example: '123456' }),
});

export const SuccessResponseSchema = z.object({
  message: z.string().openapi({ example: 'Operation completed successfully' }),
  success: z.boolean().openapi({ example: true }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: 'Something went wrong' }),
});

export const VerificationStatusSchema = z.object({
  emailVerified: z.boolean().openapi({ example: true }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
});

export const SignUpSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().min(8).openapi({ example: 'password123' }),
  name: z.string().openapi({ example: 'John Doe' }),
});

export const SignInSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().openapi({ example: 'password123' }),
});

export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string().openapi({ example: 'user_123' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: 'John Doe' }),
    image: z.string().nullable().openapi({ example: null }),
    emailVerified: z.boolean().openapi({ example: false }),
    createdAt: z.string().openapi({ example: '2024-01-01T00:00:00Z' }),
    updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00Z' }),
  }),
  session: z.object({
    id: z.string().openapi({ example: 'session_123' }),
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    expiresAt: z.string().openapi({ example: '2024-12-31T23:59:59Z' }),
  }),
});

export const testEmailRoute = createRoute({
  method: 'post',
  path: '/test-email',
  tags: ['Email'],
  summary: 'Send test email with verification code',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EmailSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ example: 'Test email sent successfully!' }),
            code: z.string().openapi({ example: '123456' }),
          }),
        },
      },
      description: 'Test email sent successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Failed to send email',
    },
  },
});

export const verifyOTPRoute = createRoute({
  method: 'post',
  path: '/api/verify-otp',
  tags: ['Authentication'],
  summary: 'Verify OTP code',
  request: {
    body: {
      content: {
        'application/json': {
          schema: OTPVerifySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: 'Email verified successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid or expired verification code',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

export const resendOTPRoute = createRoute({
  method: 'post',
  path: '/api/resend-otp',
  tags: ['Authentication'],
  summary: 'Resend OTP verification code',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EmailSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: 'Verification code resent successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Email already verified or user not found',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'User not found',
    },
    429: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Rate limit exceeded',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

export const verificationStatusRoute = createRoute({
  method: 'get',
  path: '/api/verification-status/{email}',
  tags: ['Authentication'],
  summary: 'Check email verification status',
  request: {
    params: z.object({
      email: z.string().email().openapi({ example: 'user@example.com' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: VerificationStatusSchema,
        },
      },
      description: 'Verification status retrieved',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Email is required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'User not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

export const signUpRoute = createRoute({
  method: "post",
  path: "/api/auth/sign-up",
  tags: ["Authentication"],
  summary: "Sign up a new user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignUpSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
      description: "User created and signed in successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid input or user already exists",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});

export const signInRoute = createRoute({
  method: "post",
  path: "/api/auth/sign-in",
  tags: ["Authentication"],
  summary: "Sign in an existing user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignInSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
      description: "User signed in successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid credentials",
    },
    500: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Internal server error",
    },
  },
});
