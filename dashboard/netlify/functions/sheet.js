/**
 * Netlify Serverless Function - Bridge for EMQX to Google Sheets
 * Endpoint: /.netlify/functions/sheet
 */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyPo3D2fzZX3ArMie1qWyr_pFXydc-n5SCBLdAQhZpoRd836VIAlRXv698jM43_IbCD/exec';

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
      let rawBody = event.body || '{}';
      let dataObj = {};
      try { dataObj = JSON.parse(rawBody); } catch(e) { dataObj = {}; }

      // Unwrap EMQX payload wrapper if present
      if (dataObj.payload) {
        if (typeof dataObj.payload === 'string') {
          try { dataObj = JSON.parse(dataObj.payload); } catch(e) {}
        } else if (typeof dataObj.payload === 'object') {
          dataObj = dataObj.payload;
        }
      }

      console.log('Forwarding cleaned payload to Google Script:', dataObj);

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataObj)
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
