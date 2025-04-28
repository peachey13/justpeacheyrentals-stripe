export const config = {
  runtime: 'edge',
};

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const { total, checkin, checkout } = await req.json();

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

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.error('Stripe checkout session failed:', err);

    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        'Content-Type': 'application/json',
      },
    });
  }
}


