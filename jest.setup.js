// jest.setup.js
require('@testing-library/jest-dom')

// Dummy env vars so module-level initializers (e.g. Stripe constructor) don't throw
process.env.STRIPE_SECRET_KEY = 'sk_test_jest_placeholder'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_jest_placeholder'
