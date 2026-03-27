const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-vercel';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

// ---- Cookie helpers ----
function parseCookies(req) {
    const cookies = {};
    (req.headers.cookie || '').split(';').forEach(c => {
        const [key, ...val] = c.trim().split('=');
        if (key) cookies[key.trim()] = val.join('=');
    });
    return cookies;
}

function setAuthCookie(res, token) {
    const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secure}`);
}

function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
}

// ---- JWT helpers ----
function createToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

function getUserId(req) {
    const cookies = parseCookies(req);
    if (!cookies.token) return null;
    try {
        return jwt.verify(cookies.token, JWT_SECRET).userId;
    } catch {
        return null;
    }
}

// ---- Google verification ----
async function verifyGoogleToken(credential) {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
}

function isAdminEmail(email) {
    return ADMIN_EMAILS.includes(email.toLowerCase());
}

module.exports = {
    createToken,
    getUserId,
    setAuthCookie,
    clearAuthCookie,
    verifyGoogleToken,
    isAdminEmail,
    GOOGLE_CLIENT_ID,
};
