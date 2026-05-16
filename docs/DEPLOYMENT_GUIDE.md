# LuDashboard Deployment Guide

## 1. Google OAuth Setup
To enable Google Login, you need a Client ID from the Google Cloud Console.

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Select **Web application** as the Application type.
6. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (for local development)
   - `https://ludashboard.vercel.app` (for production)
7. You do not strictly need Authorized redirect URIs since `@react-oauth/google` handles the popup flow natively.
8. Copy the generated **Client ID**.

## 2. Firebase Firestore Setup
LuDashboard uses Firestore for cloud syncing the workspace configuration.

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (you can link it to the Google Cloud project from step 1).
3. Add a **Web App** to the project to get your Firebase configuration keys.
4. Navigate to **Firestore Database** and click **Create Database**.
5. Start in **Production Mode**.
6. Set up the following **Security Rules** to ensure users can only read/write their own workspace configs:
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/workspace/config {
      // Note: Because this is a client-side only app, the user ID used in Firestore 
      // must match the ID sent from the Google OAuth flow. If using Firebase Auth,
      // use `request.auth.uid == userId`. If bypassing Firebase Auth (using raw token),
      // ensure secure validation via Cloud Functions or enforce strict match.
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
*(Note: If you are NOT using Firebase Auth and strictly using `@react-oauth/google` directly, you may need to implement Firebase Auth with Google Sign-in to properly enforce `request.auth.uid` rules).*

## 3. Environment Variables
You must set the following environment variables in your `.env` (locally) and in your Vercel Project Settings (for production):

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

## 4. Vercel Deployment Workflow
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for production"
   git push -u origin main
   ```
2. Go to [Vercel](https://vercel.com/) and click **Add New > Project**.
3. Import the `ludashboard` repository from your GitHub account.
4. **Framework Preset:** Vercel should automatically detect **Vite**.
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. Expand the **Environment Variables** section and paste the keys from Step 3.
8. Click **Deploy**.

## 5. Verifying the Production Deployment
Once deployed, verify the following:
- **PWA / Installability:** Open Chrome, look for the "Install App" icon in the URL bar.
- **Offline Shell:** Turn off your network connection via DevTools and refresh the page. The shell should load via Service Worker.
- **Iframe Modules:** Click "Import Module", paste an online URL (e.g. `https://lufast.vercel.app`), and ensure it renders within the RightPane without breaking layout or routing.
- **Cloud Sync:** Log in with Google. Check the bottom right corner for the `Synced` indicator. Make a change (like pinning a module), log in on an incognito window, and verify the state successfully synced.
