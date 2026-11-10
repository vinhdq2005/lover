# Feature Specification: Lover - Our Story MVP

**Feature Branch**: `master` (no branch hook configured; feature directory is independent)

**Created**: 2026-11-07

**Status**: Draft - validated for planning

**Input**: Build a private Vietnamese romantic memory website for exactly two authorized
accounts sharing photos, memories, notes, letters, relationship milestones, and free email
change notifications. No public registration, sharing, feeds, payments, chat, AI, or videos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish and Access Our Private Space (Priority: P1)

As the first authorized partner, I create our private space and invite my partner so only
we can access our relationship content.

**Why this priority**: All other journeys depend on a trustworthy privacy boundary.

**Independent Test**: Provision the first account through controlled setup, create a space,
invite the second account, and attempt access as both partners and an outsider.

**Acceptance Scenarios**:

1. **Given** controlled first-account setup, **When** the authorized account signs in and
   creates the space, **Then** it becomes its first member without opening public enrollment.
2. **Given** one vacant partner slot, **When** the intended verified email accepts a valid
   invitation, **Then** the space has two members who can log in independently.
3. **Given** an expired, revoked, reused, or wrong-recipient invitation, **When** acceptance
   is attempted, **Then** membership is unchanged and private content remains inaccessible.
4. **Given** simultaneous invitation acceptances, **When** membership is committed,
   **Then** at most two accounts belong to the space.
5. **Given** no valid membership or session, **When** a person requests a private page,
   record, photograph, or upload directly or changes its identifier, **Then** access is denied
   without exposing content or confirming whether a particular private record exists.
6. **Given** a signed-in partner, **When** they log out or their session expires, **Then**
   subsequent private access requires login and previously displayed private views are cleared.

### User Story 2 - Preserve and Revisit Memories (Priority: P1)

As either partner, I save a memory with photographs and revisit it by date.

**Why this priority**: Preserving relationship memories is the primary product value.

**Independent Test**: With two provisioned members, create dated memories with and without
photos, browse and filter them, then verify author and partner edit permissions.

**Acceptance Scenarios**:

1. **Given** membership, **When** I save a title, description, event date, and optional photos,
   **Then** the saved memory identifies me as creator and is readable by both partners.
2. **Given** memories spanning months, **When** I open the timeline, **Then** newest event dates
   appear first grouped by month and year, with a stable order for equal dates.
3. **Given** a date range, **When** I filter the timeline, **Then** only memories within its
   inclusive boundaries appear, or a helpful empty state appears when none match.
4. **Given** my memory, **When** I update it or confirm deletion, **Then** the change persists;
   my partner cannot edit or delete it, including through a direct request.
5. **Given** invalid inputs or a failed save, **When** I submit, **Then** specific Vietnamese
   feedback appears, my text is preserved for correction, and no success is falsely reported.

### User Story 3 - See Our Story and Relationship Milestones (Priority: P1)

As either partner, I see our shared identity, relationship duration, and upcoming special dates.

**Why this priority**: A personalized home makes the space meaningful even before many memories exist.

**Independent Test**: Configure profiles, timezone, relationship and first-meeting dates, then
verify the home and counters using fixed dates around midnight, anniversaries, and leap years.

**Acceptance Scenarios**:

1. **Given** configured profiles, **When** I open home, **Then** I see both names and profile
   photos or placeholders, relationship start date, elapsed days, featured photo or placeholder,
   up to five recent memories, and the next three configured milestone occurrences.
2. **Given** a start date and couple timezone, **When** midnight passes there or I resume a
   previously hidden page, **Then** the counter reflects elapsed calendar dates, with zero
   elapsed days on the start date, regardless of my device timezone or daylight-saving shifts.
3. **Given** an optional first-meeting date, **When** I view the love counter, **Then** its
   separately labeled elapsed days appear without replacing the relationship counter.
4. **Given** a 100-day, 365-day, or yearly milestone, **When** it is today, **Then** it is
   highlighted; future occurrences show their dates and remaining days.
5. **Given** membership, **When** I update the relationship date or timezone, **Then** counters,
   upcoming dates, and home summaries use the new values consistently.

### User Story 4 - Organize and View Photographs (Priority: P2)

As either partner, I upload multiple photographs, organize albums, and view images comfortably.

**Why this priority**: A gallery provides photo browsing beyond the timeline.

