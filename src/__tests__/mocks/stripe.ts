export const makeCheckoutEvent = (email: string | null) => ({
  type: 'checkout.session.completed',
  data: {
    object: {
      customer_email: email,
    },
  },
})

export const makeUnhandledEvent = () => ({
  type: 'payment_intent.created',
  data: { object: {} },
})
