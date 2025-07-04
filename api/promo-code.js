const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
  try {
    // Parse request body
    const { total, promoCode } = JSON.parse(event.body);

    // Validate required fields
    if (!total) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Total amount is required' })
      };
    }

    // Convert total to number and validate
    const baseTotal = parseFloat(total);
    if (isNaN(baseTotal) || baseTotal <= 0) {
      return {
        statusCode: 400,
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
        // List promotion codes with the given code
        const promotionCodes = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1
        });

        if (!promotionCodes.data.length) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid promo code' })
          };
        }

        const promo = promotionCodes.data[0];
        const coupon = promo.coupon;

        // Check if promo code is expired
        if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Promo code expired' })
          };
        }

        // Check minimum amount requirement
        if (coupon.min_amount && baseTotal < coupon.min_amount / 100) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: `Minimum booking amount of $${(coupon.min_amount / 100).toFixed(2)} required for this promo code`
            })
          };
        }

        // Calculate discount
        if (coupon.percent_off) {
          discount = baseTotal * (coupon.percent_off / 100);
        } else if (coupon.amount_off) {
          discount = coupon.amount_off / 100; // Convert cents to dollars
        }

        // Ensure adjusted total doesn't go below 0
        adjustedTotal = Math.max(0, baseTotal - discount);
        promoCodeId = promo.id; // Store the Stripe promo code ID (e.g., promo_xxx)
      } catch (error) {
        console.error('Stripe API error:', error);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid promo code' })
        };
      }
    }

    // Return response
    return {
      statusCode: 200,
      body: JSON.stringify({
        adjusted_total: adjustedTotal,
        discount: discount,
        promoCode: promoCode || null,
        promoCodeId: promoCodeId
      })
    };
  } catch (error) {
    console.error('Error validating promo code:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server error: ${error.message}` })
    };
  }
};