**Independent Test**: Upload a batch, assign albums and descriptions, open the viewer, then
exercise allowed updates and deletion as uploader and as the other partner.

**Acceptance Scenarios**:

1. **Given** selected photographs, **When** uploading, **Then** each file shows progress and
   success or failure; valid files can finish even when another file is rejected.
2. **Given** an uploaded photograph, **When** either member opens its grid item, **Then** a
   full-screen viewer displays it with description and date and supports next, previous, and close.
3. **Given** my uploaded photo, **When** I edit its metadata, move it to an album, or confirm
   deletion, **Then** the result appears in every referencing view; my partner has read access only.
4. **Given** an album I created, **When** I rename or delete it, **Then** its photos remain
   available outside the deleted album; another member cannot change my album.
5. **Given** unsupported, disguised, oversized, or interrupted uploads, **When** processed,
   **Then** errors identify affected files, retry is available where appropriate, and no broken
   photograph appears as successfully saved.

### User Story 5 - Write Shared Diary Entries and Letters (Priority: P2)

As either partner, I write a journal entry or love letter for our shared space.

**Why this priority**: Text captures memories that photographs cannot convey.

**Independent Test**: Create both entry types with Vietnamese text, read them as the partner,
then edit and delete as author and attempt the same as the other member.

**Acceptance Scenarios**:

1. **Given** membership, **When** I save a diary entry or letter with title, content, and date,
   **Then** both partners can read it with my authorship and its entry type shown.
2. **Given** entries on different dates, **When** I browse, **Then** entries appear newest first
   with stable ordering for ties and Unicode text preserved.
3. **Given** my entry, **When** I update it or confirm deletion, **Then** the result persists;
   the other member cannot modify it. Canceling deletion leaves it unchanged.

### User Story 6 - Manage Personal and Couple Settings (Priority: P2)

As either partner, I maintain my profile and our shared relationship details.

**Why this priority**: Settings keep the couple identity and date calculations accurate.

**Independent Test**: Update each member's own profile and shared settings, then reopen them
as the other partner and check that unauthorized profile changes are rejected.

**Acceptance Scenarios**:

1. **Given** membership, **When** I change my display name or profile photo, **Then** the update
   appears across home and authorship displays; I cannot change my partner's personal profile.
2. **Given** membership, **When** I update the shared couple name, featured photo, dates,
   timezone, or custom anniversary, **Then** both members see the saved settings.
3. **Given** conflicting concurrent edits, **When** the later stale edit is submitted,
   **Then** I am asked to refresh or reconcile rather than silently losing a partner's update.

### User Story 7 - Receive Private Partner Notifications Without Charges (Priority: P2)

As either partner, I see in-app notifications about my partner's changes and optionally receive
email when a verified no-charge sender is available. My own changes do not notify me.

**Why this priority**: Durable in-app updates keep us informed even without an email sender domain.

**Independent Test**: Make changes as each member, check only the other member's inbox, then test
email disabled, sender unavailable, accepted mail, duplicate processing, outage and quota exhaustion.

**Acceptance Scenarios**:

1. **Given** a committed notifiable change by A, **When** B opens their inbox, **Then** B sees one
   notification with actor, generic category, time and authenticated link; A receives none.
2. **Given** an unread notification, **When** its recipient marks it read, **Then** the read status
   persists; the actor cannot read or alter the recipient's notification.
3. **Given** verified sending eligibility and free allowance, **When** email processing succeeds,
   **Then** only the other enrolled partner's verified email receives the generic notification.
4. **Given** unavailable sender verification or disabled email, **When** a change is saved,
   **Then** its in-app notification is available and external delivery is explicitly disabled.
5. **Given** external quota exhaustion or failure, **When** content is saved, **Then** content and
   in-app delivery remain successful, external status is accurate, and no paid fallback occurs.
6. **Given** retries or concurrent processing, **When** the same event is processed, **Then** no
   duplicate in-app notification appears; uncertain external acceptance is reconciled rather than
   blindly resent. Email subjects/bodies never contain private titles, text, images or public links.

### Edge Cases

- Initial setup already consumed, no partner yet, simultaneous joins, invitation accepted by the
  wrong account, expired invitation, and attempted third membership all preserve the access boundary.
- Session expiry during editing or uploading stops private operations; unsaved content is not
  exposed after logout, and retry requires authentication.
