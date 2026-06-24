export async function cmd_hardware(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = argv.includes("--json");

  if (sub !== "profile") {
    console.error("usage: dema hardware profile [--json]");
    process.exit(1);
  }

  const { gatherNode0HardwareObservations } = await import("./hardware-profile-gatherer.js");
  const { buildNode0HardwareProfile } = await import(
    "../../../../packages/core/src/node0-hardware-profile.js"
  );

  const observations = await gatherNode0HardwareObservations({});
  const profile = buildNode0HardwareProfile(observations, {
    generated_at_iso: new Date().toISOString(),
  });

  if (wantJson) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  const c = profile.capacity_classes;
  const ref = profile.reference_profile;
  const gpu = profile.observations.gpus[0];
  console.log(`Node0 hardware profile — ${profile.truth_label}`);
  console.log(
    `  host:     ${profile.observations.hostname} (${profile.observations.platform})`,
  );
  console.log(
    `  compute:  ${profile.observations.cpu_cores_logical} threads → class ${c.compute}`,
  );
  console.log(
    `  memory:   ${profile.observations.memory_total_gb} GiB total (${profile.observations.memory_available_gb} GiB free) → class ${c.memory}`,
  );
  if (gpu) {
    console.log(
      `  gpu:      ${gpu.name} · ${gpu.memory_total_mib} MiB (${gpu.memory_free_mib} MiB free) → class ${c.gpu}`,
    );
  } else {
    console.log(`  gpu:      none detected → class ${c.gpu}`);
  }
  console.log(
    `  storage:  ${profile.observations.disk.free_gb} GiB free on ${profile.observations.disk.mount} → class ${c.storage}`,
  );
  console.log(
    `  reference: ${ref.matched ? "MATCH" : "no match"} · ${ref.reference_label}`,
  );
  console.log(`  tier:     ${profile.workstation_tier}`);
  const rules = profile.architecture_policies.operational_rules;
  console.log(`  rules (${rules.length} preview-only):`);
  for (const r of rules) console.log(`    - ${r}`);
}
