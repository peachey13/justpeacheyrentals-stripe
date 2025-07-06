exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
    
  const data = JSON.parse(event.body);
  const { email, contact_name, contact_id } = data;
  
  console.log('Webhook received:', { email, contact_name, contact_id });
  
  if (!email || !contact_name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }
  
  const redirectUrl = `https://justpeacheyrentals.com/payment-redirect?email=${encodeURIComponent(email)}&contact_name=${encodeURIComponent(contact_name)}&contact_id=${encodeURIComponent(contact_id || '')}`;
  
  return {
    statusCode: 302,
    headers: {
      Location: redirectUrl
    },
    body: ''
  };
};