- Start date today gives zero; future start or meeting dates are rejected. First meeting may be
  absent, but if supplied cannot be after the relationship start. Invalid dates are rejected.
- Counter calculations use calendar dates, including leap years and timezone changes. February 29
  annual anniversaries occur February 28 in non-leap years. First yearly anniversary and day 365
  may differ and must retain distinct labels.
- Empty timelines, no albums, missing photos, no anniversary yet configured, and filters matching
  nothing provide relevant guidance instead of blank or broken views.
- Equal event dates sort by creation time descending, then stable unique identity. Reversed filter
  ranges are rejected; single-day ranges include the entire event date.
- Failed uploads, spoofed image types, oversized files, batch partial success, storage exhaustion,
  and retries never produce accessible unvalidated media or duplicate successful items.
- Deleting a photo used by a memory or featured image removes references and displays a placeholder;
  deleting a memory leaves its gallery photos intact. Album deletion does not delete photos.
- Concurrent edits or deletion while another member is viewing produce a refresh/reconciliation
  message. Repeated deletion is harmless and never affects unrelated content.
- Vietnamese combining characters, emoji, long text, and script-like text display safely without
  truncating stored valid content or executing user-supplied markup.
- Email quota exhaustion, provider outage, bouncing addresses, and empty second-member slot never
  roll back content changes or send content to unverified/invited-only recipients.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (US1)**: The system MUST permit controlled first-account setup once and MUST NOT offer
  unrestricted registration or allow outsiders to create additional couple spaces.
- **FR-002 (US1)**: Authorized accounts MUST securely log in and log out; expired sessions MUST
  require authentication again. Failed login feedback MUST NOT reveal private account existence.
- **FR-003 (US1)**: The first member MUST create the single private couple space and invite only
  the intended verified email address into its vacant second slot. Invitations MUST be single-use,
  expire after 48 hours, and support revocation and replacement before acceptance.
- **FR-004 (US1)**: The space MUST allow one member during setup and exactly two in normal use,
  enforcing a maximum of two even for concurrent requests. Joining MUST require a valid invitation
  and matching verified email. Clients MUST NOT grant themselves membership.
- **FR-005 (US1)**: All private pages, records, photos, and uploads MUST require authentication
  and couple membership, independently enforced for stored records and media. Changing URLs,
  identifiers, or making requests outside the interface MUST NOT bypass checks.
- **FR-006 (US2, US4, US5, US6)**: Both members MUST read shared content and create their own;
  only its author/uploader/album creator MUST be permitted to edit or delete that content. Each member MUST
  edit only their own personal profile; either member MUST edit shared couple settings.
- **FR-007 (US3)**: Home MUST display both names/photos, relationship start date and elapsed days,
  a featured photo, five most recent memories by event date, and the next three milestone
  occurrences, showing all available items when fewer exist and guided empty states otherwise.
- **FR-008 (US3)**: The relationship counter MUST equal the number of calendar date boundaries
  between the start date and today in the configured couple timezone, with start day equal to zero.
  It MUST refresh at couple-local midnight and when resuming a previously hidden page.
- **FR-009 (US3, US6)**: Either member MUST edit the relationship start date, optional first-meeting
  date, and couple timezone. Dates MUST be valid and no later than couple-local today; a supplied
  first-meeting date MUST be on or before the start date. The meeting counter MUST be separately labeled.
- **FR-010 (US3)**: The system MUST highlight relationship day 100, day 365, yearly relationship
  and configured first-meeting anniversaries, plus user-defined annual milestones. Each occurrence
  MUST have a label, date, and days remaining; today's events MUST appear before future ones.
  February 29 annual dates MUST observe February 28 in non-leap years. Past one-time milestones
  MUST NOT recur; equal-day occurrences MUST remain distinctly labeled.
- **FR-011 (US2)**: Each memory MUST store a required title, optional description, required event
  date, creator, and zero or more photos; both members MUST create and view memories.
- **FR-012 (US2)**: The timeline MUST group by event month/year, sort newest first, and support
  inclusive start/end date filtering. Equal event dates MUST sort by creation time then stable
  identity. Authors MUST be able to edit and confirm deletion of their memories.
- **FR-013 (US4)**: Members MUST select multiple photographs in one batch, see per-file progress
  and results, retry failed files, and retain successful files after partial batch failure.
