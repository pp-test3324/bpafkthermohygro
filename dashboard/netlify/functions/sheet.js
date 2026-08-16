/**
 * Netlify Serverless Function - Bridge for EMQX to Google Sheets
 * Endpoint: /.netlify/functions/sheet
 */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxrjLDHuBaaDzyZSfBundV9_UOX9t0CiepEN8CVpxVQXrd9XRnJs9dskhrb5BEOuHaG/exec';

exports.handler = async (event, context) => {
  // CORS Headers for browser requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS Preflight OK' })
    };
  }

  try {
    if (event.httpMethod === 'POST') {
      // Forward POST from EMQX to Google Apps Script
      let payload = event.body;
      console.log('Received POST from EMQX:', payload);

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      const resultText = await response.text();
      console.log('Google Script Response:', resultText);

      return {
        statusCode: 200, // Return clean 200 OK to EMQX Cloud!
        headers,
        body: JSON.stringify({ status: 'success', googleResponse: resultText })
      };

    } else if (event.httpMethod === 'GET') {
      // Fetch telemetry history from Google Apps Script for the Dashboard
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const data = await response.json();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (err) {
    console.error('Error in Netlify Function bridge:', err);
    return {
      statusCode: 200, // Always return 200 so EMQX does not fail
      headers,
      body: JSON.stringify({ status: 'error', error: err.toString() })
    };
  }
};
