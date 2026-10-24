# Isolated Preview release recovery regression tests

Run from the repository root: `npm run test:preview-release` (Node 24 and Bash).
Linux uses system Bash; Windows defaults to Git Bash in `C:/Program Files/Git/bin/bash.exe`.
Override only the test executable via `BLAGOVA_TEST_BASH` if installed elsewhere.

The Node harness creates a fresh temporary root per scenario, runs the **actual**
deploy/rollback scripts and shared library, and asserts resulting config files,
previous pointers, marker, fake runtime image and recovery call counts.
`tests/deploy/mock-docker.sh` never forwards to real Docker and rejects unknown
commands. `sleep` is immediate and `flock` is simulated, including lock refusal.
Fault injection uses narrow `mv`/`cp` wrappers; normal file copies/moves use real
coreutils. Windows alone shims Unix `install/chmod` permissions on NTFS; Linux
uses the real permission commands. These tests do not certify host permissions,
real Docker/Compose behavior, cross-process flock, network, TLS or provider/API
delivery. No SSH, Supabase, mail or real Docker executable is invoked.

Scenarios cover managed deploy and rollback success, unhealthy, timeout, partial
Compose failure, inspect error, missing container ID, wrong image, marker-write
failure, partial previous-pointer rotation, failed recovery (exactly once), lock
refusal, unresolved operation/recovery state; early config write failure with a
managed or empty predecessor; first release failure; healthy legacy rollback,
unhealthy/timeout legacy rollback and failed first managed legacy transition.

A future authorized staging drill must validate actual Compose/image/health and
filesystem permissions. SIGKILL/power loss cannot execute EXIT recovery: retained
`operation-in-progress` plus private transaction snapshots require manual
inspection. Both entry points refuse unresolved state; no automatic marker
deletion/retry is used to pretend a successful recovery.