- **FR-014 (US4)**: Only valid JPEG, PNG, and WebP photographs up to 10 MiB each MUST be accepted,
  with at most 20 selected files per batch. File contents MUST match an allowed image type;
  invalid or unauthorized files MUST be rejected before becoming accessible. Profile photos
  MUST use the same image validation rules.
- **FR-015 (US4)**: The gallery MUST provide a responsive grid, album browsing, and full-screen
  next/previous/close controls showing photograph descriptions and dates. Uploaders MUST edit
  their photo description/date and album assignment, and confirm photograph deletion.
- **FR-016 (US4)**: Images MUST additionally respect a 24-megapixel decode safety limit. Each photo MUST belong to at most one album and MAY be referenced by memories.
  Members MUST create albums; only the creator MUST rename/delete an album. Members MAY assign
  their photos to either member's album. Album deletion MUST retain photos unassigned; memory
  deletion MUST retain gallery photos; photo deletion MUST clear all its references.
- **FR-017 (US5)**: Members MUST create shared diary entries and love letters with required title,
  content, date, author, and entry type. Both members MUST read them chronologically newest first;
  only the author MUST edit/delete them. There MUST be no author-only privacy mode in the MVP.
- **FR-018 (US6)**: Members MUST update their own display names and profile photos, and either
  MUST update the shared couple name, featured photo selected from the gallery, timezone, and
  relationship dates. Either member MUST create/edit/delete custom annual milestones.
- **FR-019 (US2, US5, US6)**: Text MUST preserve Vietnamese Unicode and emoji and display safely.
  Required text MUST reject whitespace-only values. Names MUST allow 1-100 characters; memory,
  album, entry, and milestone titles 1-200; photo descriptions 0-2,000; memory descriptions
  0-10,000; diary/letter content 1-50,000. Length MUST count Unicode code points.
- **FR-020 (all stories)**: Each data-driven view and action MUST show applicable loading, empty,
  success, and actionable error states in Vietnamese. Failed saves MUST NOT appear successful;
  recoverable errors MUST offer correction or retry. Destructive actions MUST require confirmation.
- **FR-021 (all stories)**: The interface MUST use pastel pink, warm cream, white, soft shadows,
  and subtle transitions; it MUST remain usable from 320-pixel mobile widths through desktop,
  with keyboard navigation, visible focus, labeled controls, readable contrast, accessible
  status feedback, and reduced-motion support.
- **FR-022 (all stories)**: Personal content MUST remain private in transit, storage, and display;
  public assets, caches, logs, and errors MUST NOT expose it. Privileged service credentials
  MUST NOT be visible to users. Relationship content (memories, photos, diary/letters and saved profiles/settings)
  MUST persist until explicitly changed or deleted;
  deleted content MUST immediately disappear from application access, and retained backup copies,
  if application-managed, MUST expire within 30 days and MUST NOT be ordinarily browsable.
  Operational notification/event/delivery and closed batch metadata MUST expire after 90 days;
  receipts MUST survive operation expiry plus 24 hours. Cleanup MUST NOT delete relationship
  content. Settings/help MUST explain these retention periods.
- **FR-023 (US7)**: Successful create, update and delete actions on memories, photos, albums,
  diary/letters, personal profiles, couple settings and milestones MUST create one durable in-app
  notification for only the other current couple member, never the actor. A batch MUST generate at most one event/partner notification at first successful file commit;
  later successes MUST update its summary without another notification/email or resetting read
  state. Zero-success batches MUST NOT notify. Failed/no-op saves, reads, login/logout and delivery/read-status
  changes MUST NOT notify. If no partner exists at commit, no recipient or later replay is created.
- **FR-024 (US7)**: Recipients MUST see their own chronological notifications with actor, generic
  category, time, authenticated link and persisted unread/read state. Only the recipient MUST access
  that inbox. Optional Vietnamese email MUST go only to that partner's verified address, never
  contain private titles/text/photos or public media links, and link deleted items to a surviving
  section. Sender eligibility MUST be verified before production email is enabled; a hosting
  subdomain MUST NOT be assumed to establish sender-domain ownership.
