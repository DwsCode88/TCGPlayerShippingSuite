import { NextRequest } from 'next/server'

const FAKE_PDF_BYTES = new Uint8Array([37, 80, 68, 70]) // %PDF magic bytes

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    create: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([{}]),
      addPage: jest.fn(),
      getPageIndices: jest.fn().mockReturnValue([0]),
      save: jest.fn().mockResolvedValue(FAKE_PDF_BYTES),
    }),
    load: jest.fn().mockResolvedValue({
      copyPages: jest.fn().mockResolvedValue([{}]),
      getPageIndices: jest.fn().mockReturnValue([0]),
    }),
  },
}))

const makeRequest = (urls: string[]) =>
  new NextRequest('http://localhost/api/labels/merge', {
    method: 'POST',
    body: JSON.stringify(urls),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('POST /api/labels/merge', () => {
  it('returns a merged PDF with correct Content-Type header', async () => {
    const { POST } = await import('@/app/api/labels/merge/route')
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
    const res = await POST(makeRequest(['https://example.com/label1.pdf']))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('skips a URL if its fetch response is not ok', async () => {
    jest.clearAllMocks()
    const { POST } = await import('@/app/api/labels/merge/route')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    const { PDFDocument } = jest.requireMock('pdf-lib')
    const res = await POST(
      makeRequest(['https://bad.com/broken.pdf', 'https://ok.com/label.pdf'])
    )
    expect(res.status).toBe(200)
    expect(PDFDocument.load).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on unexpected error', async () => {
    const { POST } = await import('@/app/api/labels/merge/route')
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    const res = await POST(makeRequest(['https://example.com/label.pdf']))
    expect(res.status).toBe(500)
  })
})
