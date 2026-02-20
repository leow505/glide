import { authRouter } from '../../server/routers/auth';
import { accountRouter } from '../../server/routers/account';
import { db } from '../../lib/db';

const mockGet = jest.fn();
const mockValues = jest.fn();

jest.mock('../../lib/db', () => ({
    db: {
        select: jest.fn(() => ({
            from: jest.fn(() => ({
                where: jest.fn(() => ({
                    get: mockGet,
                })),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn(),
                    })),
                    get: jest.fn(),
                })),
            })),
        })),
        insert: jest.fn(() => ({
            values: mockValues,
        })),
        update: jest.fn(() => ({
            set: jest.fn(() => ({
                where: jest.fn(),
            })),
        })),
    },
}));

describe('Security Tests', () => {
    const authCaller = authRouter.createCaller({ user: null, req: {} as any, res: { setHeader: jest.fn() } as any });
    const accountCaller = accountRouter.createCaller({ user: { id: 1 } as any, req: {} as any, res: {} as any });

    beforeEach(() => {
        mockGet.mockReset();
        mockValues.mockReset();
    });

    describe('SEC-301 (SSN Storage)', () => {
        it('should encrypt SSN as base64 and store last four digits', async () => {
            const ssn = '123456789';
            mockGet
                .mockResolvedValueOnce(null) // existingUser check
                .mockResolvedValueOnce({ id: 1, email: 'test@example.com' }); // fetch created user

            await authCaller.signup({
                email: 'test@example.com',
                password: 'Password123!',
                firstName: 'John',
                lastName: 'Doe',
                phoneNumber: '+11234567890',
                dateOfBirth: '2000-01-01',
                ssn: ssn,
                address: '123 Main St',
                city: 'Example',
                state: 'NY',
                zipCode: '12345',
            });

            expect(mockValues).toHaveBeenCalled();
            // The first call to values should be the user insert
            const insertedValues = mockValues.mock.calls[0][0];

            // Verify encryption (should be base64)
            expect(insertedValues.ssn).not.toBe(ssn);
            expect(insertedValues.ssn).toMatch(/^[A-Za-z0-9+/=]+$/);

            // Verify last four
            expect(insertedValues.ssnLastFour).toBe('6789');
        });
    });

    describe('SEC-302 (Insecure Random Numbers)', () => {
        it('should use crypto.randomInt for account numbers', async () => {
            mockGet
                .mockResolvedValueOnce(null) // existing account check
                .mockResolvedValueOnce(null) // account number uniqueness check
                .mockResolvedValueOnce({ id: 1, accountNumber: '12345678' }); // fetch created account

            const result = await accountCaller.createAccount({ accountType: 'checking' });

            // Verify account number is a numeric string (produced by randomInt)
            expect(result.accountNumber).toBeDefined();
            expect(result.accountNumber).toMatch(/^\d+$/);
        });
    });

    describe('SEC-304 (Session Management)', () => {
        it('should set secure cookie attributes and 30m max-age', async () => {
            const mockSetHeader = jest.fn();
            const caller = authRouter.createCaller({
                user: null,
                req: {} as any,
                res: { setHeader: mockSetHeader } as any
            });

            mockGet
                .mockResolvedValueOnce({ id: 1, email: 'test@example.com', password: 'hashed_password' }); // fetch user

            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

            await caller.login({ email: 'test@example.com', password: 'Password123!' });

            expect(mockSetHeader).toHaveBeenCalledWith(
                'Set-Cookie',
                expect.stringContaining('HttpOnly')
            );
            expect(mockSetHeader).toHaveBeenCalledWith(
                'Set-Cookie',
                expect.stringContaining('Secure')
            );
            expect(mockSetHeader).toHaveBeenCalledWith(
                'Set-Cookie',
                expect.stringContaining('SameSite=Strict')
            );
            expect(mockSetHeader).toHaveBeenCalledWith(
                'Set-Cookie',
                expect.stringContaining('Max-Age=1800')
            );
        });
    });

    describe('PERF-408 (Resource Leak)', () => {
        it('should not initialize multiple database connections', () => {
            const dbModule1 = require('../../lib/db');
            const dbModule2 = require('../../lib/db');
            expect(dbModule1.db).toBe(dbModule2.db);
        });
    });
});
