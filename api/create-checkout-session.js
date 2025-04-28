// Edge API route with Edge Runtime
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
      },
    });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  try {
    // Parse request body
    const requestData = await request.json();
    const { total, checkin, checkout } = requestData;
    
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
      return new Response(JSON.stringify({ url: stripeData.url }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        },
      });
    } else {
      console.error('Stripe session creation failed', stripeData);
      return new Response(JSON.stringify({ error: 'Failed to create Stripe checkout session.' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
        },
      });
    }
  } catch (error) {
    console.error('Error creating Stripe session:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://justpeacheyrentals.com',
      },
    });
  }
}
