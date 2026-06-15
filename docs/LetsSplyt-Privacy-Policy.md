# LetsSplyt Privacy Policy

**Effective Date:** June 7, 2026
**Last Updated:** June 7, 2026

---

## 1. Introduction

LetsSplyt ("we", "our", or "us") operates the LetsSplyt mobile application and related services (collectively, the "Service"). We are committed to protecting your personal information and your right to privacy.

This Privacy Policy explains what information we collect, why we collect it, how we use and protect it, and what rights you have over it. Please read it carefully before using our Service.

By using LetsSplyt, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use the Service.

---

## 2. Who We Are

LetsSplyt is operated by Pawan Lawale, an individual based in California, United States.

**Contact:**
Email: builder@letssplyt.com
Address: California, United States

---

## 3. Information We Collect {#information-we-collect}

### 3.1 Information You Provide Directly

| Data | Purpose | Stored as |
|---|---|---|
| **Phone number** | Account creation, OTP verification, identity | Encrypted (AES-256-GCM) + hashed (SHA-256 HMAC). Never stored in plaintext. |
| **Display name** | Shown to other group members during a bill-split event | Plaintext. This is a display name you choose, not your legal name. |
| **Payment handles** (e.g. Venmo username, CashApp $tag, Zelle contact) | Shared with other participants so they can pay you | Encrypted (AES-256-GCM). Never stored in plaintext. |

### 3.2 Information Collected Automatically When You Use the Service

- **Event data:** Restaurant bill details, item names, prices, tax, tip, and total amounts you enter or scan
- **Participant data:** Names and phone numbers of people you add to a bill-split event on their behalf (see Section 5.1)
- **Usage data:** App interactions, feature usage, and error logs. No advertising identifiers are collected.
- **Push notification token:** A device token used solely to deliver in-app notifications about your share of a bill

### 3.3 Information Collected from Guests (Non-App Users)

If someone adds you to a bill-split event and you do not have the LetsSplyt app:
- We collect your **phone number** to verify your identity via one-time passcode (OTP) and to send you your share of the bill via SMS
- We collect your **display name** as you enter it during the web join flow

Guest data is automatically and permanently deleted **90 days** after the event closes. See Section 6 (Data Retention).

### 3.4 Receipt Images and AI Processing

When you use the receipt scanning feature, you upload a photo of a restaurant receipt. This image is:
- Transmitted securely to our servers over an encrypted connection
- Processed by an AI service (Google Gemini) to extract item names, prices, tax, tip, and currency
- Stored in private, access-controlled cloud storage for the duration of the event
- Deleted when the event is closed or your account is deleted

**Automated processing disclosure:** LetsSplyt uses artificial intelligence to read and interpret receipt images. This automated processing extracts text and numbers from your receipt photo to calculate each person's share. This AI does not make any decisions about you as an individual — it only reads the contents of a restaurant bill. No profiling, scoring, or legally significant automated decisions are made about any user. You may review, edit, or override all AI-extracted data before any information is sent to other participants.

We do not use your receipt images or any data derived from them to train AI models.

### 3.5 Biometric Authentication

LetsSplyt offers optional biometric authentication (Face ID, Touch ID) as a convenience feature. **LetsSplyt does not collect, transmit, receive, or store any biometric data.** Biometric authentication is performed entirely by your device's operating system (iOS Secure Enclave or Android Biometric API). We never have access to your biometric information at any point.

---

## 4. How We Use Your Information

We use the information we collect only for the purposes described in this policy:

- **To verify your identity** via one-time passcode (OTP) sent by SMS
- **To split a bill** — calculating each person's share and presenting it to the group
- **To send payment requests** — delivering a personalised SMS to each participant with their share and payment links
- **To process receipt images** — using AI to read item names and prices from a photo you take
- **To send push notifications** — notifying you when a payment request is sent or confirmed
- **To maintain your account** — storing your display name, phone number, and payment handles so you do not need to re-enter them
- **To improve reliability** — using anonymised, aggregated error logs and usage data to fix bugs and improve performance

We do **not**:
- Sell your personal information to third parties
- Use your data for advertising or marketing
- Share your information with data brokers
- Use your data to train AI models

---

## 5. How We Share Your Information

We share your information only as necessary to operate the Service:

### 5.1 With Other Participants in Your Event

When you join or create a bill-split event, your **display name** is visible to other members of that event. Your phone number is never shared with other participants.

