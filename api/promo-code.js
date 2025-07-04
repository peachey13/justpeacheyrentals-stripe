const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
exports.handler = async function(event, context) {  try {    const { total, promoCode } = JSON.parse(event.body);
if (!total) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Total amount is required' })
  };
}

const baseTotal = parseFloat(total);
if (isNaN(baseTotal) || baseTotal <= 0) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Invalid total amount' })
  };
}

let discount = 0;
let adjustedTotal = baseTotal;
let promoCodeId = null;

if (promoCode) {
  try {
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

    if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Promo code expired' })
      };
    }

    if (coupon.min_amount && baseTotal < coupon.min_amount / 100) {
      return {
        statusCode: 400,
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
  } catch (error) {
    console.error('Stripe API error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid promo code' })
    };
  }
}

return {
  statusCode: 200,
  body: JSON.stringify({
    adjusted_total: adjustedTotal,
    discount: discount,
    promoCode: promoCode || null,
    promoCodeId: promoCodeId
  })
};

  } catch (error) {    console.error('Error validating promo code:', error);    return {      statusCode: 500,      body: JSON.stringify({ error: Server error: ${error.message} })    };  }};
