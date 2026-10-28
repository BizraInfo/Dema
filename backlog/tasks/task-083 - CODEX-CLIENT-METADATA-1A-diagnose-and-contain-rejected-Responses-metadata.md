---
id: TASK-083
title: 'CODEX-CLIENT-METADATA-1A: diagnose and contain rejected Responses metadata'
status: Done
assignee:
  - '@codex'
created_date: '2026-10-15 02:58'
updated_date: '2026-10-15 06:22'
labels: []
dependencies: []
references:
  - 'https://github.com/openai/codex/issues/52313'
priority: high
type: bug
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user reports Codex CLI stops on HTTP 400 for input[1].internal_chat_message_metadata_passthrough.content_item_metadata. Current CLI is 0.162.1 but the shared daemon is 0.163.0-alpha.1; Dema-clean is dirty and must be preserved. Limit work to a reversible supported Codex compatibility setting, local request-shape verification, and recovery instructions for existing sessions. No Dema product code, credentials, model calls, service interruption, or remote writes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bind the failing request and executing daemon to current local evidence.
- [x] #2 Verify the installed supported workaround removes the rejected metadata using a local test without external inference.
- [x] #3 Preserve the original configuration and all unrelated values, and document restart requirements honestly.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the already verified metadata workaround. 2. Bind the screenshot conflict to the actual writer and finished turn. 3. If the abandoned shared server owns only the failed conversation and has no external clients, stop it through codex app-server daemon stop. 4. Verify the lock is free, the saved conversation is preserved, and the desktop/current terminal remain alive; document pressing R to retry.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bound terminal CLI 0.162.1 versus shared daemon 0.163.0-alpha.1, PID 16701. HTTP 400 exactly matches user error and upstream issue 52313. Actual alpha binary produced expected local RED with six rejected fields and exit 1; switch disabled gave zero rejected fields, fixture reply, exit 0. Installed CLI also passed. Compared final pair with identical scratch context: prompt content preserved. Applied only features.content_item_kinds=false through codex features disable, with protected byte backup, semantic config equality and mode 0600 verification. No real inference or shared-server interruption. Evidence: /home/bizra-operating-system/.codex/diagnostics/20261015-content-metadata-18v0rda5/REPORT.md. Existing sessions require fresh configuration; documented --no-daemon resume. Full Dema gates NOT_RUN because no product code changed; git diff --check passed.

Follow-up screenshot showed that --no-daemon started correctly but resume hit thread-store conflict: 01a13d44-a624-7790-8980-c947259df8f8 already has an active writer. PID 16701 still owns that sole thread lock. Rollout last task_complete is the HTTP 400 at 02:29:16Z, with no subsequent task_started. The previous terminal unsubscribed at 07:33:51 +04. This is a stale ownership blocker separate from a fresh metadata rejection.

Follow-up ownership recovery: confirmed sole writer PID 16701, last turn complete at 06:29:16 +04, prior terminal unsubscribed 07:33:51, and only internal self-paired Unix sockets remained. Supported codex app-server daemon stop exited 0 and removed its own writer lock. Current standalone terminal PID 2145924 and desktop server PID 192126 stayed alive. Saved rollout remains 216245 bytes with original 06:29:16 mtime and last completed failed turn; config hash unchanged. Readback: stale-writer-release.json. Initial post-stop self-check raised FileNotFoundError because the server removed its own lock; follow-up checks correctly verified absence. No manual lock deletion. User can now press r in the waiting terminal; live retry/model request NOT_RUN.

Live recovery now observed read-only at 2026-10-15 10:21 +04: affected thread is owned by standalone CLI PID 2153590 with --no-daemon --disable content_item_kinds, launched 07:42:34. Three successful task_complete events at 08:31:00, 08:46:44, 09:22:56, zero failed completed turns, zero new metadata-rejection WARN/ERROR entries for that process/thread. Current turn started 10:16:43 and has recent custom tool calls/results and reasoning records; remains active. One 60-minute WebSocket lifetime expiry at 08:42:53 recovered via retry, and the turn completed 08:46:44. No model calls were initiated by this diagnostic. Evidence: live-recovery.json and REPORT.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Resolved the rejected-metadata request path with a supported narrow feature setting and released the stale conversation writer through the verified idle server stop. Live recovery is now observed: the user-resumed CLI completed three turns with zero new metadata rejections or failed completed turns, and its current turn remains active. Saved conversation, unrelated configuration and Dema source changes were preserved; active work was left running.
<!-- SECTION:FINAL_SUMMARY:END -->
