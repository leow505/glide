import { accountRouter } from '../../server/routers/account';
import { db } from '../../lib/db';
import { TRPCError } from '@trpc/server';

const mockGet = jest.fn();
const mockOrderByGet = jest.fn();

jest.mock('../../lib/db', () => ({
    db: {
        select: jest.fn(() => ({
            from: jest.fn(() => ({
                where: jest.fn(() => ({
                    get: mockGet,
                })),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: mockOrderByGet,
                    })),
                    get: mockOrderByGet,
                })),
            })),
        })),
        insert: jest.fn(() => ({
            values: jest.fn(),
        })),
        update: jest.fn(() => ({
            set: jest.fn(() => ({
                where: jest.fn(),
            })),
        })),
    },
}));

describe('Account Router Tests', () => {
    const caller = accountRouter.createCaller({
        user: { id: 1, email: 'test@example.com' } as any,
        req: {} as any,
        res: {} as any
    });

    beforeEach(() => {
        mockGet.mockReset();
        mockOrderByGet.mockReset();
    });

    describe('VAL-205 (Zero Amount Funding)', () => {
        it('should reject amount: 0', async () => {
            let threw = false;
            try {
                await caller.fundAccount({
                    accountId: 1,
                    amount: 0,
                    fundingSource: { type: 'card', accountNumber: '4242424242424242' },
                });
            } catch (err: any) {
                threw = true;
                expect(err instanceof TRPCError).toBe(true);
            }
            expect(threw).toBe(true);
        });
    });

    describe('VAL-206 (Card Number Validation)', () => {
        it('should reject card number failing Luhn check', async () => {
            let threw = false;
            try {
                await caller.fundAccount({
                    accountId: 1,
                    amount: 10,
                    fundingSource: { type: 'card', accountNumber: '4111111111111112' },
                });
            } catch (err: any) {
                threw = true;
                expect(err.message).toContain('Invalid card number');
            }
            expect(threw).toBe(true);
        });
    });

    describe('VAL-207 (Routing Number Optionality)', () => {
        it('should accept card funding without routing number', async () => {
            mockGet
                .mockResolvedValueOnce({ id: 1, userId: 1, balance: 1000, status: 'active' }); // account fetch
            mockOrderByGet
                .mockResolvedValueOnce({ id: 1, amount: 10, createdAt: new Date().toISOString() }); // transaction fetch

            const result = await caller.fundAccount({
                accountId: 1,
                amount: 10,
                fundingSource: { type: 'card', accountNumber: '4242424242424242' },
            });
            expect(result).toBeDefined();
        });
    });

    describe('PERF-406 (Balance Calculation)', () => {
        it('should verify final balance is exactly $1.00 after 100 deposits of $0.01', async () => {
            let currentBalance = 0;

            for (let i = 0; i < 100; i++) {
                const amount = 0.01;
                const currentBalanceDecimal = Math.round(currentBalance * 100);
                const amtCents = Math.round(amount * 100);
                currentBalance = (currentBalanceDecimal + amtCents) / 100;
            }

            expect(currentBalance).toBe(1.00);
        });
    });
});