**When you add others to an event:** When you enter another person's name and phone number to add them to a bill-split event, we collect that information on their behalf. Those individuals are notified by SMS that they have been added to an event and are given the opportunity to opt out. By adding another person's contact details to LetsSplyt, you confirm that you have their permission to do so or that you have a legitimate reason to contact them about a shared bill.

### 5.2 With Service Providers

We use the following third-party services to operate LetsSplyt. Each provider is subject to data processing terms governing their use of your data, and may only use your data to provide their specific service to us:

| Provider | Purpose | Data shared | Privacy Policy |
|---|---|---|---|
| **Twilio** | Sending OTP verification codes and payment request SMS | Phone number (encrypted in transit) | [twilio.com/en-us/legal/privacy](https://www.twilio.com/en-us/legal/privacy) |
| **Supabase** | Database and file storage (hosted in the United States) | All account and event data | [supabase.com/privacy](https://supabase.com/privacy) |
| **Google (Gemini)** | AI processing of receipt images | Receipt images, extracted item text | [policies.google.com/privacy](https://policies.google.com/privacy) |
| **Expo / React Native** | Mobile app delivery and push notifications | Push notification device token | [expo.dev/privacy](https://expo.dev/privacy) |

### 5.3 Legal Requirements

We may disclose your information if required by law, subpoena, court order, or to protect the rights, property, or safety of LetsSplyt, our users, or the public.

### 5.4 Business Transfers

If LetsSplyt is acquired, merged, or its assets are transferred, your information may be transferred as part of that transaction. We will notify you at least 30 days before your data becomes subject to a materially different privacy policy.

---

## 6. Data Retention {#data-retention}

We retain your personal information only as long as necessary for the purposes described in this policy.

| Data type | Retention period | Why |
|---|---|---|
| App user account (display name, phone, payment handles) | Until you delete your account | Required to operate your account and fulfil split requests |
| Event data (items, amounts, splits) | Until you delete your account | Required to maintain your event history and settlement records |
| Receipt images | Until the event closes or your account is deleted | Required only during active event; no purpose thereafter |
| Guest data (display name, phone number) | 90 days after the event closes, then automatically and permanently deleted | Sufficient time for settlement to complete; retained no longer than necessary |
| SMS delivery logs | 30 days | Retained to investigate delivery failures; no purpose thereafter |
| Error and usage logs (anonymised) | 90 days | Sufficient for reliability analysis; no personal data retained after anonymisation |

When you delete your account, all personal information associated with your account is permanently deleted within 30 days, including your phone number, payment handles, event history, and receipt images. This action is irreversible.

---

## 7. How We Protect Your Information

We implement industry-standard security measures:

- **Phone numbers** are never stored in plaintext. They are stored in two encrypted forms: a one-way hash (SHA-256 HMAC) for lookups and an AES-256-GCM encrypted value for retrieval. The encryption keys are stored separately from the data.
- **Payment handles** (Venmo usernames, CashApp tags, etc.) are stored AES-256-GCM encrypted.
- **All data in transit** is encrypted using TLS 1.2 or higher.
- **Receipt images** are stored in a private, access-controlled storage bucket. No public URLs are generated.
- **Authentication tokens** are stored in your device's secure hardware enclave (iOS Secure Enclave / Android Keystore) and are never written to unprotected device storage.
- We do not log phone numbers or payment handles in application logs. Our logging infrastructure automatically scrubs personal information before writing to log storage.

Despite these measures, no method of electronic storage or transmission over the internet is 100% secure. We cannot guarantee absolute security.

**Security incidents:** In the event of a data breach that affects your personal information, we will notify you as required by applicable state law, including within the timeframes required by California Civil Code §1798.82 and equivalent statutes in other US states. Notification will be provided via the contact information associated with your account.

---

## 8. Your Rights {#your-rights}

### 8.1 All Users

You have the right to:
- **Access** your personal information by contacting us at builder@letssplyt.com
- **Correct** inaccurate information via the Profile screen in the app
- **Delete** your account and all associated data via Settings → Delete Account (processed within 30 days) or by contacting us
- **Export** your data by contacting us at builder@letssplyt.com

### 8.2 California Residents (CCPA/CPRA)

If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA), effective January 1, 2026:

- **Right to Know:** You may request a list of the categories and specific pieces of personal information we have collected about you in the past 12 months.
- **Right to Delete:** You may request deletion of your personal information. You can do this directly in the app (Settings → Delete Account) or by contacting us at builder@letssplyt.com.
- **Right to Correct:** You may request correction of inaccurate personal information via the Profile screen or by contacting us.
- **Right to Opt-Out of Sale or Sharing:** We do not sell or share your personal information for cross-context behavioural advertising. There is nothing to opt out of.
- **Right to Limit Use of Sensitive Personal Information:** We do not use sensitive personal information beyond what is necessary to operate the Service. No further limitation is required.
- **Right to Non-Discrimination:** We will not deny, charge different prices, or provide a lower level of service to you for exercising your privacy rights.
- **Global Privacy Control:** We honour Global Privacy Control (GPC) signals received through your browser or device as a valid opt-out of sale or sharing request.

**How to submit a request:** You may submit a CCPA rights request by either:
1. Using the in-app Delete Account feature (Settings → Delete Account), or
2. Emailing builder@letssplyt.com with the subject line "CCPA Rights Request"

We will respond within 45 days of receiving your request. If we need additional time (up to 90 days total), we will notify you of the extension and the reason within the initial 45-day period. We will not charge a fee for processing your request unless it is manifestly unfounded or excessive.

### 8.3 Other US State Residents

Residents of Virginia (VCDPA), Colorado (CPA), Texas (TDPSA), Connecticut (CTDPA), and other US states with applicable privacy laws have similar rights to those described above. Contact us at builder@letssplyt.com to exercise your rights. We will respond within the timeframe required by your applicable state law.

---

## 9. Children's Privacy

LetsSplyt is intended for users **18 years of age and older**. We do not knowingly collect personal information from anyone under 18. If we learn we have collected personal information from a person under 18, we will delete it promptly. If you believe we may have collected such information, contact us at builder@letssplyt.com.

---

## 10. Third-Party Payment Services

LetsSplyt does not process payments. When you tap a payment link in an SMS or in the app, you are redirected to a third-party payment service (such as Venmo, CashApp, Zelle, or Apple Pay). Your payment is made directly through that service, and LetsSplyt never sees, stores, or processes your financial account details, card numbers, or bank information.

Your use of those payment services is governed entirely by their own terms of service and privacy policies, which we encourage you to review. LetsSplyt has no control over and assumes no responsibility for the privacy practices of those third-party services.

---

## 11. SMS Communications {#sms-communications}

LetsSplyt sends two types of SMS messages:

1. **One-time passcodes (OTP):** Verification codes sent when you register or log in to confirm your phone number.
2. **Payment request messages:** A personalised message sent to each participant in a bill-split event containing their share of the bill and payment links.

These are transactional messages directly related to your use of the Service. They are not marketing or promotional messages.

**Consent:** Your consent to receive these messages is obtained on the registration screen before your phone number is submitted, in accordance with the Telephone Consumer Protection Act (TCPA).

**Opt-out:** You may opt out of payment request messages at any time by replying **STOP** to any SMS from LetsSplyt. Note that opting out of payment request messages means other users will be unable to send you bill-split requests via SMS. To re-enable SMS, reply **START**.

**Help:** Reply **HELP** to any LetsSplyt SMS for assistance, or contact builder@letssplyt.com.

**Rates:** Message and data rates may apply. Message frequency varies based on your usage of the Service.

---

## 12. Data Location

Your data is stored and processed in the United States. Our service providers (Twilio, Supabase, Google, Anthropic) operate globally and may process certain data outside the United States. Where they do so, we rely on their data processing terms to ensure equivalent standards of data protection are maintained.

---

## 13. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page.

- **Non-material changes** (e.g. clarifications, corrections): We will update the date. Your continued use of the Service constitutes acceptance.
- **Material changes** that affect how previously collected personal information is used: We will provide at least 30 days' advance notice via push notification or in-app notice, and where required by law, obtain your affirmative consent before the changes apply to your existing data.

---

## 14. Contact Us {#contact}

For privacy questions, data requests, or concerns:

**Email:** builder@letssplyt.com
**Web:** https://letssplyt.com

We aim to respond to all privacy inquiries within 5 business days.

---

*This Privacy Policy was prepared in accordance with the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA), effective January 1, 2026; the Telephone Consumer Protection Act (TCPA); the Children's Online Privacy Protection Act (COPPA); and applicable US state privacy laws including the Virginia Consumer Data Protection Act, Colorado Privacy Act, Texas Data Privacy and Security Act, and Connecticut Data Privacy Act.*
