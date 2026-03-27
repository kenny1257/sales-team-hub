const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { type, manufacturer, needed_by, customer_needs, pdf_data, pdf_filename } = req.body;

    if (!type || !manufacturer || !needed_by || !customer_needs) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['price_match', 'discount'].includes(type)) {
        return res.status(400).json({ error: 'Invalid request type' });
    }

    await initDb();

    await sql`
        INSERT INTO requests (user_id, type, manufacturer, needed_by, customer_needs, pdf_data, pdf_filename)
        VALUES (${userId}, ${type}, ${manufacturer}, ${needed_by}, ${customer_needs}, ${pdf_data || null}, ${pdf_filename || null})
    `;

    res.json({ success: true });
};
