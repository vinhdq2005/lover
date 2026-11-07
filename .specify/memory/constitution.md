<!--
Sync Impact Report (temporary review material; remove before committing)
Version change: 1.0.0 -> 1.1.0
Rationale: additive product, stack, privacy, UX, and testing requirements; existing obligations retained.
Project name: Lover -> Lover - Our Story.
Modified principles (existing obligations redistributed and preserved):
- I. Specify Observable Outcomes -> XV. Follow Spec Kit with Traceable Delivery
- II. Keep Plans and Tasks Traceable -> XV. Follow Spec Kit with Traceable Delivery
- III. Deliver Independently Verifiable Stories -> XV. Follow Spec Kit with Traceable Delivery
- IV. Prefer the Simplest Sufficient Design -> XIII. Prefer Simple Architecture;
  XVI. Keep Changes Focused
- V. Record Validation Evidence -> XIV. Test Important Functionality
Added principles: I-XII; expanded principles XIII-XVI retain the prior five principles.
Added sections: none; Project Constraints and Development Workflow expanded.
Removed sections: none. The previous statement leaving language and framework unspecified
is superseded by the explicit TypeScript and React requirements.
Follow-up TODOs: none. No application implementation or template changes made.
-->

# Lover - Our Story Constitution

## Core Principles

### I. Write Modular, Maintainable TypeScript

Application code MUST use TypeScript and organize responsibilities into focused modules with
explicit interfaces and readable names. Shared behavior MUST have a clear owner; duplication and
coupling that obscure behavior MUST be addressed within the scope of the change. Modules MUST
remain understandable and maintainable without speculative abstractions.

### II. Build with React and Mobile-First Components

The interface MUST use React and reusable, responsive components. Layouts MUST start with narrow
mobile viewports and adapt to larger screens without losing content or essential controls.
Feature verification MUST cover representative mobile and desktop layouts.

### III. Preserve a Warm, Elegant Romantic Aesthetic

The visual system MUST use pastel pink, cream, and white as its core palette, with consistent
spacing, typography, and soft animations. Designs MUST communicate warmth and intimacy while
maintaining readable contrast and clear controls. Animation MUST support feedback or transitions
and respect reduced-motion preferences.

### IV. Protect Personal Memories and Data

Personal data, relationship text, and uploaded photographs MUST remain private throughout
collection, storage, retrieval, and display. Data MUST travel over encrypted connections and use
storage encryption provided by the selected services. Private content MUST NOT appear in public
assets, public caches, logs, or error messages. Specifications and plans MUST document collected
data, access boundaries, retention needs, and validation before implementation.

### V. Authenticate Before Private Access

Every request for private content MUST require a valid authenticated session before content is
returned. Unauthenticated and expired-session requests MUST be denied at the trusted service or
data boundary. Frontend route guards MUST NOT be treated as the security boundary.

### VI. Enforce Database and Storage Authorization

Database and object-storage policies MUST independently enforce couple membership for every
applicable read, write, update, and delete operation. Access MUST default to denial. Direct data
and storage requests that bypass the UI MUST receive the same authorization checks; privileged
backend operations MUST explicitly verify the caller's access before using elevated credentials.

### VII. Share One Couple Space Between Two Authorized Users

The application MUST support two authorized users sharing one private couple space. Each private
record and photograph MUST be associated with that space, and access MUST be limited to its
members. Membership changes MUST preserve a maximum of two authorized users, including under
concurrent requests. The shared space is the boundary for the couple's relationship memories.

### VIII. Prevent Unauthorized Joining and Cross-Space Access

Knowing an account identifier, couple identifier, or object path MUST NOT grant access or
membership. Joining MUST require explicit authorization from an existing authorized member or a
controlled initial setup process. Membership and ownership checks MUST run in trusted services or
data policies; clients MUST NOT be able to grant themselves membership. Enrollment and access
rules MUST deny outsiders and attempts to access another couple's data.

### IX. Validate Inputs and Photograph Uploads

All external inputs MUST be validated at the trusted boundary, with client validation used for
immediate feedback. Uploads MUST enforce an explicit allowlist of supported image types and
maximum file size defined in the feature plan. Validation MUST check actual content as well as
claimed type; filenames and client MIME values alone MUST NOT establish trust. Invalid,
unsupported, oversized, and unauthorized uploads MUST be rejected before becoming accessible.

### X. Configure Through Environment Variables and Protect Secrets

Environment-specific configuration MUST use environment variables. Secret service keys and other
privileged credentials MUST remain server-side and outside committed files, client bundles, logs,
and error responses. Browser-exposed configuration MUST contain only values explicitly safe for
public disclosure. Required configuration MUST be validated with actionable errors that do not
reveal secret values.

