import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { apiKey } = body;

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Missing API key' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.easypost.com/v2/addresses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        verify: [],
        address: {
          street1: '417 MONTGOMERY ST',
          city: 'SAN FRANCISCO',
          state: 'CA',
          zip: '94104',
          country: 'US',
        },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.json();
      console.error('❌ EasyPost API error:', errorBody);
      return NextResponse.json(
        { success: false, error: errorBody.error?.message || 'Request failed' },
        { status: res.status }
      );
    }

    const result = await res.json();
    return NextResponse.json({
  success: true,
  message: `✅ API key is valid and working!`,
});

  } catch (err: any) {
    console.error('❌ Fetch error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
