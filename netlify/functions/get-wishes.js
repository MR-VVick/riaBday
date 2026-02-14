const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    const { NETLIFY_TOKEN, SITE_ID } = process.env;

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow cross-origin (good practice)
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (!NETLIFY_TOKEN || !SITE_ID) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Missing Environment Variables" })
        };
    }

    try {
        // 1. Get the form ID
        const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
            headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
        });
        const forms = await formsRes.json();
        const wishForm = forms.find(f => f.name === 'wishes');

        if (!wishForm) {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }

        // 2. Get submissions
        const subRes = await fetch(`https://api.netlify.com/api/v1/forms/${wishForm.id}/submissions`, {
            headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
        });
        const submissions = await subRes.json();

        const wishes = submissions.map(sub => ({
            name: sub.data.name,
            message: sub.data.message,
            timestamp: sub.created_at
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(wishes)
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};
