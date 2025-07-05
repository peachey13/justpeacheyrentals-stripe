// The simplest possible Node.js API handler for Vercel
const Stripe = require('stripe');

// This is a standard Node.js serverless function format for Vercel
module.exports = async (req, res) => {
  // CORS headers are now handled by vercel.json
   
  // Validate request method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Validate environment variable
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Get data from request body
    const { total, checkin, checkout } = req.body;
    console.log('Request data:', { total, checkin, checkout });
    
    // Create checkout session
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
    
    // Return session URL
    return res.status(200).json({ url: session.url });
  } catch (error) {
    // Handle errors
    console.error('Stripe error:', error.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
