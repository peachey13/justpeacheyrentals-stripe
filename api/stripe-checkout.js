const Stripe = require('stripe');

exports.handler = async (event, context) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  
  console.log('Stripe Checkout Handler - Received event:', {
    httpMethod: event.httpMethod,
    headers: event.headers,
    body: event.body,
    origin: event.headers.origin || 'Not provided'
  });

  // Enhanced CORS headers to match promo code handler
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
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    console.error('Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
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

    const { total, checkin, checkout, promoCode, promoCodeId } = requestBody;
    
    console.log('Parsed checkout request:', { 
      total, 
      checkin, 
      checkout, 
      promoCode: promoCode || 'None',
      promoCodeId: promoCodeId || 'None'
    });

    // Validate required fields
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

    // Validate total amount
    const adjustedTotal = parseFloat(total);
    if (isNaN(adjustedTotal) || adjustedTotal < 0) {
      console.error('Invalid total amount:', total);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid total amount' })
      };
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkin) || !dateRegex.test(checkout)) {
      console.error('Invalid date format:', { checkin, checkout });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' })
      };
    }

    // Validate checkout is after checkin
    if (new Date(checkout) <= new Date(checkin)) {
      console.error('Checkout date must be after checkin date:', { checkin, checkout });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Checkout date must be after checkin date' })
      };
    }

    // Create line item description
    const promoText = promoCode ? `, Promo: ${promoCode}` : '';
    const productName = `Booking from ${checkin} to ${checkout}${promoText}`;

    // Create Stripe checkout session
    const sessionConfig = {
      payment_method_types: ['card'],
      customer_creation: 'always', // Always create customer
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: `Just Peachey Rentals - ${checkin} to ${checkout}`
            },
            unit_amount: Math.round(adjustedTotal * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://justpeacheyrentals.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://justpeacheyrentals.com/cancel',
      metadata: {
        checkin: checkin,
        checkout: checkout,
        original_total: total.toString(),
        promo_code: promoCode || '',
        promo_code_id: promoCodeId || ''
      }
    };

    // Only add promotion code if we have a valid promoCodeId and it's not empty
    if (promoCodeId && promoCodeId.trim() !== '' && promoCodeId !== 'undefined') {
      console.log('Attempting to add promotion code to session:', promoCodeId);
      
      try {
        // Verify the promotion code exists and is active before adding it
        const promotionCode = await stripe.promotionCodes.retrieve(promoCodeId);
        
        if (promotionCode && promotionCode.active) {
          // Check if promotion code is expired
          if (!promotionCode.expires_at || promotionCode.expires_at * 1000 > Date.now()) {
            sessionConfig.discounts = [{
              promotion_code: promoCodeId
            }];
            console.log('Successfully added promotion code:', promotionCode.code);
          } else {
            console.log('Promotion code is expired, proceeding without discount');
          }
        } else {
          console.log('Promotion code is inactive, proceeding without discount');
        }
      } catch (promoError) {
        console.error('Error verifying promotion code:', {
          message: promoError.message,
          type: promoError.type,
          code: promoError.code
        });
        console.log('Proceeding without promotion code due to verification error');
        // Continue without the promo code instead of failing the entire checkout
      }
    } else {
      console.log('No valid promotion code provided, proceeding without discount');
    }

    console.log('Creating Stripe checkout session with config:', {
      amount: Math.round(adjustedTotal * 100),
      productName,
      hasPromoCode: !!promoCodeId,
      hasDiscounts: !!sessionConfig.discounts
    });

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('Checkout session created successfully:', {
      sessionId: session.id,
      url: session.url,
      amount: session.amount_total
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: session.url,
        session_id: session.id,
        adjusted_total: adjustedTotal,
        promoCode: promoCode || null,
        success: true
      })
    };

  } catch (error) {
    console.error('Stripe session creation failed:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Invalid request to payment processor: ${error.message}`,
          success: false 
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create checkout session. Please try again.',
        success: false 
      })
    };
  }
};
