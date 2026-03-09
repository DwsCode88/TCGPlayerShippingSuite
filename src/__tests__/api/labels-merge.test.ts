/**
 * Tests for POST /api/labels/merge (Hono route)
 */

// Use inline bytes — FAKE_PDF_BYTES cannot be referenced inside jest.mock() due to TDZ
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([{}]),
      addPage: jest.fn(),
      getPageIndices: jest.fn().mockReturnValue([0]),
      save: jest.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
    }),
    load: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([{}]),
      getPageIndices: jest.fn().mockReturnValue([0]),
    }),
  },
}))

jest.mock('@/lib/admin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user123' }),
  },
  adminDb: {
    collection: jest.fn(),
  },
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
}))

import { app } from '@/app/api/[[...route]]/route'

const makeRequest = (urls: string[]) =>
  app.request('/api/labels/merge', {
    method: 'POST',
    body: JSON.stringify(urls),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer mock-token',
    },
  })

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()

  const { adminDb, adminAuth } = jest.requireMock('@/lib/admin')
  adminAuth.verifyIdToken.mockResolvedValue({ uid: 'user123' })
  adminDb.collection.mockReturnValue({
    doc: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn() }),
  })
})

describe('POST /api/labels/merge', () => {
  it('returns a merged PDF with correct Content-Type header', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
    const res = await makeRequest(['https://example.com/label1.pdf'])
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('skips a URL if its fetch response is not ok', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    const { PDFDocument } = jest.requireMock('pdf-lib')
    const res = await makeRequest(['https://bad.com/broken.pdf', 'https://ok.com/label.pdf'])
    expect(res.status).toBe(200)
    expect(PDFDocument.load).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on unexpected error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    const res = await makeRequest(['https://example.com/label.pdf'])
    expect(res.status).toBe(500)
  })
})
