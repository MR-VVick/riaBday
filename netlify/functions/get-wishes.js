// netlify/functions/get-wishes.js
// NO require('node-fetch') needed

exports.handler = async (event, context) => {
    const { NETLIFY_TOKEN, SITE_ID } = process.env;

    if (!NETLIFY_TOKEN || !SITE_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Missing Environment Variables" })
        };
    }

    try {
        // Use global fetch (Node 18+)
        const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
            headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
        });

        if (!formsRes.ok) throw new Error(`Forms API: ${formsRes.status}`);

        const forms = await formsRes.json();
        const wishForm = forms.find(f => f.name.toLowerCase() === 'wishes');

        if (!wishForm) {
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        const subRes = await fetch(`https://api.netlify.com/api/v1/forms/${wishForm.id}/submissions`, {
            headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
        });

        if (!subRes.ok) throw new Error(`Submissions API: ${subRes.status}`);

        const submissions = await subRes.json();

        const wishes = submissions.map(sub => ({
            name: sub.data.name || "Anonymous",
            message: sub.data.message || "",
            timestamp: sub.created_at
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"   // change to your domain later
            },
            body: JSON.stringify(wishes)
        };
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};