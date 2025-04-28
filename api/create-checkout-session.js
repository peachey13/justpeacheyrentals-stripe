module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://justpeacheyrentals.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  try {
    const { total, checkin, checkout } = req.body;

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'success_url': 'https://justpeacheyrentals.com/success',
        'cancel_url': 'https://justpeacheyrentals.com/cancel',
        'payment_method_types[]': 'card',
        'mode': 'payment',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': `Booking from ${checkin} to ${checkout}`,
        'line_items[0][price_data][unit_amount]': Math.round(total * 100).toString(),
        'line_items[0][quantity]': '1'
      }).toString()
    });

    const stripeData = await stripeResponse.json();

    if (stripeData.url) {
      res.status(200).json({ url: stripeData.url });
    } else {
      console.error('Stripe session creation failed', stripeData);
      res.status(500).json({ error: 'Failed to create Stripe checkout session.' });
    }

  } catch (error) {
    console.error('Error creating Stripe session:', error.message);
    res.status(500).json({ error: error.message });
  }
};
