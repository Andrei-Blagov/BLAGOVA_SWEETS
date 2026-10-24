# Preview recovery drill: separate ops review candidate

Application remains at `58209191d20dee16b22a5d2a1a753c36080860ed`.
These files are outside its checkout, uncommitted, unpublished and unexecuted on OVH.
The script embeds only the three unchanged, hash-verified A1 shell blobs from that SHA.

Proposed patch destinations:

- `preview-recovery-drill.py` → `scripts/preview-recovery-drill.py`
- `preview-recovery-drill.workflow.yml` → `.github/workflows/preview-recovery-drill.yml`
- `test_archive_safety.py` → `tests/ops/test_preview_recovery_archive.py`

The workflow is manual only and dispatch-guarded to `main`. Its single YAML file
is the smallest proposed ops-only default-branch bootstrap; no app source or existing
workflow is changed. It checks out the exact independently reviewed ops source SHA
from an explicit input, checks HEAD and the pinned Python script SHA-256, then invokes
the established Actions SSH route. Feature-only workflow registration is not assumed.
It uses the existing `preview` environment and SSH secrets; it creates no credential,
grant, paid service, proxy/network attachment, public port or artifact upload.
Publishing/dispatch is a later bounded action, after independent review and publisher gates.

Expected live baseline: `/opt/blagova-sweets-preview`, Compose project
`blagova-sweets-preview`, marker/image tag `054e694398aa52330734adc027eba2dab8d3142d`.
The existing deploy lock is opened read-only with a shared nonblocking lock;
no live file is created, truncated, replaced, chmodded or removed. A changed baseline,
missing lock/archive/tool or uncertain archive layout is a hard stop.

The private scratch is unique to GitHub run ID/attempt. A single disposable Nginx
container has network `none`, no published ports/binds/external volumes,
read-only root, tmpfs, no-new-privileges, 128 MiB RAM, 0.5 CPU and 64 PIDs.
Archive compressed/expanded limits are 128/400 MiB; total scratch is <=512 MiB,
free-space prerequisite >=1 GiB, workflow <=10 minutes, remote timeout 8 minutes.
The source size is checked before creating a copy; actual copied bytes are capped
even if the source grows. Whole gzip-expanded bytes (including tar metadata, padding
and trailing members) pass through a bounded reader before tar parser reads. PAX,
GNU long-name and sparse extensions are rejected before their payload allocation.
Only uncompressed Docker-save layer identities and a single matching Docker/OCI
descriptor chain are accepted. Compressed layers stop until explicitly supported/reviewed.

Before every load, the archive must resolve to the exact already-running immutable
image and existing tag. Idempotent load may write identical Docker cache/tag metadata;
it must not change live tag→image mapping or restart/reconfigure the live Preview.
The archive/config copies remain private, never printed or uploaded. Only non-secret
checksums, identities and stage outcomes appear in the report.

Checks: archive/content integrity → restored isolated healthy image/noindex →
intentional `exit 17` only in the disposable container → exactly one A1 managed
recovery with restored config/marker → second healthy config → manual config rollback.
This checks config rollback on the same immutable image, not cross-version or
cold-cache recovery; the existing global Docker cache/image is retained.
The initial managed file pair is seeded in the scratch so the A1 legacy fallback
branch is never entered. No canonical/legacy shared container is acted on.

Cleanup validates exact scratch name/ownership marker, Compose labels, container
name/image/network/resources, then removes only those containers and the owned
scratch. No prune, global image/tag removal, network removal or broad shell deletion.
On ownership doubt it stops and reports the exact owned project for manual cleanup.
SIGTERM triggers bounded cleanup; SIGKILL/host failure cannot guarantee cleanup.
The live Preview container identity/start time/health, config hashes, source marker
and global tag mapping are compared before/after. TARGET and other service/container
counts are not assumed constant or acted on.

Local synthetic archive tests also reproduce the two P2 boundaries from the prior
NO-GO patch `53004fc9`: oversize-before-copy/concurrent growth and uncharged PAX data.
They cover valid single image, exact bounded copy, foreign tag, wrong config,
modified layer, path traversal, duplicate member, extra OCI descriptor, foreign OCI
root annotation, foreign legacy repository tag, complete decompression budget and
trailing concatenated gzip bytes. They do
not replace Linux script review or an actual OVH drill. No OVH execution is claimed.

After independent review and publication-binding clearance, the bounded publication
path is: normal ops source branch publication → ops-only main PR containing this one
manual workflow YAML → verify registered workflow and main YAML hash → explicit
`gh workflow run preview-recovery-drill.yml --repo Andrei-Blagov/BLAGOVA_SWEETS --ref main`
with `operation=isolated-recovery-drill` and `reviewed_ops_sha=<exact reviewed ops SHA>`.
No push/PR deploy trigger, default-deploy input, permission expansion, dispatch or
source publication is performed by preparing these files. Actual ops SHA and main
bootstrap SHA do not exist yet and must be recorded separately once reviewed/created.
