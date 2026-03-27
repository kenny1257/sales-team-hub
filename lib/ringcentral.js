const RC_SERVER = 'https://platform.ringcentral.com';
const RC_CLIENT_ID = process.env.RC_CLIENT_ID;
const RC_CLIENT_SECRET = process.env.RC_CLIENT_SECRET;
const RC_JWT_TOKEN = process.env.RC_JWT_TOKEN;

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64'),
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${RC_JWT_TOKEN}`,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error_description || 'RingCentral auth failed');

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
}

async function rcGet(path, params = {}) {
    const token = await getAccessToken();
    const url = new URL(`${RC_SERVER}${path}`);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });

    const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'RingCentral API error');
    return data;
}

async function rcPost(path, body = {}) {
    const token = await getAccessToken();
    const url = `${RC_SERVER}${path}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { rawResponse: text }; }
    if (!res.ok) {
        const detail = data.message || data.errorCode || data.error_description || data.description || JSON.stringify(data).slice(0, 300);
        throw new Error(`RC ${res.status}: ${detail}`);
    }
    return data;
}

module.exports = { rcGet, rcPost };
