// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
//
// Free notification system — email only via nodemailer.
// Replaces Africa's Talking (paid SMS/WhatsApp) with free SMTP email.
const { sendEmail } = require('./mailer');

const COMPANY_NAME = 'Postera Crescam Laude';
const _COMPANY_EMAIL = process.env.EMAIL_USER || 'info@pclsolutions.co.ke';

/**
 * Send an email notification (free — uses SMTP).
 * @param {string|string[]} to - email address(es)
 * @param {string} message - plain text body (wrapped in HTML)
 */
const sendSMS = async (to, message) => {
  try {
    const recipients = Array.isArray(to) ? to : [to];
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#0d1f35;color:#fff;padding:16px;border-radius:6px 6px 0 0;">
        <h2 style="margin:0;color:#c8973a;">${COMPANY_NAME}</h2>
      </div>
      <div style="background:#f4f7fa;padding:20px;border:1px solid #e8f0f8;border-radius:0 0 6px 6px;">
        <p style="color:#1a2a4a;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
        <hr style="border:none;border-top:1px solid #e8f0f8;margin:16px 0;">
        <p style="font-size:11px;color:#8a9bac;">This is an automated notification from ${COMPANY_NAME}.<br>Visit: <a href="https://pclsolutions.co.ke">pclsolutions.co.ke</a></p>
      </div>
    </div>`;

    await sendEmail({
      to: recipients.join(','),
      subject: `[${COMPANY_NAME}] Notification`,
      html,
    });
  } catch (err) {
    console.error('Notification email error:', err.message);
  }
};

/**
 * WhatsApp stub — kept for API compatibility.
 * Always logs instead of sending (no paid service).
 */
const sendWhatsApp = async (to, message) => {
  console.log(`[WhatsApp stub — email used instead] To: ${to} | ${message}`);
  await sendSMS(to, message);
  return true;
};

/**
 * Notify a customer via email (free).
 * @param {string} to        - email address
 * @param {string} message   - notification body
 * @param {'sms'|'whatsapp'|'both'} channel - ignored, always sends email
 */
const notifyCustomer = async (to, message, _channel = 'sms') => {
  await sendSMS(to, message);
};

module.exports = { sendSMS, sendWhatsApp, notifyCustomer };
