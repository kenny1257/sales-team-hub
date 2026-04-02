/* ==============================================
   Metal America Sales Hub - Auth (Login Page)
   ============================================== */

(function () {
    // If already authenticated, skip straight to dashboard
    fetch('/api/auth/me')
        .then(r => { if (r.ok) window.location.href = '/dashboard.html'; })
        .catch(() => {});

    // Fetch Google Client ID from server then init GSI
    fetch('/api/config')
        .then(r => r.json())
        .then(cfg => {
            if (!cfg.googleClientId || cfg.googleClientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
                showError('Google Client ID not configured. See SETUP.md');
                return;
            }
            waitForGoogle(() => initGSI(cfg.googleClientId));
        })
        .catch(() => showError('Could not load configuration.'));

    function waitForGoogle(cb) {
        if (typeof google !== 'undefined' && google.accounts) return cb();
        const t = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts) { clearInterval(t); cb(); }
        }, 100);
    }

    function initGSI(clientId) {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredential,
            auto_select: false,
        });
        google.accounts.id.renderButton(
            document.getElementById('google-signin-btn'),
            { theme: 'outline', size: 'large', width: 300, text: 'signin_with', shape: 'rectangular' }
        );
    }

    async function handleCredential(response) {
        const loadingEl = document.getElementById('auth-loading');
        const errorEl = document.getElementById('auth-error');
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';

        try {
            const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/dashboard.html';
            } else {
                showError(data.error || 'Sign-in failed. Please try again.');
            }
        } catch {
            showError('Network error. Please try again.');
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    function showError(msg) {
        const el = document.getElementById('auth-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }
})();
