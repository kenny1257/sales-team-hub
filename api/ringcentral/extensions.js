const { rcGet } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const data = await rcGet('/restapi/v1.0/account/~/extension', {
            type: 'User',
            status: 'Enabled',
            perPage: '1000',
        });

        const extensions = (data.records || []).map(ext => ({
            id: String(ext.id),
            name: ext.name || `Ext ${ext.extensionNumber}`,
            extensionNumber: ext.extensionNumber,
        })).sort((a, b) => a.name.localeCompare(b.name));

        res.json({ extensions });
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch extensions: ' + err.message });
    }
};
