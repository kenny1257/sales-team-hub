const { getUserId } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    var userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    var SHEET_ID = process.env.GOOGLE_SHEET_ID;
    var API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

    if (!SHEET_ID || !API_KEY) {
        return res.status(500).json({ error: 'Google Sheets not configured. Add GOOGLE_SHEET_ID and GOOGLE_SHEETS_API_KEY to env vars.' });
    }

    try {
        var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + '/values/database!B4:C4?key=' + API_KEY;
        var response = await fetch(url);
        var data = await response.json();

        if (!response.ok) {
            throw new Error(data.error ? data.error.message : 'Google Sheets API error');
        }

        if (!data.values || !data.values[0]) {
            return res.json({ currentVolume: 0, goal: 0, percentage: 0 });
        }

        var raw = data.values[0];
        var currentVolume = parseFloat(String(raw[0] || '0').replace(/[,$]/g, '')) || 0;
        var goal = parseFloat(String(raw[1] || '0').replace(/[,$]/g, '')) || 0;
        var percentage = goal > 0 ? Math.round((currentVolume / goal) * 100) : 0;

        res.json({
            currentVolume: currentVolume,
            goal: goal,
            percentage: Math.min(percentage, 100),
            percentageRaw: percentage,
        });
    } catch (err) {
        console.error('Sales goal error:', err);
        res.status(500).json({ error: 'Failed to fetch sales goal: ' + err.message });
    }
};
