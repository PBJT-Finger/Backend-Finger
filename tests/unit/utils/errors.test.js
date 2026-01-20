// tests/unit/utils/errors.test.js - Error Classes Unit Tests
const {
    AppError,
    ValidationError,
    AuthenticationError,
    NotFoundError,
    ConflictError
} = require('../../../src/utils/errors');
const { HTTP_STATUS } = require('../../../src/constants/app');

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create error with message and status code', () => {
            const error = new AppError('Test error', 500);

            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(true);
            expect(error.timestamp).toBeDefined();
        });

        it('should serialize to JSON correctly', () => {
            const error = new AppError('Test error', 400);
            const json = error.toJSON();

            expect(json.success).toBe(false);
            expect(json.message).toBe('Test error');
            expect(json.statusCode).toBe(400);
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('ValidationError', () => {
        it('should create validation error with 400 status', () => {
            const errors = [
                { field: 'email', message: 'Invalid email' },
                { field: 'password', message: 'Too short' }
            ];
            const error = new ValidationError('Validation failed', errors);

            expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
            expect(error.errors).toEqual(errors);
            expect(error.name).toBe('ValidationError');
        });

        it('should include errors in JSON', () => {
            const errors = [{ field: 'name', message: 'Required' }];
            const error = new ValidationError('Invalid input', errors);
            const json = error.toJSON();

            expect(json.errors).toEqual(errors);
        });
    });

    describe('AuthenticationError', () => {
        it('should create auth error with 401 status', () => {
            const error = new AuthenticationError();

            expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
            expect(error.message).toBe('Authentication failed');
            expect(error.name).toBe('AuthenticationError');
        });

        it('should accept custom message', () => {
            const error = new AuthenticationError('Invalid token');

            expect(error.message).toBe('Invalid token');
        });
    });

    describe('NotFoundError', () => {
        it('should create not found error with 404 status', () => {
            const error = new NotFoundError('User');

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.message).toBe('User not found');
            expect(error.name).toBe('NotFoundError');
        });
    });

    describe('ConflictError', () => {
        it('should create conflict error with 409 status', () => {
            const error = new ConflictError('Email already exists');

            expect(error.statusCode).toBe(HTTP_STATUS.CONFLICT);
            expect(error.message).toBe('Email already exists');
            expect(error.name).toBe('ConflictError');
        });
    });
});
