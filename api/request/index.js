const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { type, manufacturer, needed_by, customer_needs, files, pdf_data, pdf_filename } = req.body;

    if (!type || !needed_by) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    if (!['price_match', 'discount', 'arizona_quote'].includes(type)) {
        return res.status(400).json({ error: 'Invalid request type' });
    }

    if ((type === 'price_match' || type === 'discount') && (!manufacturer || !customer_needs)) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    await initDb();

    const { rows } = await sql`
        INSERT INTO requests (user_id, type, manufacturer, needed_by, customer_needs)
        VALUES (${userId}, ${type}, ${manufacturer || null}, ${needed_by}, ${customer_needs || null})
        RETURNING id
    `;

    const requestId = rows[0].id;

    // Multiple files (new format)
    if (files && Array.isArray(files)) {
        for (const file of files) {
            if (file.data && file.name) {
                await sql`
                    INSERT INTO request_files (request_id, file_data, file_name)
                    VALUES (${requestId}, ${file.data}, ${file.name})
                `;
            }
        }
    }
    // Legacy single file fallback
    else if (pdf_data && pdf_filename) {
        await sql`
            INSERT INTO request_files (request_id, file_data, file_name)
            VALUES (${requestId}, ${pdf_data}, ${pdf_filename})
        `;
    }

    res.json({ success: true });
};
