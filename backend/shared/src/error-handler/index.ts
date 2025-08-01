// Base application error class
export class AppError extends Error {
  public status?: string;
  public statusCode: number;
  public isOperational: boolean;
  public details?: unknown;
  public code: string;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    details?: unknown,
    code = "INTERNAL_SERVER_ERROR",
    status: string | undefined = "error"
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
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
  constructor(
    message = "Authentication failed",
    status?: string,
    details?: unknown
  ) {
    super(message, 401, true, details, "AUTH_ERROR", status);
  }
}

// Authorization error
export class AuthorizationError extends AppError {
  constructor(message = "Not authorized", status?: string, details?: unknown) {
    super(message, 403, true, details, "AUTHORIZATION_ERROR", status);
  }
}

// Database error
export class DatabaseError extends AppError {
  constructor(message = "Database error", status?: string, details?: unknown) {
    super(message, 500, true, details, "DATABASE_ERROR", status);
  }
}

// Validation error
export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    status?: string,
    details?: unknown
  ) {
    super(message, 400, true, details, "VALIDATION_ERROR", status);
  }
}

// Not found error
export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    status?: string,
    details?: unknown
  ) {
    super(message, 404, true, details, "NOT_FOUND_ERROR", status);
  }
}

// Not found error
export class ConflictError extends AppError {
  constructor(
    message = "Resource already exists",
    status?: string,
    details?: unknown
  ) {
    super(message, 409, true, details, "CONFLICT_ERROR", status);
  }
}

// Rate limit error
export class RateLimitError extends AppError {
  constructor(
    message = "Too many requests. Please try again after some time.",
    details?: unknown,
    status?: string
  ) {
    super(message, 429, true, details, "TOO_MANY_REQUEST_ERROR", status);
  }
}

// Internal server error
export class InternalServerError extends AppError {
  constructor(
    message = "Internal server error",
    status?: string,
    details?: unknown
  ) {
    super(message, 500, true, details, "INTERNAL_SERVER_ERROR", status);
  }
}

// Internal server error
export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Service temporarily unavailable",
    status?: string,
    details?: unknown
  ) {
    super(message, 503, true, details, "SERVICE_UNAVAILABLE_ERROR", status);
  }
}
