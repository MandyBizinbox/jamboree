# Delivery outcomes

## Public registration journey
- [ ] The first screen identifies exactly the source role choices: Adult Patrol Leaders; Contingent Management Team; Head of Contingent; International Service Team; Youth Participants.
- [ ] The journey captures date of birth early and calculates minor status using a configurable reference date, without assuming role implies adulthood.
- [ ] The journey asks who is completing the record and supports self, parent/legal guardian, and authorised representative routing.
- [ ] Applicable source-mapped fields are presented with per-step validation; hidden non-applicable fields are not treated as missing.
- [ ] Exact source dropdown labels and UUID keys from `wsj-fields.json` are preserved; nationalities and countries use searchable source lists.
- [ ] Minor records show guardian identity, authority, consent, and multi-child continuity; adult records skip guardian fields unless CMT configures an exception.
- [ ] Conditional visa, travel-document, carer, dietary, allergy, chronic-condition, medication, equipment, mobility, and disability follow-ups appear only when applicable.
- [ ] Participants can save drafts, resume them, review a completion summary, and submit only after required applicable responses and consent are complete.

## Secure persistence and governance
- [ ] Participant/guardian records persist in the managed database with role-aware access and immutable audit events.
- [ ] Statuses include Draft, Submitted, Needs correction, Approved, and Exported, with reviewer comments and change history.
- [ ] CMT-only review surfaces identify missing fields, anomalies, duplicates, consent state, and medical-access restrictions.
- [ ] Privacy language clearly distinguishes operational consent from CMT-approved POPIA/GDPR legal wording still required before launch.

## Template export
- [ ] Export writes into an updated copy of the original workbook, preserving worksheets, hidden metadata, styles, mappings, and row offsets.
- [ ] The source workbook must be uploaded and round-trip tested before production export; UUID-vs-label cell semantics and row 5 start must be confirmed with Poland/CMT.
- [ ] Section fields (including columns 82, 92, 106, 107, 113, 119, and 133) are not populated as questions.
- [ ] Export is idempotent, retriable, restricted to authorised CMT roles, and logged.

## Launch confirmations
- [ ] CMT supplies the official eligibility age policy and reference date.
- [ ] CMT confirms canonical country/NSO values and Patrol ID assignment rules.
- [ ] CMT/Poland confirms whether import cells require UUID keys or display labels.
- [ ] CMT approves privacy/consent language, cross-border processing, retention/deletion, and health-data access policy.
- [ ] Original `Template 26th WSJ Data.xlsx` is provided for validation and export implementation.
