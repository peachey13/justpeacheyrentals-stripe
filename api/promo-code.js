const Stripe = require('stripe');

exports.handler = async function (event, context) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('Received event:', {
    httpMethod: event.httpMethod,
    headers: event.headers,
    body: event.body,
    origin: event.headers.origin || 'Not provided'
  });

  // CORS headers (allow all origins for debugging)
  const headers = {
    'Access-Control-Allow-Origin': '*', // Revert to correct domain after confirming
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Validate HTTP method
  if (event.httpMethod !== 'POST') {
    console.error('Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check for request body
    if (!event.body) {
      console.error('No request body provided');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No request body provided' })
      };
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Invalid JSON in request body:', event.body, parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { total, promoCode } = requestBody;
    console.log('Parsed request body:', { total, promoCode });

    // Validate required fields
    if (!total) {
      console.error('Missing total in request body:', requestBody);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Total amount is required' })
      };
    }

    // Convert total to number and validate
    const baseTotal = parseFloat(total);
    if (isNaN(baseTotal) || baseTotal <= 0) {
      console.error('Invalid total amount:', total);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid total amount' })
      };
    }

    // Initialize discount and adjusted total
    let discount = 0;
    let adjustedTotal = baseTotal;
    let promoCodeId = null;

    // Validate promo code with Stripe API
    if (promoCode) {
      try {
        const promotionCodes = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1
        });

        if (!promotionCodes.data.length) {
          console.log('Promo code not found:', promoCode);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid promo code' })
          };
        }

        const promo = promotionCodes.data[0];
        const coupon = promo.coupon;

        if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
          console.log('Promo code expired:', promoCode);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Promo code expired' })
          };
        }

        if (coupon.min_amount && baseTotal < coupon.min_amount / 100) {
          console.log('Minimum amount not met:', { baseTotal, min_amount: coupon.min_amount });
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: `Minimum booking amount of $${(coupon.min_amount / 100).toFixed(2)} required for this promo code`
            })
          };
        }

        if (coupon.percent_off) {
          discount = baseTotal * (coupon.percent_off / 100);
        } else if (coupon.amount_off) {
          discount = coupon.amount_off / 100;
        }

        adjustedTotal = Math.max(0, baseTotal - discount);
        promoCodeId = promo.id;
        console.log('Promo code applied:', { promoCode, discount, adjustedTotal, promoCodeId });
      } catch (stripeError) {
        console.error('Stripe API error:', stripeError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid promo code' })
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        adjusted_total: adjustedTotal,
        discount: discount,
        promoCode: promoCode || null,
        promoCodeId: promoCodeId
      })
    };
  } catch (error) {
    console.error('Unexpected error in promo-code function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Server error: ${error.message}` })
    };
  }
};
