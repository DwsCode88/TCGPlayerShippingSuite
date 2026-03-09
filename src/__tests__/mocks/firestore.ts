const CURRENT_MONTH = new Date().toISOString().slice(0, 7)

export const BASE_FROM_ADDRESS = {
  name: 'Test Seller',
  street1: '123 Main St',
  city: 'Anytown',
  state: 'NY',
  zip: '10001',
}

export const BASE_USER_SETTINGS = {
  easypostApiKey: 'test-key',
  fromAddress: BASE_FROM_ADDRESS,
  envelopeCost: 0.1,
  shieldCost: 0.1,
  pennySleeveCost: 0.02,
  topLoaderCost: 0.12,
}

// Admin SDK snapshots: `exists` is a boolean, not a function
export const mockProUser = {
  exists: true,
  data: () => ({ ...BASE_USER_SETTINGS, isPro: true }),
}

export const mockFreeUser = {
  exists: true,
  data: () => ({ ...BASE_USER_SETTINGS, isPro: false }),
}

export const mockPlanProUser = {
  exists: true,
  data: () => ({ ...BASE_USER_SETTINGS, plan: 'pro' }),
}

export const mockNoSettingsUser = {
  exists: true,
  data: () => ({}),
}

export const mockUsageUnderLimit = {
  exists: true,
  data: () => ({ month: CURRENT_MONTH, count: 5 }),
}

export const mockUsageAtLimit = {
  exists: true,
  data: () => ({ month: CURRENT_MONTH, count: 10 }),
}

export const mockNoUsage = {
  exists: false,
  data: () => ({ count: 0, month: '' }),
}

export const mockEmptyDocs = {
  docs: [],
  forEach: jest.fn(),
}
