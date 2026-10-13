# Hosting on Render (free plan)

## How the free plan behaves
- A free web service **sleeps after 15 minutes with no incoming request**. The next request wakes it. The Spring Boot backend usually needs **1 to 2 minutes** to wake on the free CPU. Node-RED is faster.
- You get **750 free instance hours per month for your whole workspace**, shared by all free services. A service uses hours only while awake. If the hours run out, **all** free services stop until the next month.
- The disk is wiped on every restart and deploy. Nothing may be stored on it. That is why Iryo keeps all data in Aiven and bakes the Node-RED flow into the image.

## What Iryo does about it
1. **The app** checks `/api/health` as soon as it opens. It sends a request every 5 seconds. The first 4 say "Connecting", then it says "Waking up the server" for up to 2.5 minutes, then it offers a Try again button. While you use the app it pings every 9 minutes, so the server does not sleep under you. If any request later fails because the server is unreachable, the app checks again by itself.
2. **The ESP32 device** wakes Node-RED and the backend when it powers on. It calls `/iot/ping` every 5 seconds until both answer, and keeps them awake while it is on.
3. **Readings are retried**. The device retries failed uploads. Each reading carries a `messageId`, so a retry never saves it twice.

## Optional cron job (keeps the backend awake at set hours)
Keeping **both** services awake all month needs 2 x 744 = 1488 hours, but you only have 750. So keep only the backend warm, and only when you need it.

1. Go to cron-job.org (free) and create a job:
   - URL: `https://YOUR-BACKEND.onrender.com/api/health`
   - Schedule: every **10 minutes**, hours **06:00 to 22:00**, time zone **Asia/Kolkata**.
   - Turn on failure notifications.
2. That keeps the backend awake 16 hours a day, about 496 hours a month. That leaves about 250 hours for Node-RED, which the device wakes whenever it is switched on.
3. For a demo or exam day, run the cron only that day. Disable it afterwards.

## Backend service
1. Push the repo to GitHub. In Render choose **New > Web Service**, connect the repo.
2. Settings: **Language: Docker**, **Root Directory: `backend`**, **Instance type: Free**, **Health Check Path: `/api/health`**.
3. Environment variables: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_API_KEY` (same names as `.env.example`). Render sets `PORT` itself.
4. Aiven: keep the default allowed IPs, because Render's addresses change.

## Node-RED service
1. In your repo create a folder `nodered/` with three files:
   - `flows.json`: the file you were given.
   - `settings.js`:
```js
module.exports = {
  uiPort: process.env.PORT || 1880,
  httpAdminRoot: false,          // no editor on the public internet
  flowFile: 'flows.json',
  httpRequestTimeout: 70000,
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || false,
  logging: { console: { level: 'info', metrics: false, audit: false } },
};
```
   - `Dockerfile`:
```dockerfile
FROM nodered/node-red:latest
# Production mode hides internal error details from outside callers.
ENV NODE_ENV=production
COPY --chown=node-red:node-red settings.js flows.json /data/
```
2. In Render: **New > Web Service**, **Language: Docker**, **Root Directory: `nodered`**, **Free**, **Health Check Path: `/iot/health`**.
3. Environment variable: `IRYO_BACKEND_URL` = `https://YOUR-BACKEND.onrender.com` (no trailing slash).
4. Put the Node-RED address in the ESP32 sketch (`NODERED_BASE_URL`).

## Register a device
```bash
curl -X POST https://YOUR-BACKEND.onrender.com/api/admin/devices -H "X-Admin-Key: YOUR_ADMIN_KEY" -H 'Content-Type: application/json' -d '{"deviceId":"IRYO-0001"}'
```
The reply holds the device's `ingestKey`. Put both values in the ESP32 sketch. The key is shown only once.
