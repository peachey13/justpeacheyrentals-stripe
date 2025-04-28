// Standard Vercel API route - Node.js runtime
import Stripe from 'stripe';

// Explicitly set to use Node.js runtime
export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: true, // Enable body parsing
  },
};

export default async function handler(req, res) {
  // Handle CORS preflight requests
  res.setHeader('Access-Control-Allow-Origin', 'https://justpeacheyrentals.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not defined');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  try {
    const { total, checkin, checkout } = req.body;
    
    console.log('Creating checkout session with:', { total, checkin, checkout });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Booking from ${checkin} to ${checkout}`,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://justpeacheyrentals.com/success',
      cancel_url: 'https://justpeacheyrentals.com/cancel',
    });
    
    console.log('Session created:', session.url);
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe session:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
}
