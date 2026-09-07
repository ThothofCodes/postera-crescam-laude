// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Scheduled Publish — Auto-publish articles when their scheduled time arrives

const { createClient } = require('@sanity/client');

const isConfigured = !!(
  process.env.SANITY_PROJECT_ID
  && process.env.SANITY_AUTH_TOKEN
  && process.env.SANITY_PROJECT_ID !== 'your-project-id'
);

let _sanityClient = null;
function getSanityClient() {
  if (!_sanityClient && isConfigured) {
    _sanityClient = createClient({
      projectId: process.env.SANITY_PROJECT_ID,
      dataset: process.env.SANITY_DATASET || 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
      token: process.env.SANITY_AUTH_TOKEN,
    });
  }
  return _sanityClient;
}

/**
 * Find and publish all articles whose scheduledAt has passed.
 * Runs every minute via cron.
 */
async function runScheduledPublish() {
  if (!isConfigured) return;

  try {
    const now = new Date().toISOString();

    // Find articles that are:
    // 1. In draft status (not yet published)
    // 2. Have a scheduledAt date that is in the past
    const articles = await getSanityClient()?.fetch(
      `*[_type == "article"
        && defined(scheduledAt)
        && scheduledAt <= $now
        && !(_id in path("drafts.**"))
      ] {
        _id,
        title,
        scheduledAt
      }`,
      { now },
    );

    // Also check drafts that have scheduledAt
    const draftArticles = await getSanityClient()?.fetch(
      `*[_type == "article"
        && defined(scheduledAt)
        && scheduledAt <= $now
        && _id in path("drafts.**")
      ] {
        _id,
        title,
        scheduledAt
      }`,
      { now },
    );

    const allToPublish = [...articles, ...draftArticles];

    if (allToPublish.length === 0) return;

    console.log(`[CRON] Scheduled publish: ${allToPublish.length} article(s) ready to publish`);

    for (const article of allToPublish) {
      try {
        // Publish the article
        await getSanityClient()?.request({
          method: 'PUT',
          uri: `/data/publish/${article._id}`,
        });

        // Clear the scheduledAt field after publishing
        await getSanityClient()
          .patch(article._id)
          .unset(['scheduledAt'])
          .commit();

        console.log(`[CRON] Published: "${article.title}" (${article._id})`);
      } catch (err) {
        console.error(`[CRON] Failed to publish "${article.title}":`, err.message);
      }
    }
  } catch (err) {
    console.error('[CRON] Scheduled publish error:', err.message);
  }
}

module.exports = { runScheduledPublish };