- **FR-025 (US7)**: External email MUST default to disabled and use only a verified no-charge
  sending option. Each member MAY opt in/out of their own email notifications (default off), without
  disabling in-app notifications or replaying past email. This preference was requested on 2026-11-10.
  There MUST be no automatic paid fallback. If sender verification is unavailable, all
  core journeys and in-app notifications MUST remain usable. The recipient MUST see accurate
  disabled, pending, accepted, failed, or quota-delayed status; accepted MUST NOT imply delivered.
  Eligible failures MAY be retried within free limits. Duplicate app events MUST be suppressed;
  unknown external acceptance MUST NOT trigger blind retries beyond provider deduplication support.
- **FR-026 (US2, US4, US5, US6)**: Stale edits MUST be detected and offered refresh/reconciliation
  instead of silently overwriting newer content. Upload/save retries MUST NOT duplicate successful
  content. Interrupted operations MUST leave existing saved content usable.
  Mutations MUST use server-issued expiring operation identities bound to actor, command and payload;
  each attempt MUST recheck authorization. Expired/altered operations MUST fail even after receipt
  cleanup. Stable batch/file identities MUST preserve successes and retry only failed/incomplete
  files; closed batches MUST reject further changes.

### Key Entities *(include if feature involves data)*

- **Account/Profile**: Authorized identity, verified email, display name, optional private profile photo.
- **Couple Space/Membership**: One shared identity, its two authorized members (one during setup),
  relationship start, optional first meeting, timezone, and featured photo.
- **Invitation**: Intended email, issuer, expiration, and pending/accepted/revoked state for the second slot.
- **Memory**: Title, description, event date, creator, creation/update times, and photo references.
- **Photograph**: Private image, uploader, description, event date, optional album, and upload outcome.
- **Album**: Couple-scoped title, creator, and collection of photograph assignments.
- **Diary Entry/Letter**: Shared title/content, entry type, author, entry date, creation/update times.
- **Milestone**: Label, annual date or derived relationship-day threshold, and upcoming occurrence.
- **Change Notification**: Committed change identity, actor, category, other-member recipient, read state, delivery status,
  and retry outcome; carries no copy of private relationship text or photos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, the authorized couple completes initial setup and invitation
  acceptance within five minutes of receiving the invitation, excluding external email delays.
- **SC-002**: Every tested outsider, expired-session, wrong-recipient, altered-ID, direct-media,
  and concurrent-third-member attempt is denied; no private text or image is disclosed.
- **SC-003**: Each partner can independently create, find, update, and delete their memory,
  gallery photo, and diary entry; all attempted partner-owned modifications are denied.
- **SC-004**: Counter results match all reference cases covering start day, midnight, device/couple
  timezone differences, leap day, and timezone changes; no reference case differs by a day.
- **SC-005**: With 1,000 memories and 2,000 photographs, at least 95% of home, timeline-filter, and
  initial gallery views become usable within three seconds on a measured 10 Mbps connection
  with 100 ms latency, excluding initial authentication and full-resolution photo downloads.
- **SC-006**: All upload acceptance cases correctly distinguish supported, invalid, disguised,
  oversized, interrupted, and partially successful batches, with an outcome visible for every file.
- **SC-007**: Both intended users complete login, memory creation, photo viewing, diary creation,
  date editing, and logout on mobile without assistance, horizontal page scrolling, or lost controls.
  Keyboard-only checks complete the same applicable journeys with visible focus.
- **SC-008**: All tested committed changes create exactly one other-member in-app notification
  and zero actor notifications, visible within 60 seconds while the recipient view is active.
  With verified sending, provider availability and available free allowance, 95% of controlled
  email tests reach only the
  partner within five minutes. Disabled-sender/quota/outage tests incur zero charges, preserve
  content and in-app notifications, and show accurate external delivery status.
- **SC-009**: Vietnamese text and emoji round-trip unchanged in every supported text field;
  all user-facing action feedback is Vietnamese and all tested states provide a useful next action.
- **SC-010**: Both partners describe the reviewed mobile experience as private, easy to use, and
  consistent with the requested warm romantic design in a recorded acceptance walkthrough.

## Assumptions

- This MVP is one deployment for one couple. Operator-controlled setup authorizes the first account;
  the invitation authorizes only the second. Replacing an accepted partner, dissolving the space,
  and account self-deletion are outside this version; no automatic reassignment is permitted.
- Ownership defaults to author-only changes for memories, photos, albums, and entries; both members
  read all saved relationship content. Personal journals are personal authorship, not secret drafts.
