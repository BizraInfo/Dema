// NODE0-BASE-CONSTELLATION-1A — what Node0 can actually see of its own body.
//
// NOT ML. NOT runtime. NOT a pairing socket. NOT an actuator. This observes
// which BASES belong to this node and reports them; it moves nothing, mounts
// nothing, reads no device content, and grants no authority.
//
// WHY THIS EXISTS. `multi-device-asset-awareness.js` already models the exact
// architecture — laptop, mobile, external storage — but it is DOCS_ONLY: two
// hardcoded device ids behind a fixture dated 2026-06-26, with zero reads of
// any real device. Measured 2026-08-09: a phone was cabled to the host and
// visible to the OS by serial while that module reported its June fixture.
// A node that describes itself from memory instead of looking is why its human
// has to be its senses.
//
// ONE HUMAN, ONE NODE, MANY BASES. A base is a device the human has enrolled
// into their own node — this host and the phone in their hand are two bases of
// one Node0, not two nodes and not a foreign machine. Bases differ in what
// they may DO (see `execution_role` below), never in who they belong to.
//
// PURITY. The kernel is pure: it takes already-gathered observations and
// derives. All reads live in the gatherer, are plain filesystem reads of
// /proc, /sys and the session's gvfs directory, and are metadata-only —
// no device content is opened, ever.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_BASE_CONSTELLATION_SCHEMA =
  "bizra.dema.node0_base_constellation.v0.1";
export const NODE0_BASE_CONSTELLATION_TRUTH_LABEL = "OBSERVED_LOCAL";

const BYTES_PER_SECTOR = 512;

/// A base that executes autonomously must not also hold the capability that
/// authorizes it. That is not a claim about trust; it is the reason the
/// distinction is recorded per base rather than assumed.
export const EXECUTION_ROLES = Object.freeze({
  HOST: "autonomous_execution_base",
  COMPANION: "human_present_base",
});

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Pure. Derives the constellation from observations the gatherer collected.
 *
 * @param {object} observations
 * @param {Array<{name: string, sectors: number, model: string|null}>} observations.disks
 * @param {Array<{device: string, mountpoint: string}>} observations.mounts
 * @param {Array<{label: string}>} observations.attached
 */
export function buildBaseConstellation(observations = {}) {
  const disks = Array.isArray(observations.disks) ? observations.disks : [];
  const mounts = Array.isArray(observations.mounts) ? observations.mounts : [];
  const attached = Array.isArray(observations.attached)
    ? observations.attached
    : [];

  const mountedDevices = new Set(mounts.map((m) => m.device));
  const isMounted = (partName) => mountedDevices.has(`/dev/${partName}`);

  // PARTITION-LEVEL, deliberately. Computing this per disk reports a 1 TB drive
  // as reachable because a 2 GB partition on it is mounted, hiding the 950 GB
  // partition that is not — measured on this host, and a number that flatly
  // contradicts `lsblk`. Capacity a node owns but cannot reach is the fact
  // worth surfacing, so it is never folded into the reachable total.
  const storage = disks.map((disk) => {
    const bytes = Number.isFinite(disk.sectors)
      ? disk.sectors * BYTES_PER_SECTOR
      : 0;
    const partitions = Array.isArray(disk.partitions) ? disk.partitions : [];
    const partitionRows = partitions.map((part) =>
      Object.freeze({
        name: part.name,
        capacity_gb: round((part.sectors * BYTES_PER_SECTOR) / 1e9),
        reachable: isMounted(part.name),
      }),
    );
    // A disk with no partition table is judged whole.
    const reachable_gb = partitionRows.length
      ? round(
          partitionRows
            .filter((p) => p.reachable)
            .reduce((sum, p) => sum + p.capacity_gb, 0),
        )
      : isMounted(disk.name)
        ? round(bytes / 1e9)
        : 0;
    return Object.freeze({
      name: disk.name,
      model: disk.model ?? null,
      capacity_gb: round(bytes / 1e9),
      reachable_gb,
      dark_gb: round(Math.max(0, round(bytes / 1e9) - reachable_gb)),
      reachable: reachable_gb > 0,
      partitions: Object.freeze(partitionRows),
    });
  });

  const total_capacity_gb = round(
    storage.reduce((sum, d) => sum + d.capacity_gb, 0),
  );
  const reachable_capacity_gb = round(
    storage.reduce((sum, d) => sum + d.reachable_gb, 0),
  );
  const dark_capacity_gb = round(total_capacity_gb - reachable_capacity_gb);

  const companions = attached.map((device) =>
    Object.freeze({
      base_id: `base:attached:${device.label}`,
      label: device.label,
      execution_role: EXECUTION_ROLES.COMPANION,
      // Observed as connected. Enrolment is a human act and is NOT implied by
      // a cable: presence is not membership, and this kernel never promotes
      // one into the other.
      enrolled: false,
      content_read: false,
    }),
  );

  const bases = Object.freeze([
    Object.freeze({
      base_id: "base:host",
      label: "this host",
      execution_role: EXECUTION_ROLES.HOST,
      enrolled: true,
      storage,
      total_capacity_gb,
      reachable_capacity_gb,
      dark_capacity_gb,
    }),
    ...companions,
  ]);

  const envelope = {
    schema: NODE0_BASE_CONSTELLATION_SCHEMA,
    truth_label: NODE0_BASE_CONSTELLATION_TRUTH_LABEL,
    bases,
    base_count: bases.length,
    attached_not_enrolled: companions.length,
    dark_capacity_gb,
    what_this_proves:
      "Which bases and storage this node can currently observe, and how much of its own capacity it cannot reach.",
    what_this_does_not_prove:
      "Does not prove enrolment, pairing, ownership, custody of any signing key, or that an attached device is willing to be part of this node.",
    // Canonical vocabulary only — buildPreviewBoundary owns the key list, and
    // inventing device-specific keys here would fork it. Device facts that the
    // canon does not cover are stated as explicit envelope fields instead.
    boundary: buildPreviewBoundary(),
    device_effects: Object.freeze({
      device_content_read: false,
      device_mutated: false,
      pairing_performed: false,
      enrolment_performed: false,
    }),
  };
  return Object.freeze(envelope);
}

/// Re-derives the totals from the reported per-disk rows, so a tampered or
/// hand-edited summary cannot pass as observation.
export function verifyBaseConstellation(envelope) {
  const host = envelope?.bases?.find((b) => b.base_id === "base:host");
  if (!host) return Object.freeze({ ok: false, reason: "host_base_missing" });
  const total = round(
    host.storage.reduce((sum, d) => sum + d.capacity_gb, 0),
  );
  const reachable = round(
    host.storage.reduce((sum, d) => sum + d.reachable_gb, 0),
  );
  if (total !== host.total_capacity_gb) {
    return Object.freeze({ ok: false, reason: "total_capacity_mismatch" });
  }
  if (reachable !== host.reachable_capacity_gb) {
    return Object.freeze({ ok: false, reason: "reachable_capacity_mismatch" });
  }
  if (round(total - reachable) !== host.dark_capacity_gb) {
    return Object.freeze({ ok: false, reason: "dark_capacity_mismatch" });
  }
  return Object.freeze({ ok: true });
}
