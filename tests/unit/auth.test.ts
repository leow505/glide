// tests/unit/auth.test.ts
import { authRouter } from '../../server/routers/auth';
import { db } from '../../lib/db';

const mockGet = jest.fn();
jest.mock('../../lib/db', () => ({
    db: {
        select: jest.fn(() => ({
            from: jest.fn(() => ({
                where: jest.fn(() => ({ get: mockGet })),
            })),
        })),
        insert: jest.fn(() => ({
            values: jest.fn(),
        })),
    },
}));

describe('Auth Router Validation Tests', () => {
    const caller = authRouter.createCaller({ user: null, req: {} as any, res: { setHeader: jest.fn() } as any });

    const validInput = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+11234567890',
        dateOfBirth: '2000-01-01',
        ssn: '123456789',
        address: '123 Main St',
        city: 'Example',
        state: 'NY',
        zipCode: '12345',
    };

    describe('VAL-208 (Weak Password)', () => {
        it('should reject passwords shorter than 8 characters', async () => {
            let threw = false;
            try {
                await caller.signup({ ...validInput, password: 'Pass1!7' });
            } catch (err: any) {
                threw = true;
                expect(err.message).toContain('Password must be at least 8 characters');
            }
            expect(threw).toBe(true);
        });

        it('should accept a valid 8-character password', async () => {
            mockGet.mockReset()
                .mockResolvedValueOnce(null) // Mock 1: "Does user exist?"
                .mockResolvedValueOnce({ id: 1, email: 'test@example.com' }); // Mock 2: "Fetch new user"

            const result = await caller.signup({ ...validInput, password: 'Pass123!' });
            expect(result).toBeDefined();
        });
    });
});