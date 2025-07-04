const Stripe = require('stripe');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Received event:', event);

  try {
    const { total, checkin, checkout, promoCode, promoCodeId } = JSON.parse(event.body);

    if (!total || !checkin || !checkout) {
      console.error('Missing required fields:', { total, checkin, checkout });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: ' +
            (!total ? 'total ' : '') +
            (!checkin ? 'checkin ' : '') +
            (!checkout ? 'checkout' : '')
        })
      };
    }

    const adjustedTotal = parseFloat(total);
    if (isNaN(adjustedTotal) || adjustedTotal < 0) {
      console.error('Invalid total amount:', total);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid total amount' })
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Booking from ${checkin} to ${checkout}${promoCode ? `, Promo: ${promoCode}` : ''}`,
            },
            unit_amount: Math.round(adjustedTotal * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://justpeacheyrentals.com/success',
      cancel_url: 'https://justpeacheyrentals.com/cancel',
      ...(promoCodeId && { promotion_code: promoCodeId })
    });

    console.log('Checkout session created:', session.id);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: session.url,
        adjusted_total: adjustedTotal,
        promoCode: promoCode || null
      })
    };
  } catch (error) {
    console.error('Stripe session creation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
