const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://justpeacheyrentals.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { total, checkin, checkout } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Booking from ${checkin} to ${checkout}`,
          },
          unit_amount: parseInt(total * 100), // Stripe expects cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://justpeacheyrentals.com/success',
      cancel_url: 'https://justpeacheyrentals.com/cancel',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
