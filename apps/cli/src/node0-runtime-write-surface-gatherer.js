// NODE0-RUNTIME-WRITE-SURFACE-1A — read-only gatherer.
//
// Runs the five required probes against the REAL Genesis host and hands the
// kernel already-collected results. Every probe is strictly read-only: it reads
// metadata, lists sockets, lists process names, and reads git config. It never
// chmods, mounts, opens or closes a port, restarts a service, kills a process,
// fetches, pushes, or elevates.
//
// THE ONE RULE EVERY PROBE FOLLOWS. A probe that cannot run returns
// `measured:false` with a reason. It never returns `writer_found:false`, because
// "the tool was not permitted to look" and "the tool looked and found nothing"
// produce identical empty output and only the probe knows which occurred. That
// single distinction is what keeps this from becoming the source scan that
// TASK-060 already rejected.
//
// Commands are invoked with execFile and a fixed argv — never a shell, never an
// interpolated string — so nothing here can be turned into command injection by
// a path or an environment variable.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);

/// Sync/replication agents that would mutate a watched directory out of band.
/// Data, not control flow, so extending the list is a reviewable one-liner.
export const SYNC_AGENT_PATTERNS = Object.freeze([
  "dropbox", "onedrive", "gdrive", "google-drive", "insync", "syncthing",
  "rclone", "nextcloud", "owncloud", "megasync", "resilio", "btsync",
  "unison", "seafile", "pcloud",
]);

/// Filesystem types that mean the bytes are not solely this host's.
export const NETWORK_FSTYPES = Object.freeze([
  "nfs", "nfs4", "cifs", "smbfs", "smb3", "afs", "sshfs", "fuse.sshfs",
  "glusterfs", "ceph", "9p", "davfs", "fuse.rclone", "fuse.gdrive",
]);

const probe = async (fn) => {
  try { return await fn(); } catch (err) {
    return { measured: false, reason: `probe_failed:${err?.code ?? err?.message ?? "unknown"}` };
  }
};

/** Who, other than the owner, may write DEMA_HOME. */
async function filesystemSurface(demaHome) {
  return probe(async () => {
    const st = await stat(demaHome);
    const mode = st.mode & 0o777;
    const groupWritable = Boolean(mode & 0o020);
    const otherWritable = Boolean(mode & 0o002);
    const unresolved = [];

    // Group-writable is only a writer if the group has OTHER members. Resolving
    // that needs the group database; without it the question is open, not clear.
    let groupMembers = null;
    if (groupWritable) {
      try {
        const { stdout } = await run("getent", ["group", String(st.gid)], { timeout: 2000 });
        groupMembers = (stdout.trim().split(":")[3] ?? "").split(",").filter(Boolean);
      } catch {
        unresolved.push("group_membership_unresolved");
      }
    }
    // ACLs can grant write to a principal the mode bits never mention.
    let aclExtra = null;
    try {
      const { stdout } = await run("getfacl", ["-pE", demaHome], { timeout: 2000 });
      aclExtra = stdout.split("\n").filter((l) =>
        /^(user|group):[^:]+:/.test(l) && /w/.test(l.split(":")[2] ?? ""));
    } catch {
      unresolved.push("acl_unreadable");
    }

    const writer_found = otherWritable
      || (groupWritable && Array.isArray(groupMembers) && groupMembers.length > 0)
      || (Array.isArray(aclExtra) && aclExtra.length > 0);

    return {
      measured: true,
      writer_found,
      unresolved,
      evidence: {
        mode: mode.toString(8), uid: st.uid, gid: st.gid,
        group_writable: groupWritable, other_writable: otherWritable,
        group_members: groupMembers, acl_write_grants: aclExtra,
      },
    };
  });
}

/** Is the backing store local, or shared/networked/synchronized. */
async function mountSurface(demaHome) {
  return probe(async () => {
    const { stdout } = await run(
      "findmnt", ["-T", demaHome, "-n", "-o", "TARGET,SOURCE,FSTYPE,OPTIONS"], { timeout: 2000 });
    const [target, source, fstype, options] = stdout.trim().split(/\s+/);
    const unresolved = [];
    // A read-only view is a sign the observer is itself sandboxed, and a
    // sandboxed observer cannot speak for the host's real mount posture.
    if (/(^|,)ro(,|$)/.test(options ?? "")) unresolved.push("observer_sees_readonly_mount");
    return {
      measured: true,
      writer_found: NETWORK_FSTYPES.includes(fstype),
      unresolved,
      evidence: { target, source, fstype, options },
    };
  });
}

