/**
 * Base error class for all domain errors
 */
export class YouAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details);
  }
}

export class ConnectorError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTOR_ERROR', details);
  }
}

export class DatabaseError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class IndexError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'INDEX_ERROR', details);
  }
}

export class AIError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'AI_ERROR', details);
  }
}

export class RateLimitError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', details);
  }
}

export class ValidationError extends YouAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

