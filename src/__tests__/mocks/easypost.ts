export const ENVELOPE_RATE = {
  id: 'rate_envelope',
  carrier: 'USPS',
  service: 'First',
  rate: '0.63',
}

export const GROUND_RATE = {
  id: 'rate_ground',
  carrier: 'USPS',
  service: 'GroundAdvantage',
  rate: '5.40',
}

export const CHEAP_NON_USPS_RATE = {
  id: 'rate_cheap',
  carrier: 'UPS',
  service: 'Ground',
  rate: '0.10',
}

export const BOUGHT_LABEL = {
  tracking_code: 'USPS1234567890',
  postage_label: { label_url: 'https://easypost.com/label.pdf' },
  tracker: { public_url: 'https://track.easypost.com/abc' },
}

export const makeShipmentResponse = (rates: object[]) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ id: 'shp_test123', rates }),
  })

export const makeBuyResponse = (label = BOUGHT_LABEL) =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(label),
  })

export const makeErrorShipmentResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ error: 'Invalid address', rates: [] }),
  })

export const makeFailedBuyResponse = () =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ error: 'Insufficient funds' }),
  })
