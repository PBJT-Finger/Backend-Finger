// Integration tests for Authentication Flow
// Tests login, logout, refresh token rotation, and token blacklist
const request = require('supertest');
const app = require('../../src/app');
const { Admin } = require('../../src/models');
const { isBlacklisted } = require('../../src/utils/tokenBlacklist');
const { generateTestUsername } = require('./setup');

describe('Authentication Flow Integration Tests', () => {
    let testAdmin;
    let accessToken;
    let refreshToken;
    const testPassword = 'TestPassword123!';

    // Create test admin before all tests
    beforeAll(async () => {
        const username = generateTestUsername('auth_test');

        testAdmin = await Admin.create({
            username,
            password_hash: testPassword, // Will be hashed by beforeCreate hook
            email: `${username}@test.com`,
            role: 'admin',
            is_active: true
        });

        console.log(`✅ Created test admin: ${testAdmin.username}`);
    }, 30000);

    // Cleanup test admin after all tests
    afterAll(async () => {
        if (testAdmin) {
            await Admin.destroy({ where: { id: testAdmin.id } });
            console.log(`🧹 Deleted test admin: ${testAdmin.username}`);
        }
    }, 30000);

    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testAdmin.username,
                    password: testPassword
                })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('success');
            expect(res.body.data).toHaveProperty('user');
            expect(res.body.data).toHaveProperty('tokens');
            expect(res.body.data.tokens).toHaveProperty('access_token');
            expect(res.body.data.tokens).toHaveProperty('refresh_token');
            expect(res.body.data.tokens.token_type).toBe('Bearer');

            // Save tokens for later tests
            accessToken = res.body.data.tokens.access_token;
            refreshToken = res.body.data.tokens.refresh_token;

            expect(accessToken).toBeTruthy();
            expect(refreshToken).toBeTruthy();
        });

        it('should fail with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testAdmin.username,
                    password: 'WrongPassword123!'
                })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/invalid|failed/i);
        });

        it('should fail with non-existent user', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent_user_xyz',
                    password: 'AnyPassword123!'
                })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
        });

        it('should fail with missing credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({})
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body.success).toBe(false);
        });
    });

    describe('Protected Routes with Token', () => {
        it('should access protected route with valid token', async () => {
            const res = await request(app)
                .get('/api/attendance')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect('Content-Type', /json/);

            // Should not be 401 Unauthorized
            expect(res.status).not.toBe(401);
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/attendance')
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/token.*required|access token/i);
        });

        it('should reject request with invalid token', async () => {
            const res = await request(app)
                .get('/api/attendance')
                .set('Authorization', 'Bearer invalid_token_here')
                .expect('Content-Type', /json/)
                .expect(403);

            expect(res.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/refresh (Token Rotation)', () => {
        let oldRefreshToken;
        let newAccessToken;
        let newRefreshToken;

        beforeAll(() => {
            oldRefreshToken = refreshToken;
        });

        it('should issue new tokens and blacklist old refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refresh_token: oldRefreshToken })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('tokens');
            expect(res.body.data.tokens).toHaveProperty('access_token');
            expect(res.body.data.tokens).toHaveProperty('refresh_token');

            newAccessToken = res.body.data.tokens.access_token;
            newRefreshToken = res.body.data.tokens.refresh_token;

            // New tokens should be different from old ones
            expect(newRefreshToken).not.toBe(oldRefreshToken);
            expect(newAccessToken).not.toBe(accessToken);

            // Update tokens for next tests
            accessToken = newAccessToken;
            refreshToken = newRefreshToken;
        });

        it('should verify old refresh token is blacklisted', async () => {
            const isOldBlacklisted = await isBlacklisted(oldRefreshToken);
            expect(isOldBlacklisted).toBe(true);
        });

        it('should reject reuse of old refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refresh_token: oldRefreshToken })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/revoked|blacklist/i);
        });

        it('should work with new refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refresh_token: newRefreshToken })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);

            // Update tokens again
            accessToken = res.body.data.tokens.access_token;
            refreshToken = res.body.data.tokens.refresh_token;
        });
    });

    describe('POST /api/auth/logout (Token Blacklist)', () => {
        let logoutAccessToken;
        let logoutRefreshToken;

        beforeAll(() => {
            logoutAccessToken = accessToken;
            logoutRefreshToken = refreshToken;
        });

        it('should blacklist tokens on logout', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${logoutAccessToken}`)
                .send({ refresh_token: logoutRefreshToken })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/logout|berhasil|invalidated/i);
        });

        it('should verify access token is blacklisted', async () => {
            const isAccessBlacklisted = await isBlacklisted(logoutAccessToken);
            expect(isAccessBlacklisted).toBe(true);
        });

        it('should verify refresh token is blacklisted', async () => {
            const isRefreshBlacklisted = await isBlacklisted(logoutRefreshToken);
            expect(isRefreshBlacklisted).toBe(true);
        });

        it('should reject blacklisted access token', async () => {
            const res = await request(app)
                .get('/api/attendance')
                .set('Authorization', `Bearer ${logoutAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/revoked|blacklist/i);
        });

        it('should reject blacklisted refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refresh_token: logoutRefreshToken })
                .expect('Content-Type', /json/)
                .expect(401);

            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/revoked|blacklist/i);
        });
    });
});
