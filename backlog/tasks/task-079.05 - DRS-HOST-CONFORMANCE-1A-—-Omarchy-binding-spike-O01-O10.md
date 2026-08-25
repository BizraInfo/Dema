---
id: TASK-079.05
title: DRS-HOST-CONFORMANCE-1A — Omarchy binding spike O01-O10
status: To Do
assignee: []
created_date: '2026-08-25 08:28'
labels:
  - realm-shell
  - host-binding
  - conformance
dependencies:
  - TASK-079.04
parent_task_id: TASK-079
priority: high
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Measure the real pinned omarchy/quickshell revisions and the exact IPC operations (ping/update_presence/hide_presence); generate bizra.realm.host_binding.v0.1 from conformance evidence, never guessed. Wrapper stays HOST_BINDING_PENDING until this passes. Direct argv only: no /bin/sh -c, no eval, bounded stdout/stderr 65536.
<!-- SECTION:DESCRIPTION:END -->
