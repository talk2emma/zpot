# Consent prompt and privacy policy (iOS and Android)

## Why this is a consent prompt, not a "cookie banner"

A native app doesn't use browser cookies. The rules that make websites show cookie banners (ePrivacy Art. 5(3), as transposed in Portugal by Lei 41/2004, read with GDPR consent rules) cover storing or reading information on the user's **device** that isn't strictly necessary. Zpot's equivalent is the **"Your privacy choices"** sheet.

| Category | Examples in Zpot | Consent? |
|---|---|---|
| Strictly necessary | Sign-in tokens (iOS Keychain / Android Keystore), language, preferences, report draft, random install identifier (guest report ownership) | No. Explained in the sheet and the policy, and always on |
| Usage analytics | None installed in this build | Yes (`analytics`) |
| Personalised ads | None installed (ads flag off) | Yes (`personalised_ads`) |
| Marketing email | Not sent in this build | Yes (`marketing`) |

**There are no third-party analytics, advertising or crash SDKs in the app** (checked against `package.json`). The prompt says so plainly. Any code that adds such a tool **must** gate it with `hasConsent(kind, version)` from `src/store/consentStore.ts`.

## How the prompt meets the requirements

| Requirement | Implementation | Evidence |
|---|---|---|
| Freely given, no dark patterns | "Accept all" and "Reject all" share the same style and position; "Choose" offers per-purpose control | Jest: equal prominence test |
| No pre-ticked boxes | Optional purposes start off; the first screen shows no toggles | Jest |
| Can't be bypassed | Modal with no close button; Android back doesn't dismiss; the app is usable after either choice | `ConsentSheet.tsx` |
| Informed | Purposes explained, plus a link to the full policy (the prompt comes back after reading) | E2E-013 |
| Withdraw as easily as given | Profile › Privacy & permissions › Privacy choices | Jest, E2E-013 |
| Demonstrable (Art. 7(1)) | Device record (choices, policy version, time). Signed-in users also get a server ledger row with `document_version` and `source="consent_prompt"` | Backend tests (`test_consent_versions.py`); E2E-013 reads the ledger through the API |
| Re-consent on change | Bumping `PRIVACY_POLICY_VERSION` (env) changes `/config/` → `legal.privacy_version`, and the app asks again. A "yes" to an old version isn't treated as consent | Jest |
| Language | Shown only after the language is chosen; EN and PT-PT | Jest |

## Platform notes

* **iOS:** no App Tracking Transparency prompt is needed or shown, because Zpot doesn't track across other companies' apps. `PrivacyInfo.xcprivacy` declares the required-reason APIs used. App Store privacy "nutrition labels" must match section 2 of the policy.
* **Android:** no runtime permission is involved. The Play Console **Data safety** form must match section 2 of the policy. Debug builds on Android 17 show a "nearby devices" prompt; it comes from React Native's debug manifest (`ACCESS_LOCAL_NETWORK` for Metro) and isn't in release builds.

## Privacy policy

`src/screens/legal/PrivacyPolicyScreen.tsx`, with text in `src/i18n/locales/{en,pt-PT}.part2.json` (`policy.*`). It follows the GDPR Art. 13 structure:
1. Controller.
2. Data categories.
3. Purposes and lawful bases.
4. Device storage.
5. Recipients.
6. Transfers.
7. Retention (the real values from `settings.ZPOT`).
8. Automated decisions (report trust score).
9. Rights and the CNPD complaint route.
10. Children.
11. Changes.

It is reachable from the consent prompt, Register, Legal › Privacy, Privacy & permissions, and the deep link `zpot://privacy/policy`.

**Before release, the legal team must:**
* Complete the [bracketed] items: controller identity, DPO contact, processors, international transfers, and the consent/request-record retention period.
* Confirm the lawful bases and the minimum age (16 is assumed; Portugal sets 13 for information-society services, so confirm the intended policy).
* Approve the wording.

When they do, bump `PRIVACY_POLICY_VERSION` so existing users are asked again. **This build does not claim legal compliance; the policy is labelled as a draft in the app.**
