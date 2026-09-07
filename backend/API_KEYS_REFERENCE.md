# Complete API Keys Reference — PCL Solutions

Every external service this application uses, where to get the key, and how to configure it.

---

## 1. MongoDB Atlas (Database)

| Field | Value |
|-------|-------|
| MONGO_URI | mongodb+srv://tech2tech254_db_user:***@cluster0.xgfuvrb.mongodb.net |

**How to get:** https://cloud.mongodb.com → Free M0 cluster → Database Access → Network Access → Drivers → Copy connection string
**Cost:** Free (512MB M0 cluster)

---

## 2. Safaricom M-Pesa Daraja (Payments)

| Field | Status | Notes |
|-------|--------|-------|
| MPESA_ENV | Set | sandbox (switch to production for live) |
| MPESA_CONSUMER_KEY | Set | Sandbox key from developer.safaricom.co.ke |
| MPESA_CONSUMER_SECRET | Set | Sandbox secret from developer.safaricom.co.ke |
| MPESA_SHORTCODE | NEEDS KEY | Use 174379 for sandbox, or your paid shortcode |
| MPESA_PASSKEY | Set | From Daraja portal |
| MPESA_CALLBACK_URL | NEEDS DOMAIN | Use ngrok for local dev |

**How to get:** https://developer.safaricom.co.ke → My Apps → Create app → Copy Sandbox credentials
**Cost:** Free (sandbox), KES 1,000+ (production shortcode)

---

## 3. Gmail SMTP (Email Notifications)

| Field | Status |
|-------|--------|
| EMAIL_HOST | Set (smtp.gmail.com) |
| EMAIL_PORT | Set (587) |
| EMAIL_USER | Set (manu.em.frank13@gmail.com) |
| EMAIL_PASS | Set (App Password) |

**How to get:** myaccount.google.com → Security → 2FA → App passwords → Create → Copy 16-char password
**Cost:** Free (500 emails/day)

---

## 4. Sanity CMS (Tech Hub Content)

| Field | File | Status |
|-------|------|--------|
| SANITY_PROJECT_ID | tech-hub/.env | Set |
| SANITY_AUTH_TOKEN | backend/.env | NEEDS KEY |
| SANITY_DATASET | tech-hub/.env | Set (production) |

**How to get:** https://sanity.io → Create project → API → Create token (Editor permissions)
**Cost:** Free (100K requests/month, 5GB assets)

---

## 5. MinIO (Object Storage — Self-Hosted)

| Field | Value |
|-------|-------|
| MINIO_ENDPOINT | localhost |
| MINIO_PORT | 9000 |
| MINIO_ACCESS_KEY | minioadmin |
| MINIO_SECRET_KEY | minioadmin |
| MINIO_BUCKET | pcl-uploads |
| MINIO_USE_SSL | false |

**How to get:** docker run -d --name minio -p 9000:9000 -p 9001:9001 minio/minio server /data
**Cost:** Free (self-hosted)

---

## 6. ImgBB (Free Image Hosting — Tech Hub)

| Field | Status |
|-------|--------|
| IMGBB_API_KEY | NEEDS KEY (optional) |

**How to get:** https://api.imgbb.com → Create account → Copy API key
**Cost:** Free (unlimited uploads, 32MB per image)

---

## 7. LiveKit (Video Conferencing)

| Field | Status |
|-------|--------|
| LIVEKIT_API_KEY | NEEDS KEY |
| LIVEKIT_API_SECRET | NEEDS KEY |
| LIVEKIT_URL | NEEDS URL |

**How to get:** https://livekit.io → Create project → Copy API Key, Secret, URL
**Cost:** Free (50K min/month cloud, unlimited self-hosted)

---

## 8. Redis (Caching — Self-Hosted)

| Field | Value |
|-------|-------|
| REDIS_HOST | localhost |
| REDIS_PORT | 6379 |
| REDIS_PASSWORD | (optional) |

**How to get:** docker run -d --name redis -p 6379:6379 redis:7-alpine
**Cost:** Free (self-hosted)

---

## 9. JWT Secret (Authentication)

| Field | Value |
|-------|-------|
| JWT_SECRET | CH8jihmkaUreneBRCkB+... (already set) |
| JWT_EXPIRE | 8h |

**How to generate:** openssl rand -base64 32
**Cost:** Free

---

## Summary — What is Missing

| Service | Key Needed | Priority |
|---------|-----------|----------|
| M-Pesa Shortcode | MPESA_SHORTCODE | CRITICAL |
| M-Pesa Callback URL | MPESA_CALLBACK_URL | CRITICAL |
| Sanity Auth Token | SANITY_AUTH_TOKEN | MEDIUM |
| ImgBB API Key | IMGBB_API_KEY | OPTIONAL |
| LiveKit Keys | LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL | MEDIUM |

## What is Already Working

| Service | Status |
|---------|--------|
| MongoDB Atlas | Connected |
| M-Pesa Consumer Key/Secret | Sandbox configured |
| Gmail SMTP | Configured |
| MinIO | Self-hosted, ready |
| Redis | Self-hosted, ready |
| JWT Secret | Generated |
| Sanity Project ID | Configured |
