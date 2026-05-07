const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports.config = {
    api: { bodyParser: { sizeLimit: '25mb' } }
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { type, manufacturer, needed_by, customer_needs, files, pdf_data, pdf_filename, state, customer_name, customer_address } = req.body;

    if (!type || !['price_match', 'discount', 'arizona_quote'].includes(type)) {
        return res.status(400).json({ error: 'Invalid request type' });
    }

    if (type === 'arizona_quote') {
        if (!state || !['AZ', 'NV'].includes(state)) {
            return res.status(400).json({ error: 'State (AZ or NV) is required' });
        }
        if (!customer_name || !customer_address || !customer_needs) {
            return res.status(400).json({ error: 'Customer name, address, and notes are required' });
        }
        const hasFiles = (Array.isArray(files) && files.length > 0) || (pdf_data && pdf_filename);
        if (!hasFiles) {
            return res.status(400).json({ error: 'A contract must be attached' });
        }
    } else {
        if (!needed_by || !manufacturer || !customer_needs) {
            return res.status(400).json({ error: 'All fields are required' });
        }
    }

    await initDb();

    const { rows } = await sql`
        INSERT INTO requests (user_id, type, manufacturer, needed_by, customer_needs, state, customer_name, customer_address, status)
        VALUES (${userId}, ${type}, ${manufacturer || null}, ${needed_by || null}, ${customer_needs || null}, ${state || null}, ${customer_name || null}, ${customer_address || null}, 'submitted')
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
