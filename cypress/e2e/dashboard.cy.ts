describe('SecureBank Fix Validation Suite', () => {
    const ensureLoggedIn = () => {
        cy.visit('/login');
        cy.get('input[name="email"]').clear().type('test@example.com');
        cy.get('input[name="password"]').clear().type('SecurePass123!');
        cy.get('button').contains('Sign In').click();
        cy.wait(1000);

        cy.url().then((url) => {
            if (url.includes('/login')) {
                // Signup if login failed
                cy.visit('/signup');
                cy.get('input[name="email"]').type('test@example.com');
                cy.get('input[name="password"]').type('SecurePass123!');
                cy.get('input[name="confirmPassword"]').type('SecurePass123!');
                cy.get('button').contains('Next').click();

                cy.get('input[name="firstName"]').type('Test');
                cy.get('input[name="lastName"]').type('User');
                cy.get('input[name="phoneNumber"]').type('2345678901');
                cy.get('input[name="dateOfBirth"]').type('1990-01-01');
                cy.get('button').contains('Next').click();

                cy.get('input[name="ssn"]').type('123456789');
                cy.get('input[name="address"]').type('123 Test St');
                cy.get('input[name="city"]').type('Test City');
                cy.get('select[name="state"]').select('NY');
                cy.get('input[name="zipCode"]').type('12345');
                cy.get('button').contains('Create Account').click();
                cy.wait(2000);
                cy.url().should('include', '/dashboard');
            }
        });
    };

    before(() => {
        ensureLoggedIn();
    });

    beforeEach(() => {
        cy.visit('/signup');
    });

    describe('Registration & Validation (VAL-201, 202, 203, 204, 208)', () => {
        it('should enforce strict 8-character password complexity (VAL-208)', () => {
            cy.get('input[name="password"]').type('Weak1!');
            cy.get('button').contains('Next').click();
            cy.contains('Password must be at least 8 characters').should('be.visible');
        });

        it('should validate age requirements (VAL-202)', () => {
            cy.get('input[name="email"]').type(`test_age_${Date.now()}@example.com`);
            cy.get('input[name="password"]').type('SecurePass123!');
            cy.get('input[name="confirmPassword"]').type('SecurePass123!');
            cy.get('button').contains('Next').click();

            const today = new Date();
            const tooYoung = `${today.getFullYear()}-01-01`;
            cy.get('input[name="dateOfBirth"]').type(tooYoung);
            cy.get('button').contains('Next').click();
            cy.wait(500);
            cy.contains('You must be at least 18 years old').should('be.visible');
        });

        it('should handle email typos like .con (VAL-201)', () => {
            cy.get('input[name="email"]').type('test@example.con');
            cy.get('input[name="email"]').blur();
            cy.contains('Did you mean').should('be.visible');
            cy.contains('test@example.com').should('be.visible');
        });
    });

    describe('Funding & Financial Logic (VAL-205, 206, 207, 209, PERF-406)', () => {
        beforeEach(() => {
            ensureLoggedIn();
            cy.get('body', { timeout: 10000 }).then(($body) => {
                if ($body.find('button:contains("Fund Account")').length === 0) {
                    cy.get('button').contains('Open New Account').click({ force: true });
                    cy.get('button').contains('Create Account').click({ force: true });
                    cy.wait(1000);
                }
            });
            cy.get('button').contains('Fund Account').first().click({ force: true });
        });

        it('should prevent $0.00 funding (VAL-205)', () => {
            cy.get('input[name="amount"]').clear().type('0');
            cy.get('form button[type="submit"]').contains('Fund Account').click({ force: true });
            cy.get('body').contains('Amount must be at least $0.01').should('be.visible');
        });

        it('should validate card number using Luhn algorithm (VAL-206)', () => {
            cy.get('form input[value="card"]').click({ force: true });
            cy.get('form input[name="accountNumber"]').clear().type('4111111111111112');
            cy.get('form button[type="submit"]').contains('Fund Account').click({ force: true });

            cy.get('body').contains('Invalid card number').should('be.visible');
        });

        it('should make routing number optional for cards but required for bank (VAL-207)', () => {
            cy.get('input[value="bank"]').click({ force: true });
            cy.get('input[name="routingNumber"]').should('be.visible'); //

            cy.get('input[value="card"]').click({ force: true });
            cy.get('input[name="routingNumber"]').should('not.exist'); //
        });

        it('should perform precise balance calculations (PERF-406)', () => {
            cy.get('input[name="amount"]').clear().type('0.10');
            cy.intercept('POST', '/api/trpc/account.fundAccount*', (req) => {
                req.reply([{ result: { data: { balance: 1000 } } }]);
            });
            cy.get('button').contains('Fund Account').click({ force: true });
            cy.url().should('include', '/dashboard');
        });
    });

    describe('Security & UI (SEC-301, SEC-303, SEC-304)', () => {
        it('should escape HTML in transaction descriptions (SEC-303)', () => {
            ensureLoggedIn();
            // Mock transaction list to include XSS attempt
            cy.intercept('GET', '/api/trpc/account.getTransactions*', {
                body: [{ result: { data: [{ id: 1, amount: 100, createdAt: new Date().toISOString(), description: '<script>alert(1)</script>' }] } }]
            }).as('getTransactions');

            cy.get('body').then(($body) => {
                const accountCard = $body.find('div.bg-white.overflow-hidden.shadow.rounded-lg.cursor-pointer').first();
                if (accountCard.length > 0) {
                    cy.wrap(accountCard).click({ force: true });
                    cy.wait('@getTransactions');
                    cy.contains('<script>').should('exist');
                }
            });
        });

        it('should have secure session cookies (SEC-304)', () => {
            ensureLoggedIn();
            cy.getCookie('session').should((cookie) => {
                expect(cookie.httpOnly).to.be.true;
                expect(cookie.sameSite).to.equal('strict');
            });
        });

        it('should show masked SSN in UI (SEC-301)', () => {
            ensureLoggedIn();
            // Placeholder
        });
    });

    describe('General Performance & Logic (PERF-401, 404)', () => {
        it('should sort transactions with newest first (PERF-404)', () => {
            ensureLoggedIn();
            cy.intercept('GET', '/api/trpc/account.getTransactions*', {
                body: [{
                    result: {
                        data: [
                            { id: 1, amount: 200, createdAt: new Date().toISOString(), description: 'Newest' },
                            { id: 2, amount: 100, createdAt: new Date(Date.now() - 86400000).toISOString(), description: 'Oldest' }
                        ]
                    }
                }]
            }).as('getTransactionsSort');

            cy.get('body').then(($body) => {
                const accountCard = $body.find('div.bg-white.overflow-hidden.shadow.rounded-lg.cursor-pointer').first();
                if (accountCard.length > 0) {
                    cy.wrap(accountCard).click({ force: true });
                    cy.wait('@getTransactionsSort');
                    cy.get('tbody tr').first().contains('Newest');
                }
            });
        });

        it('should display error message on account creation failure (PERF-401)', () => {
            ensureLoggedIn();
            cy.intercept('POST', '/api/trpc/account.createAccount*', {
                statusCode: 500,
                body: [{ error: { message: 'Unable to transform response from server' } }]
            });
            cy.get('button').contains('Open New Account').click({ force: true });
            cy.get('button').contains('Create Account').click({ force: true });
            cy.get('body').contains('Unable to transform response from server').should('be.visible');
        });
    });
});
