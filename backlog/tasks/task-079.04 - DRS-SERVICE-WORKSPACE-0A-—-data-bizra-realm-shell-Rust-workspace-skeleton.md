---
id: TASK-079.04
title: DRS-SERVICE-WORKSPACE-0A — /data/bizra/realm-shell Rust workspace skeleton
status: To Do
assignee: []
created_date: '2026-08-25 08:28'
labels:
  - realm-shell
  - rust
  - workspace
dependencies:
  - TASK-079.01
  - TASK-079.02
parent_task_id: TASK-079
priority: high
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create out-of-repo workspace hosting dema-presence-service (Tokio FSM Starting->ConnectingNode0->Resync->Ready, AF_UNIX SOCK_STREAM /run/user/1000/bizra/realm-projection.sock mode 0600, u32-BE length frames <=32768B, SO_PEERCRED admission), omarchy-shell-wrapper crate, bizra.dema.presence QML plugin contract. Bounded queues EVENT_QUEUE_CAP=128 RENDER_QUEUE_CAP=16. NO long-running process started without an explicit operator GO; skeleton lands with tests only.
<!-- SECTION:DESCRIPTION:END -->
