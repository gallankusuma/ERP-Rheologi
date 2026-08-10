QC Cycle #1 follow-up review — revision `d7b1e65`.

Direction accepted. `qc.service.ts`, spec snapshot, shared batch gate, FPA Detail endpoints, and master parameter contract are the correct architecture.

Do NOT redesign again.

Please close these remaining blockers only.

**P0-A — Separate analysis evaluation from final workflow decision**

Current `resolveFpaStatus()` only evaluates parameter results.

This cannot be used directly as final workflow state.

Required semantics:

- Draft / Sample Received / On Progress / Review → `pending`
- Resampling → `pending`
- Explicit Rejected / Failed → `failed`
- Approved may become `passed` ONLY if all required pinned results are complete and passed.

Approval endpoint must:

1. evaluate pinned required results
2. if result != passed → reject approval with 400
3. only then set FPA Approved/Passed
4. sync batch/checkpoint passed

Reject endpoint must explicitly sync `failed`.

Resample endpoint must explicitly sync `pending`.

Never allow:
`FPA Approved + Batch passed + checkpoint failed/pending`.

**P0-B — Resampling must keep Production checkpoint linkage**

A child/new sampling run currently gets a new FPA id while `wo_qc_checkpoints.fpa_id` still points to parent.

Choose one canonical strategy:

- checkpoint stays linked to root FPA and resolver evaluates latest active run, OR
- when new-run is created, re-point checkpoint to new child FPA.

After resampling:
parent result must not leave Production checkpoint passed.

Child final approval must resolve the same Production checkpoint.

**P0-C — Harden canReleaseBatch**

No-FPA/no-QC batch must NOT return allowed=true.

Release requires explicit QC evidence:

- relevant FPA exists unless explicitly exempted
- final approval completed
- canonical FPA decision = passed
- batch qc_status = passed
- no pending/failed mandatory QC

An FPA with passing measurements but still On Progress/Review must NOT release a batch.

Legacy qc_results must not create a second weaker release path.

**P0-D — Fix Batch Release RBAC**

Current route uses:

`quality.batch-release : approve`

but seeded RBAC uses:

`approve_1 / approve_2`.

Use canonical permission, preferably final release = `approve_2` if this is final QC approval.

Also add permission enforcement to Batch Release:

- reject
- hold

Authentication alone is not sufficient.

**P0-E — Remove duplicate writable Quality Results contract**

`QualityResults.vue` still sends a DTO incompatible with `/quality/results`.

Do not just rename frontend fields and preserve two QC engines.

Canonical operational results should remain FPA analysis results.

Preferred:

- make `/quality/results` a read/report adapter over canonical QC/FPA data, OR
- remove manual write path from this page.

There must not be an independent user-selectable `pass/fail` result path bypassing pinned specifications.

**P0-F — Complete immutable specification snapshot**

Snapshot into `qc_analysis_results` must also include:

- `is_required`
- `param_type`

Resolver must NOT query current `qc_specifications.is_required` to evaluate an old FPA.

Server-side evaluation must NOT depend on current master `qc_parameters.param_type`.

Historical FPA must be evaluated against the pinned rule existing when the FPA/run was created.

For resampling, copy the entire snapshot including these fields.

**P0-G — Commit the actual DB migration**

Current application code references new QC columns, but repository migration `004_qc_tables.sql` does not contain them.

Add versioned migration / `ensureQcSchema()` for every new field used by Cycle #1, including FPA workflow fields, snapshot fields, and batch qc/release audit fields.

A fresh environment built only from repository migrations must work.

No manual-production-only ALTER dependency.

**P1 — Numeric evaluation**

Support:

- min + max → between
- min only → `actual >= min`
- max only → `actual <= max`

Do not leave valid one-sided specification permanently pending.

After revision, rerun focused negative smoke:

1. FPA results pass + explicit Reject → checkpoint failed.
2. FPA results pass + Resample → checkpoint pending.
3. Child resample passes + final approval → original WO checkpoint passed.
4. Failed/pending result + Approve #2 → 400.
5. Batch with no FPA → release rejected.
6. FPA passing but not approved → batch release rejected.
7. Approved fully-passed FPA → release succeeds.
8. normal QC role with final approval permission → release succeeds, no 403.
9. user without permission → release/reject/hold rejected 403.
10. change master spec after FPA creation → old FPA result remains unchanged.
11. fresh DB migration → QC flow boots without manual SQL.

Do not touch Production state machine or Production QC contract.

Production still expects only:

`wo_qc_checkpoints.status = pending | passed | failed`.
