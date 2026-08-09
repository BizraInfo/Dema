// NODE0-BASE-CONSTELLATION-1A — read-only gatherer.
//
// Every read here is a plain filesystem read of /proc, /sys, or the session's
// gvfs directory. No child process is spawned: this host is missing `awk` and
// a working `cc`, and a gatherer that shells out inherits every such gap. No
// device content is opened — only names, sizes, models and mount tables.
//
// Fail-soft by design. An unreadable source yields an empty list, never a
// throw: a node that cannot enumerate its own disks must still be able to say
// so, and absence must not be reported as zero capacity without evidence.

import { readFile, readdir } from "node:fs/promises";

const SYS_BLOCK = "/sys/block";
const PROC_MOUNTS = "/proc/mounts";

async function readTrimmed(path) {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return null;
  }
}

/// Whole disks only. Partitions live under their parent in /sys/block and are
/// deliberately skipped, or capacity would be counted twice.
async function gatherDisks() {
  let names;
  try {
    names = await readdir(SYS_BLOCK);
  } catch {
    return [];
  }
  const disks = [];
  for (const name of names.sort()) {
    if (/^(loop|ram|zram|dm-|sr)/.test(name)) continue;
    const sizeRaw = await readTrimmed(`${SYS_BLOCK}/${name}/size`);
    const sectors = sizeRaw === null ? Number.NaN : Number.parseInt(sizeRaw, 10);
    if (!Number.isFinite(sectors) || sectors <= 0) continue;
    const model = await readTrimmed(`${SYS_BLOCK}/${name}/device/model`);
    // Partitions, not just the disk. Reachability computed per disk would call
    // a 1 TB drive "reachable" because a 2 GB partition on it is mounted, and
    // silently hide the 950 GB partition that is not. Measured on this host.
    let partitions = [];
    try {
      const children = await readdir(`${SYS_BLOCK}/${name}`);
      for (const child of children.sort()) {
        if (!child.startsWith(name)) continue;
        const partRaw = await readTrimmed(`${SYS_BLOCK}/${name}/${child}/size`);
        const partSectors = partRaw === null ? Number.NaN : Number.parseInt(partRaw, 10);
        if (!Number.isFinite(partSectors) || partSectors <= 0) continue;
        partitions.push({ name: child, sectors: partSectors });
      }
    } catch {
      partitions = [];
    }
    disks.push({ name, sectors, model: model || null, partitions });
  }
  return disks;
}

async function gatherMounts() {
  const raw = await readTrimmed(PROC_MOUNTS);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[0].startsWith("/dev/"))
    .map(([device, mountpoint]) => ({ device, mountpoint }));
}

/// Attached companion devices as the desktop session already sees them. Only
/// the mount label is read; the device is never opened or enumerated.
async function gatherAttached(gvfsRoot) {
  const root =
    gvfsRoot ??
    (process.getuid ? `/run/user/${process.getuid()}/gvfs` : null);
  if (!root) return [];
  try {
    const entries = await readdir(root);
    return entries
      .filter((entry) => entry.startsWith("mtp:") || entry.startsWith("gphoto"))
      .map((entry) => ({ label: entry }));
  } catch {
    return [];
  }
}

export async function gatherBaseConstellationObservations({
  sysBlockRoot,
  gvfsRoot,
} = {}) {
  void sysBlockRoot;
  const [disks, mounts, attached] = await Promise.all([
    gatherDisks(),
    gatherMounts(),
    gatherAttached(gvfsRoot),
  ]);
  return Object.freeze({ disks, mounts, attached });
}