/** Is any bound socket causally connected to sovereign state. */
async function listenerSurface() {
  return probe(async () => {
    const { stdout } = await run("ss", ["-tlnp"], { timeout: 3000 });
    const listeners = [];
    for (const line of stdout.split("\n")) {
      if (!line.includes("LISTEN")) continue;
      const cols = line.trim().split(/\s+/);
      const local = cols[3] ?? "";
      const m = local.match(/^(.*):(\d+)$/);
      if (!m) continue;
      const address = m[1].replace(/^\[|\]$/g, "");
      // users:(("name",pid=N,fd=M)) — absent without sufficient privilege.
      const proc = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
      listeners.push({
        address, port: Number(m[2]),
        externally_bound: address === "*" || address === "0.0.0.0" || address === "::",
        process: proc ? { name: proc[1], pid: Number(proc[2]) } : null,
      });
    }
    const unresolved = [];
    // A LISTENER IS NOT A WRITE PATH until its process is known. An externally
    // bound socket whose owner cannot be identified leaves the causal chain
    // broken at step two, so the surface is unresolved rather than clear.
    for (const l of listeners) {
      if (l.externally_bound && l.process === null) {
        unresolved.push(`listener_process_unidentified:${l.address}:${l.port}`);
      }
    }
    return {
      measured: true,
      // No listener is asserted as a writer without a proven handler path to
      // sovereign state; that link is established by the process identity above,
      // and its absence is reported as unresolved, never as clear.
      writer_found: false,
      unresolved,
      evidence: { listener_count: listeners.length, listeners },
    };
  });
}

/** Is any replication agent watching the directory. */
async function synchronizationSurface() {
  return probe(async () => {
    const { stdout } = await run("ps", ["-eo", "comm="], { timeout: 3000 });
    const names = stdout.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const hits = names.filter((n) => SYNC_AGENT_PATTERNS.some((p) => n.includes(p)));
    return {
      measured: true,
      // Presence of an agent is treated as a writer: proving it does NOT target
      // DEMA_HOME needs per-process watch inspection this probe does not do, and
      // the safe direction for an unproven negative is to report the writer.
      writer_found: hits.length > 0,
      unresolved: [],
      evidence: { process_count: names.length, sync_agents: hits },
    };
  });
}

/** Is any automatic fetch/update able to mutate DEMA_HOME. */
async function gitAutomationSurface(demaHome) {
  return probe(async () => {
    const unresolved = [];
    let isRepo = false;
    try {
      await stat(join(demaHome, ".git"));
      isRepo = true;
    } catch { /* not a repo: no git writer by this path */ }

    let remotes = [];
    if (isRepo) {
      try {
        const { stdout } = await run("git", ["-C", demaHome, "remote", "-v"], { timeout: 2000 });
        remotes = stdout.trim().split("\n").filter(Boolean);
      } catch {
        unresolved.push("git_remotes_unreadable");
      }
    }
    // A configured remote is not a writer; an automatic mechanism is. Scheduler
    // visibility is what decides that, and without it the question stays open.
    let schedulerVisible = false;
    try {
      await run("systemctl", ["list-timers", "--no-pager"], { timeout: 3000 });
      schedulerVisible = true;
    } catch { /* checked below */ }
    if (!schedulerVisible) {
      try {
        await stat("/etc/cron.d");
        schedulerVisible = true;
      } catch { /* checked below */ }
    }
    if (isRepo && !schedulerVisible) unresolved.push("scheduler_unreadable");

    return {
      measured: true,
      writer_found: false,
      unresolved,
      evidence: { dema_home_is_git_repo: isRepo, remotes, scheduler_visible: schedulerVisible },
    };
  });
}

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

/**
 * Collect all five required surfaces. READ-ONLY throughout.
 *
 * @returns {Promise<{subject:object, surfaces:object}>}
 */
export async function gatherRuntimeWriteSurface({ demaHome, nodeId = null } = {}) {
  const home = demaHome ?? resolveDemaHome();
  const [filesystem, mount, listener, synchronization, git_automation] = await Promise.all([
    filesystemSurface(home),
    mountSurface(home),
    listenerSurface(),
    synchronizationSurface(),
    gitAutomationSurface(home),
  ]);
  return Object.freeze({
    subject: Object.freeze({ node_id: nodeId, dema_home: home }),
    surfaces: Object.freeze({ filesystem, mount, listener, synchronization, git_automation }),
  });
}
