# HelpMeWash Security Specification (Payload-First TDD)

## 1. Data Invariants
1. **Default Deny**: All unmatched Firestore paths are denied read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **PII Isolation on Bookings**: Bookings contain customer PII (`fullName`, `phone`, `address`, `postalCode`). Guests may create a booking (`isGuest == true`, `userId == ""`), and may receive their immediate confirmation in-app, but guests can never `get` or `list` `/bookings`. Signed-in customers may only `get` or `list` bookings where `resource.data.userId == request.auth.uid && resource.data.isGuest == false`. Only verified admins can list or manage all bookings.
3. **Loyalty Discount Integrity**: Guests cannot forge a signed-in loyalty discount (`isGuest == true` enforces `loyaltyDiscountRate == 0 && loyaltyDiscountAmount == 0`).
4. **Privilege Escalation Prevention**: Users cannot assign themselves admin roles or modify `/admins`, `/services`, `/gallery`, or `/siteConfig`. Only verified admins (`request.auth.token.email == 'trenexpl@gmail.com' && request.auth.token.email_verified == true` or an existing `/admins/{uid}` document) may write catalog, gallery, config, or admin records.
5. **Strict Schema & Bounds**: Every document enforces exact required and allowed key sets (`hasAll` + `hasOnly`), string length limits, positive numeric bounds, bounded item arrays (`items.size() >= 1 && items.size() <= 30`), and server-enforced timestamps (`request.time`).
6. **Immutability & Terminal State Locking**: `createdAt` and `userId` are immutable after creation. Once a booking reaches `completed` or `cancelled`, non-admin users cannot mutate it.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Guest PII Scraping (`list /bookings` as unauthenticated)** -> Expected: `PERMISSION_DENIED`.
2. **Customer Cross-Account Read (`get /bookings/{otherUserBooking}` as Customer B)** -> Expected: `PERMISSION_DENIED`.
3. **Guest Loyalty Discount Spoof (`create /bookings` unauthenticated with `loyaltyDiscountRate: 0.05`)** -> Expected: `PERMISSION_DENIED`.
4. **UID Spoofing on Create (`create /bookings` as User A with `userId: 'userB'`)** -> Expected: `PERMISSION_DENIED`.
5. **Shadow Field Injection (`create /bookings` with extra `isAdminVerified: true` field)** -> Expected: `PERMISSION_DENIED`.
6. **Self-Assigned Admin (`create /admins/{myUid}` as regular user)** -> Expected: `PERMISSION_DENIED`.
7. **Unverified Email Admin Spoof (`email_verified: false` matching admin email)** -> Expected: `PERMISSION_DENIED`.
8. **Customer Catalog Tampering (`update /services/wdf-6kg` setting `price: 0.01`)** -> Expected: `PERMISSION_DENIED`.
9. **Unauthorized Gallery Upload (`create /gallery/img1` as regular customer)** -> Expected: `PERMISSION_DENIED`.
10. **ID Poisoning (`create /bookings/abc$123` or 200-char ID)** -> Expected: `PERMISSION_DENIED`.
11. **Timestamp Forgery (`create /bookings` with backdated `createdAt`)** -> Expected: `PERMISSION_DENIED`.
12. **Terminal State Mutation (`update /bookings/{id}` by owner when `orderStatus == 'completed'`)** -> Expected: `PERMISSION_DENIED`.
