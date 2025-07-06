// Base application error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: unknown;
  public code: string;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    details?: unknown,
    code: string = "INTERNAL_SERVER_ERROR"
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.code = code;

    if (
      "captureStackTrace" in Error &&
      typeof Error.captureStackTrace === "function"
    ) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Authentication error
export class AuthError extends AppError {
  constructor(message = "Authentication failed", details?: unknown) {
    super(message, 401, true, details, "AUTH_ERROR");
  }
}

// Authorization error
export class AuthorizationError extends AppError {
  constructor(message = "Not authorized", details?: unknown) {
    super(message, 403, true, details, "AUTHORIZATION_ERROR");
  }
}

// Database error
export class DatabaseError extends AppError {
  constructor(message = "Database error", details?: unknown) {
    super(message, 500, true, details, "DATABASE_ERROR");
  }
}

// Validation error
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, true, details, "VALIDATION_ERROR");
  }
}

// Not found error
export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(message, 404, true, details, "NOT_FOUND_ERROR");
  }
}

// Internal server error
export class InternalServerError extends AppError {
  constructor(message = "Internal server error", details?: unknown) {
    super(message, 500, true, details, "INTERNAL_SERVER_ERROR");
  }
}

// Internal server error
export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", details?: unknown) {
    super(message, 503, true, details, "SERVICE_UNAVAILABLE_ERROR");
  }
}
