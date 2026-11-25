# WSJ Release Candidate Verification

| Item | Status |
|---|---|
| Original Poland workbook included untouched | PASS: template bundled |
| 197 unique export columns and source schema | PASS: automated test |
| Public draft create, save, resume, submit and one-time code revocation | PASS: API tests |
| Guardian Other conditional + address reuse | PASS: rules tests |
| Allergy screening + severity conditions | PASS: rules tests |
| Mobility/accessible screening conditions | PASS: rules tests |
| 11 participant-facing steps from 14 approved sections | PRESENT; browser QA pending |
| Named CMT login and private API access | PASS: API tests |
| Patrol configuration, labels, admin record and travel admin APIs | PASS: API tests (not all UI paths manually checked) |
| Original 105-sheet Excel template preservation | PASS: generated test XLSX inspected |
| Full synthetic adult submit and XLSX preview | PASS: API test |
| SA → Poland summer/winter date-time conversion | PASS: automated tests |
| CMT correction code, alternate roles, browser flows | Implemented; field/role UI browser QA pending |
| Exact Poland importer UUID/label semantics | **BLOCKED**: external confirmation needed |
| POPIA/GDPR consent and retention approved | **BLOCKED**: CMT legal approval needed |
| Actual patrol names | **PENDING**: CMT configuration |
| Staging VPS and HTTPS domain | **NOT DEPLOYED**: SSH/DNS access needed |
| Interactive desktop/mobile browser acceptance | **NOT VERIFIED**: browser blocked localhost in build environment |

**Do not enter real children's passport or medical details into an unverified staging environment.**
