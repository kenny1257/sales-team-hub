# Metal America Sales Team Hub — Vercel Setup

Follow these steps in order. The whole process takes about 15 minutes.

---

## Step 1: Create a GitHub Account (if you don't have one)

1. Go to **https://github.com** and sign up (free)
2. Verify your email

---

## Step 2: Upload This Project to GitHub

1. Go to **https://github.com/new**
2. Repository name: `sales-team-hub`
3. Set it to **Private**
4. Click **Create repository**
5. On the next page, you'll see instructions. We will use the **"upload an existing file"** link:
   - Or go to: `https://github.com/YOUR-USERNAME/sales-team-hub/upload/main`
6. Drag and drop ALL the files and folders from this project folder into the upload area
   - Make sure to include: `api/`, `lib/`, `public/`, `package.json`, `vercel.json`, `.gitignore`
   - Do NOT upload `node_modules/` or `.env` files
7. Click **Commit changes**

---

## Step 3: Create a Vercel Account

1. Go to **https://vercel.com** and click **Sign Up**
2. Choose **Continue with GitHub**
3. Authorize Vercel to access your GitHub

---

## Step 4: Deploy the Project on Vercel

1. From the Vercel dashboard, click **Add New → Project**
2. Find and select your `sales-team-hub` repository
3. Click **Deploy**
4. Wait for the build to finish (it will show errors about the database — that's OK, we'll fix it next)

---

## Step 5: Add a Postgres Database

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click **Create** → select **Postgres**
3. Name it: `sales-hub-db`
4. Click **Create**
5. It will ask you to connect it to your project — click **Connect**
6. This automatically adds the database connection environment variables

---

## Step 6: Set Up Google OAuth

1. Go to **https://console.cloud.google.com/** and sign in
2. Click the project dropdown at the top → **New Project**
   - Name: `Metal America Sales Hub`
   - Click **Create**, then select it
3. In the left sidebar: **APIs & Services → OAuth consent screen**
   - Choose **External** → **Create**
   - App name: `Metal America Sales Hub`
   - User support email: your email
   - Developer contact email: your email
   - Click **Save and Continue** through all screens
   - On **Test users** → **Add Users** → add your Gmail and team emails → **Save and Continue**
4. In the left sidebar: **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Sales Hub`
   - **Authorized JavaScript origins** — click **Add URI** for BOTH:
     - `http://localhost:3000`
     - `https://your-project-name.vercel.app` ← (get this URL from your Vercel dashboard)
   - **Authorized redirect URIs** — click **Add URI** for BOTH:
     - `http://localhost:3000`
     - `https://your-project-name.vercel.app`
   - Click **Create**
5. **Copy the Client ID** (looks like `123456789-xxxxx.apps.googleusercontent.com`)

---

## Step 7: Add Environment Variables in Vercel

1. In your Vercel project dashboard, go to **Settings → Environment Variables**
2. Add these three variables (apply to all environments: Production, Preview, Development):

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Paste your Google Client ID from Step 6 |
| `ADMIN_EMAILS` | Your Gmail address (comma-separated for multiple admins) |
| `JWT_SECRET` | Type any long random string (e.g., `ma-sales-hub-2026-xK9mP2`) |

3. Click **Save** for each one

---

## Step 8: Redeploy

1. Go to the **Deployments** tab in your Vercel dashboard
2. Find the latest deployment, click the **⋮** menu → **Redeploy**
3. Wait for it to finish
4. Click **Visit** to open your live site

---

## You're Done!

Your Sales Hub is now live at `https://your-project-name.vercel.app`

- Sign in with Google
- Admin features activate for emails listed in `ADMIN_EMAILS`
- Share the URL with your sales team
- The database auto-creates tables and seeds starter sales tips on first use

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Google sign-in popup closes immediately | Make sure your Vercel URL is in the Google OAuth authorized origins |
| "Authentication failed" after signing in | Check that GOOGLE_CLIENT_ID is correct in Vercel env vars |
| Can't see team dashboard | Make sure your email is in ADMIN_EMAILS (exact match, lowercase) |
| Changes not showing after env var update | You must **Redeploy** after changing environment variables |
