const Stripe = require('stripe');

exports.handler = async function (event, context) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  console.log('Promo Code Handler - Received event:', {
    httpMethod: event.httpMethod,
    headers: event.headers,
    body: event.body,
    origin: event.headers.origin || 'Not provided',
    userAgent: event.headers['user-agent'] || 'Not provided'
  });

  // Enhanced CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Content-Type': 'application/json'
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

    if (!promoCode || typeof promoCode !== 'string' || !promoCode.trim()) {
      console.error('Missing or invalid promo code:', promoCode);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid promo code is required' })
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
    try {
      console.log('Fetching promo codes from Stripe for:', promoCode.trim());
      
      const promotionCodes = await stripe.promotionCodes.list({
        code: promoCode.trim(),
        active: true,
        limit: 1
      });

      console.log('Stripe promotion codes response:', {
        count: promotionCodes.data.length,
        codes: promotionCodes.data.map(p => ({ id: p.id, code: p.code, active: p.active }))
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

      console.log('Found promo code:', {
        id: promo.id,
        code: promo.code,
        active: promo.active,
        expires_at: promo.expires_at,
        coupon: {
          id: coupon.id,
          percent_off: coupon.percent_off,
          amount_off: coupon.amount_off,
          min_amount: coupon.min_amount
        }
      });

      // Check if promo code is expired
      if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
        console.log('Promo code expired:', promoCode);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Promo code expired' })
        };
      }

      // Check minimum amount requirement
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

      // Calculate discount
      if (coupon.percent_off) {
        discount = baseTotal * (coupon.percent_off / 100);
        console.log('Applying percentage discount:', { percent_off: coupon.percent_off, discount });
      } else if (coupon.amount_off) {
        discount = coupon.amount_off / 100;
        console.log('Applying fixed amount discount:', { amount_off: coupon.amount_off, discount });
      }

      adjustedTotal = Math.max(0, baseTotal - discount);
      promoCodeId = promo.id;
      
      console.log('Promo code applied successfully:', { 
        promoCode, 
        discount, 
        adjustedTotal, 
        promoCodeId,
        originalTotal: baseTotal 
      });

    } catch (stripeError) {
      console.error('Stripe API error:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        statusCode: stripeError.statusCode
      });
      
      // Handle specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid promo code' })
        };
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error validating promo code. Please try again.' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        adjusted_total: adjustedTotal,
        discount: discount,
        promoCode: promoCode.trim(),
        promoCodeId: promoCodeId,
        success: true
      })
    };

  } catch (error) {
    console.error('Unexpected error in promo-code function:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `Server error: ${error.message}`,
        success: false 
      })
    };
  }
};
