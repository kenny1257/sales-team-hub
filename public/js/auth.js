(async function () {
    // Check if already authenticated
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            window.location.href = '/library';
            return;
        }
    } catch {}

    // Load Google Client ID
    let clientId;
    try {
        const config = await (await fetch('/api/config')).json();
        clientId = config.googleClientId;
    } catch {
        showError('Could not load configuration.');
        return;
    }

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
        document.getElementById('auth-loading').style.display = 'none';
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredential,
        });
        google.accounts.id.renderButton(
            document.getElementById('signin-btn'),
            { theme: 'outline', size: 'large', text: 'signin_with', width: 300 }
        );
    };
    document.head.appendChild(script);

    async function handleCredential(response) {
        try {
            const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.location.href = '/library';
        } catch (err) {
            showError(err.message || 'Authentication failed');
        }
    }

    function showError(msg) {
        document.getElementById('auth-loading').style.display = 'none';
        const el = document.getElementById('auth-error');
        el.textContent = msg;
        el.style.display = 'block';
    }
})();
