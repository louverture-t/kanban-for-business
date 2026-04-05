import { GraphQLError } from 'graphql';

export class AuthenticationError extends GraphQLError {
  constructor(message = 'Not authenticated') {
    super(message, {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'Not authorized') {
    super(message, {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message = 'Invalid input') {
    super(message, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message = 'Resource not found') {
    super(message, {
      extensions: { code: 'NOT_FOUND' },
    });
  }
}
