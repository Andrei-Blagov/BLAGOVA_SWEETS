# A1/F6 — Preview release recovery, 24.10.2026

Baseline: `f6327c34422060a070fe3a7bcde5ad489b1c60b6`, fetched and compared to PR #1;
new local branch `fix/preview-release-recovery`. Initial tracked tree clean.
This is a local candidate, not published or deployed. Main and PR #1 are unchanged.

## Problem and behavior

The baseline ERR trap missed explicit unhealthy exits; manual rollback could
leave a stale current-release SHA and accepted legacy health timeout without a
final successful check. Config writes before the old trap also lacked recovery.

Both entry points now use one EXIT handler. It captures the original nonzero
status, disables traps before recovery, and explicitly checks recovery commands.
The recovery routine is called once; success in recovery does not turn the failed
operation into success. Recovery is armed before config mutation, not image load.
Private per-operation snapshots preserve current config and previous-pointer
pairs. A failed pointer/marker write restores the baseline; marker is committed
only after health and expected-image checks. If recovery fails, no healthy SHA is
claimed and recovery-required is written (filesystem permitting). Stale operation
or recovery-required markers block later release operations pending inspection.

Legacy fallback remains supported. Successful legacy rollback records legacy
identity without a managed Git SHA and archives the managed pair in transaction
snapshots; failed legacy rollback reparks the preserved container before restoring
the managed runtime. First deploy with no predecessor restores an empty baseline.
Early config failures do not attempt Compose teardown on incomplete config.

The shared library is included in the existing SCP bundle. Workflow branch/event
gates, SSH credentials, environments and deployment targets are unchanged. Added
manifest validation uses local sources only. Shell files use LF through attributes.

## Evidence and limits

- `npm run test:preview-release`: **44/44 passed** on Windows Node 24.19.0 + Git Bash: 33 executable recovery scenarios, 10 deployment gate/CORS regressions, one manifest verification. Fake sleep removes waiting, not health-loop iterations. The final expanded run took about 130 seconds.
- Deployment/static and manifest tests were rerun after the packaging assertion: **11/11 passed**.
- `node scripts/check-release-manifest.mjs`: passed, all 31 normalized UTF-8/LF backend source hashes match; inventory completeness checked. Live schema/Edge parity remains explicitly unverified.
- `git diff --check` and staged diff check: passed. Repository pattern scanner passed on 288 tracked/staged files; built-assets scanner passed on 77 existing baseline text assets (no new application build was needed).
- After adding the guarded temp cleanup, the two lock-refusal executions passed again. No application/backend behavior or live state was changed for these checks.
- Initial harness failures were corrected locally: JavaScript fixture escaping, then NTFS permission-command shims. These are not counted as successful final runs. No production script permissions were relaxed to make tests pass.

The initial audit remains historical: Windows baseline JS 59/60, SQL command failed
on file URL conversion; its portable SQL copy passed separately. A1 does not fix
or reclassify those A5 defects. No application/Edge/schema/dependency changes and
no full app/DB/PG/provider acceptance rerun were required for shell/docs changes.

Real Docker/OVH recovery has **not** been accepted. Windows fixture shims Unix
mode bits; Linux CI run is pending publication. SIGKILL/power failure cannot run
EXIT; inspect stale state/snapshots before clearing markers. Disk failure can also
prevent marker writes. Snapshots stay private under the Preview state directory;
define retention separately, without exposing env files or deleting recovery data.

See [CURRENT_STATE](CURRENT_STATE.md), [manifest](RELEASE_MANIFEST.json),
[test scope](../tests/deploy/README.md). Manifest distinguishes historical frontend
acceptance/metadata from unverified deployed source parity, with normalized LF
SHA-256 inventory; it is not a live release attestation.

## Next operation

After local review, coordinate feature branch publication and PR explicitly; do
not push prototype or rerun deployment automatically. Authorized staging drill
and live manifest reconciliation remain before claiming a deployed F6 fix. Then
A2 addresses checkout pending intent/fingerprint/canonical response and durable
initial notification. A3/A4/A5 and knowledge stage 4 remain separate packages.