- The couple timezone defaults to Asia/Ho_Chi_Minh and is editable. Dates are date-only values;
  memory/diary dates describe past or present events and cannot exceed couple-local today.
  A missing photo date defaults to its upload date in that timezone. Calendar dates are formatted
  for Vietnamese readers. Optional years/months/days duration is deferred; elapsed days is required.
- First meeting is optional and relationship start is required during setup. Custom milestones
  require label and original date and recur annually. The next three occurrences include today's
  events and derived milestones, considering further years if needed to fill the list.
- Images are limited to JPEG, PNG, and WebP, 10 MiB each, and 20 per batch as explicit MVP defaults.
  Videos, animated formats, HEIC conversion, and image editing are outside scope.
- Notifications are in-app first, with optional email for partner content/settings changes,
  excluding oneself. Invitation mail is an enrollment message sent only to the intended recipient, not a
  change notification to an outsider. There are no anniversary reminder emails in this version.
- Email is best effort within the selected free allowance; unlimited zero-cost delivery cannot be
  assumed. Planning MUST validate a no-charge delivery option, its limits and sender requirements,
  and visible quota behavior before implementation. Domain purchases and paid plans are not authorized.
- Dependencies include a controlled setup operator, two verified email addresses, private persistent
  content/media capacity, and optional no-charge email sending eligibility. No provider or implementation
  choice is made here. Capacity limits MUST produce clear errors without losing existing content.
- Out of scope: public feeds, public sharing links, payments, chat/realtime messaging, AI-generated
  content, videos, additional couples or accounts, and unrelated social features.

### Planning Clarifications (2026-11-07)

- The latest user instruction supersedes the initial self-notification request: notify only the
  other current authorized member, never oneself; preserve a private in-app inbox even without email.
- External email is optional and disabled by default. Sender eligibility and free limits must be
  checked before enabling; a netlify.app hostname supplies no sender-domain authentication.
- Controlled identity verification/provisioning, private invitation handoff, password login and
  operator-assisted recovery must remain usable without external mail delivery.


### Approved Remediation Clarifications

- First-run UI permits only the operator-approved authenticated first account to create the singleton
  without prior membership. Invitation acceptance requires its verified intended identity; neither
  exception permits private reads. First member can create/revoke/copy an invitation for private handoff.
- Operations expire 30 days after server issuance; receipts survive expiry +24h. Changed requests
  get new operations; old IDs cannot be renewed. Batch file identities remain stable across commands.
- Upload batches close explicitly or after one hour; first success creates the only partner notice,
  later successes update a mutable summary with stable read state. Generic email omits changing counts.
- Signal email immediately after commit and recover on a one-minute schedule. Five-minute external
  delivery depends on eligible sender, available provider and free allowance, never blocking in-app delivery.
- Acceptance checks cover arbitrary-account bootstrap denial, clean migration replay, tampered/expired/
  cross-actor operation replay after receipt cleanup, partial-file retries/lost responses, one batch
  notification/email, safe retention cleanup and missed-dispatch recovery.

### Remaining Finding Remediations

- Image runtime remediation (2026-11-08): selection limits remain JPEG/PNG/WebP <=10 MiB and
  <=24 MP. The browser prepares a compressed, metadata-free JPEG <=1600 longest edge before
  reservation/upload, retaining aspect ratio and orientation; transparency is composited on white.
  Explain that only this compressed copy is saved, not the full-resolution source. Preparation
  failure must not fall back to uploading raw bytes. Server finalization independently checks and
  fully decodes staged bytes within the smaller stored-image bounds; larger raw requests fail 422
  before decoding. Authentication, private staging, reservations and per-file/batch semantics remain
  mandatory. This changes internal media processing, not couple access or source-selection limits.

- Operation issuance requires the actual intended command inputs, relevant resource/version and
  upload identifiers. Authenticate and authorize that intent before issuing; derive its canonical
  hash server-side, never trust client hashes for access or log sensitive payloads. Modified,
  mismatched, unauthorized or expired operation requests must fail without a content change.
- Upload notification summaries are readable only by the intended notification recipient who is
  a current authorized member of that same couple. Show only the necessary batch reference, counts
  and status; deny unrelated accounts, the actor's inbox access and cross-couple references. Later
  successes update the same summary without another notification/email or resetting read state.
