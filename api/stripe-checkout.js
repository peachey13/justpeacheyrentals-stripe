const Stripe = require('stripe');

exports.handler = async (event, context) => {
 const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
 
 console.log('Stripe Checkout Handler - Received event:', {
   httpMethod: event.httpMethod,
   headers: event.headers,
   body: event.body,
   origin: event.headers.origin || 'Not provided'
 });

 const headers = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Methods': 'POST, OPTIONS',
   'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
   'Access-Control-Max-Age': '86400',
   'Content-Type': 'application/json'
 };

 if (event.httpMethod === 'OPTIONS') {
   console.log('Handling OPTIONS preflight request');
   return {
     statusCode: 200,
     headers,
     body: ''
   };
 }

 if (event.httpMethod !== 'POST') {
   console.error('Invalid HTTP method:', event.httpMethod);
   return {
     statusCode: 405,
     headers,
     body: JSON.stringify({ error: 'Method not allowed' })
   };
 }

 try {
   if (!event.body) {
     console.error('No request body provided');
     return {
       statusCode: 400,
       headers,
       body: JSON.stringify({ error: 'No request body provided' })
     };
   }

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

   const { total, checkin, checkout, promoCode, promoCodeId, contact_id } = requestBody;
   
   console.log('Parsed checkout request:', { 
     total, 
     checkin, 
     checkout, 
     promoCode: promoCode || 'None',
     promoCodeId: promoCodeId || 'None',
     contact_id: contact_id || 'None'
   });

   // Validate required fields
   if (!total || !checkin || !checkout || !contact_id) {
     console.error('Missing required fields:', { total, checkin, checkout, contact_id });
     return {
       statusCode: 400,
       headers,
       body: JSON.stringify({
         error: 'Missing required fields: ' +
           (!total ? 'total ' : '') +
           (!checkin ? 'checkin ' : '') +
           (!checkout ? 'checkout ' : '') +
           (!contact_id ? 'contact_id' : '')
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

   const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
   if (!dateRegex.test(checkin) || !dateRegex.test(checkout)) {
     console.error('Invalid date format:', { checkin, checkout });
     return {
       statusCode: 400,
       headers,
       body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' })
     };
   }

   if (new Date(checkout) <= new Date(checkin)) {
     console.error('Checkout date must be after checkin date:', { checkin, checkout });
     return {
       statusCode: 400,
       headers,
       body: JSON.stringify({ error: 'Checkout date must be after checkin date' })
     };
   }

   const promoText = promoCode ? `, Promo: ${promoCode}` : '';
   const productName = `Booking from ${checkin} to ${checkout}${promoText}`;

   const sessionConfig = {
     payment_method_types: ['card'],
     line_items: [
       {
         price_data: {
           currency: 'usd',
           product_data: {
             name: productName,
             description: `Just Peachey Rentals - ${checkin} to ${checkout}`
           },
           unit_amount: Math.round(adjustedTotal * 100)
         },
         quantity: 1
       }
     ],
     mode: 'payment',
     success_url: `https://justpeacheyrentals.com/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: 'https://justpeacheyrentals.com/cancel',
     metadata: {
       checkin,
       checkout,
       original_total: total.toString(),
       contact_id,
       promo_code: promoCode || '',
       promo_code_id: promoCodeId || ''
     }
   };

   if (promoCodeId) {
     console.log('Adding promotion code to session:', promoCodeId);
     sessionConfig.discounts = [{
       promotion_code: promoCodeId
     }];
   }

   console.log('Creating Stripe checkout session with config:', {
     amount: Math.round(adjustedTotal * 100),
     productName,
     hasPromoCode: !!promoCodeId
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

   if (error.type === 'StripeInvalidRequestError') {
     return {
       statusCode: 400,
       headers,
       body: JSON.stringify({ 
         error: 'Invalid request to payment processor',
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
