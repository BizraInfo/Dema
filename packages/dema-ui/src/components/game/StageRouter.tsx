"use client";

import { useGame } from "@/lib/game/store";
import { WorldMap } from "./WorldMap";
import { ClaimBindingGame } from "./ClaimBindingGame";
import { ConsentGateTrial } from "./ConsentGateTrial";
import { ProofForge } from "./ProofForge";
import { CiRaid } from "./CiRaid";
import { DataRefine } from "./DataRefine";
import { NodeHealth } from "./NodeHealth";
import { Blackboard } from "./Blackboard";
import { Genesis } from "./Genesis";
import { Ceremony } from "./Ceremony";
import { Codex } from "./Codex";
import { NodeStatus } from "./NodeStatus";
import { EcosystemView } from "./EcosystemView";
import { DiagnosticDoxology } from "./DiagnosticDoxology";
import { MelaeForge } from "./MelaeForge";
import { MissionCorridor } from "@/components/dema/MissionCorridor";

export function StageRouter() {
  const scene = useGame((s) => s.currentScene);

  switch (scene) {
    case "corridor":
      return <MissionCorridor />;
    case "world":
      return <WorldMap />;
    case "ecosystem":
      return <EcosystemView />;
    case "diagnostics":
      return <DiagnosticDoxology />;
    case "melae":
      return <MelaeForge />;
    case "claimBinding":
      return <ClaimBindingGame />;
    case "consentGate":
      return <ConsentGateTrial />;
    case "proofForge":
      return <ProofForge />;
    case "ciRaid":
      return <CiRaid />;
    case "dataRefine":
      return <DataRefine />;
    case "nodeHealth":
      return <NodeHealth />;
    case "blackboard":
      return <Blackboard />;
    case "genesis":
      return <Genesis />;
    case "ceremony":
      return <Ceremony />;
    case "codex":
      return <Codex />;
    case "nodeStatus":
      return <NodeStatus />;
    default:
      return <MissionCorridor />;
  }
}