### XI. Provide Meaningful Interaction States

Every data-driven view and asynchronous action MUST provide applicable loading, empty, success,
and error states. Feedback MUST explain the current state and a useful next action without
revealing private details. Failed actions MUST NOT appear successful; recoverable failures MUST
provide a retry or correction path. Empty views MUST guide the couple toward the intended action.

### XII. Make the Interface Accessible and Easy to Use

Core journeys MUST work on mobile screens and with keyboard navigation. Controls MUST have
accessible names, visible focus, semantic structure, and readable contrast. Forms MUST associate
labels and errors with inputs; status feedback MUST be available to assistive technology.
Functionality MUST NOT depend solely on color, hover, or animation. Verification MUST include
keyboard use, responsive layout, and reduced-motion behavior where applicable.

### XIII. Prefer Simple Architecture

New dependencies, services, and abstraction layers MUST have a documented requirement or concrete
maintenance benefit in the plan. Added complexity MUST explain why a simpler approach is
insufficient. Speculative extension points MUST be deferred until required. Architecture MUST
prioritize privacy, reliability, and ease of use for two people.

### XIV. Test Important Functionality

Important functionality MUST have automated tests, including authentication, membership limits,
database and storage authorization, input and upload validation, and core memory workflows when
implemented. Security tests MUST exercise denied access as well as authorized use and MUST cover
direct data or storage access rather than only UI guards. Feature plans MUST identify these tests
and define suitable automated or manual checks for remaining behavior.

Each completed story MUST record checks and outcomes against its acceptance scenarios. Failed
required checks MUST be resolved before affected work is marked complete. Checks that cannot run
MUST be reported as unverified with the blocking reason, never as passing.

### XV. Follow Spec Kit with Traceable Delivery

Feature work MUST proceed through specification, planning, dependency-ordered tasks, and
implementation. Specifications MUST define observable requirements, prioritized user stories,
measurable success criteria, acceptance scenarios, and relevant edge cases. Assumptions MUST be
explicit; decisions affecting scope, data handling, or acceptance MUST be resolved before
dependent implementation begins.

Plans MUST reference specifications and document technical choices, dependencies, constraints,
and concrete paths. Tasks MUST map to stories or named shared prerequisites. Each story MUST have
an independent verification procedure and demonstrate its value without unfinished lower-priority
stories. Scope changes MUST update affected specifications, plans, and tasks before dependent
work continues.

### XVI. Keep Changes Focused

Implementation MUST remain within specified requirements. Changes MUST NOT add unnecessary
features or modify unrelated code. Necessary adjacent changes MUST be justified in the plan or
review record and verified for their impact. This keeps reviews focused and avoids unintended
changes to private relationship content or established behavior.

## Project Constraints

Lover - Our Story is a private, romantic web application for two people to preserve relationship
memories in one shared couple space. Privacy, reliability, and ease of use MUST guide technical
and product decisions. TypeScript and React are required; service providers, storage engines,
deployment targets, upload limits, and supported image formats MUST be selected and documented
in feature plans before dependent implementation.

Credentials MUST remain outside committed source and documentation. Personal content and
photographs MUST NOT become public through default database, storage, hosting, or sharing
settings. Every feature handling private data MUST define how its authentication, authorization,
and validation requirements are enforced and verified.

## Development Workflow

Planning MUST evaluate every core principle in its Constitution Check before research and again
after design. A failed gate MUST be resolved or covered by an approved exception before dependent
work proceeds.

Reviews MUST check requirement coverage, task traceability, design rationale, privacy boundaries,
responsive and accessible interaction states, and validation evidence. Task status MUST reflect
completed work and available evidence. Changes to public interfaces, authorization policies, or
persisted data MUST document compatibility effects and required migration steps before
implementation. Required checks MUST pass before affected work is accepted as complete.

## Governance

This constitution takes precedence over conflicting project workflow guidance. Specifications,
plans, tasks, and implementation reviews MUST check compliance with its applicable rules.

Amendments MUST document proposed rule changes, rationale, impact on existing work, and any
migration needed. The project owner or designated maintainer MUST approve an amendment before it
is adopted. Exceptions MUST identify the affected rule, justification, scope, and expiry or
remediation condition; they require the same approval and MUST be recorded in the feature plan.

Constitution versions MUST use semantic versioning: MAJOR for incompatible principle removals or
redefinitions, MINOR for new principles or materially expanded guidance, and PATCH for wording
clarifications that do not change obligations. Amendments MUST preserve the original ratification
date, update the last-amended date, and record the version impact. Initial adoption was version
1.0.0 on 2026-11-07; version 1.1.0 adds the project-specific engineering requirements.

**Version**: 1.1.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
