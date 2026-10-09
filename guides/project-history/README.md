# Restorable Project history

Repository subset: myscoutee; 85 tasks; checked 2026-10-10. [Live Project](https://github.com/users/fssrepository/projects/2) · [Canonical complete backup](https://github.com/fssrepository/myscoutee-roadmap/tree/master/guides/project-history/myscoutee).

`project.json` preserves full issue bodies, statuses, typed field values and views. `measurements.json` preserves model/token/cost/time components and assumptions. `commit-map.json` links original and task-prefixed commit IDs. CSV/JSON provide convenient presentation exports. Recorded root intervals are retained in compressed JSON for timing reconstruction; there are no private chat texts.

## Validate offline

Run from the repository root:

```bash
python3 guides/project-history/restore_project.py
```

This validates all SHA256SUMS files and snapshot structure without network access.

## Recreate a deleted Project

Set `GITHUB_PROJECT_TOKEN` in your local shell to a credential with Projects write access. Run the same command with `--apply`. The script creates a new Project and restores task associations, fields, values, statuses and visible-column views; existing issues and source commits are preserved. Local progress is saved for retries. Use a separate `--state` file to create another copy. A repository subset restores only the tasks in that subset; use the complete backup to restore the whole Project.

If issues were deleted too, set `GITHUB_REPOSITORY_TOKEN` to an issue-write credential and add `--recreate-missing-issues`. The tracker repository must exist. Recreated issues may receive new issue numbers; stable task IDs remain. Historical execution dates remain in fields, while GitHub creation/closure timestamps reflect restoration.

Repository associations are included in `project.json`. Set `GITHUB_REPOSITORY_TOKEN` (or a suitable `GITHUB_TOKEN`) during restoration to reconnect them automatically. Separate Project-write and repository credentials are supported. Comments, automations and permission grants are outside this reconstruction. Read [METHOD.md](METHOD.md) for estimates, unknown values and measurement boundaries. Git versions these files; no dated folder is needed.

## MSC-121 closeout

Closed / Project Done. Final deployment evidence is Helm 123; usage is recorded through 2026-10-09T15:12:03.126Z. The latest task components and intervals are in `measurements.json` under `post_control_task_usage`; these replace earlier checkpoints by task ID. Historical calibration totals remain frozen. The October-10 publication turn is excluded.

The canonical roadmap `commit-map.json` records the October-10 consolidation;
repository subset maps retain their earlier reconstruction boundary. Runtime
verification is the recorded October-9 evidence; the October-10 SSH check could
not reach the KVM and did not restart it.
