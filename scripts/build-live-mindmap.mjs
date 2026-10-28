#!/usr/bin/env node
// Builds a hermetic (no CDN, no network assets) Node0 mind-map HTML from LOCAL disk
// evidence. Observed state only — NOT runtime, NOT a live autopoietic loop.
// Every node carries an evidence label (VERIFIED / DERIVED / UNKNOWN / PREVIEW_ONLY
// / DESIGNED_NOT_LIVE) and a source. Re-run to refresh; nothing runs in background.
// Usage: node scripts/build-live-mindmap.mjs [--out <file>]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();
const demaHome = process.env.DEMA_HOME || join(home, ".dema");
const oi = process.argv.indexOf("--out");
const outFile = oi > 0 ? process.argv[oi + 1] : join(demaHome, "map", "bizra-node0-live-mindmap.html");

const sh = (cmd, args, opts = {}) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd: repo, encoding: "utf8", timeout: 60000, maxBuffer: 1 << 26, ...opts }) }; }
  catch (e) { return { ok: false, out: String(e.stdout ?? ""), code: e.status ?? null }; }
};
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
async function probe(url) {
  try {
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2000) });
    let j = null; try { j = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, json: j };
  } catch { return { ok: false, status: null, json: null }; }
}

// ---- evidence gathering (read-only) ----
const gw = await probe("http://127.0.0.1:7421/health");
const ollamaTags = await probe("http://127.0.0.1:11434/api/tags");
const ollamaPs = await probe("http://127.0.0.1:11434/api/ps");
const parity = sh("node", ["scripts/skills/check-projection-parity.mjs"]);
const parityRows = parity.out.split("\n").filter((l) => /PARITY|MISSING|DRIFT|MISMATCH/.test(l) && /@/.test(l));
const worktree = sh("git", ["status", "--short"]).out.split("\n").filter(Boolean).length;
const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
const head = sh("git", ["rev-parse", "--short", "HEAD"]).out.trim();
const obs = (() => { const r = sh("node", ["bin/dema", "node0", "activation", "observe", "--json"]); try { return JSON.parse(r.out); } catch { return null; } })();
const ruflo = {
  quarantined: existsSync(join(home, "ruflo-quarantine-20261028")),
  repo_residue: [".claude-flow", ".swarm", "agentdb.rvf", ".mcp.json"].filter((f) => existsSync(join(repo, f))),
  plugin_present: existsSync(join(home, ".copilot", "installed-plugins", "ruflo")),
};
const evalFile = ["/tmp/bizra-eval-dual-20261028.json", "/tmp/bizra-eval-baseline-20261028.json"].find(existsSync);
const evalRep = evalFile ? readJson(evalFile) : null;
const routeTxt = evalFile ? sh("node", ["bin/dema", "eval", "route", "--baseline", evalFile]).out : "";
const routes = routeTxt.split("\n").map((l) => l.match(/^\s+(\w+)\s+→\s+(\S+)\s+(.*)$/)).filter(Boolean).map((m) => ({ role: m[1], model: m[2], why: m[3].trim() }));
const shortlist = readJson(join(demaHome, "chat-cards", "chatgpt.shortlist.json"));
const cards = readJson(join(demaHome, "chat-cards", "chatgpt.cards.json"));
const ledger = readJson(join(demaHome, "wisdom", "chatgpt-top10-wisdom-ledger.json"));
const modelfiles = existsSync(join(demaHome, "modelfiles")) ? readdirSync(join(demaHome, "modelfiles")) : [];

// ---- graph ----
const nodes = [];
const add = (id, parent, label, category, label_claim, desc, source, radius = 22) =>
  nodes.push({ id, parent, label, category, claim: label_claim, desc, source, radius });

add("root", null, "BIZRA Node0", "hub", "PREVIEW_ONLY", `Observed-state map built ${new Date().toISOString()} from local disk evidence. Not runtime; not a live loop. Branch ${branch} @ ${head}.`, "scripts/build-live-mindmap.mjs", 36);

add("activation", "root", "Activation", "node0", obs ? "VERIFIED" : "UNKNOWN", obs ? `Ready gate: ${obs.next_safe_action}` : "dema node0 activation observe unavailable", "dema node0 activation observe --json", 28);
if (obs) {
  const s = obs.sovereign_runtime_status ?? {};
  add("sovereign", "activation", "Sovereign :8000", "node0", "VERIFIED", `live=${s.live} ready=${s.ready} (${s.base_url}). Dema observes, never starts it.`, "observe-gatherer.js");
  const cog = obs.cognition_status;
  if (cog) add("cognition", "activation", `Cognition ${cog.verdict}`, "node0", "VERIFIED", `loaded=${(cog.loaded_model_ids ?? []).join(", ") || "none"} in_vram=${cog.models_loaded_in_vram}`, "ollama /api/ps via observe");
  for (const g of obs.activation_gap_map ?? []) add(`gap_${g.gap}`, "activation", `Gap: ${g.gap}`, "next", "VERIFIED", g.suggestion, "activation_gap_map");
}
add("gateway", "activation", "Gateway :7421", "node0", gw.ok ? "VERIFIED" : "UNKNOWN", gw.ok ? `status=${gw.json?.status} domain=${gw.json?.domain}. Reported separately; does not set sovereign readiness.` : "Not reachable on 127.0.0.1:7421.", "GET http://127.0.0.1:7421/health");

add("models", "root", "Local Models", "models", ollamaTags.ok ? "VERIFIED" : "UNKNOWN", ollamaTags.ok ? `${ollamaTags.json.models.length} Ollama models; loaded: ${(ollamaPs.json?.models ?? []).map((m) => m.name).join(", ") || "none"}` : "Ollama unreachable", "GET :11434/api/tags", 28);
for (const f of modelfiles) add(`mf_${f}`, "models", f.replace("Modelfile.", "Modelfile: "), "models", "DERIVED", `~/.dema/modelfiles/${f} (authored; build with ollama create)`, `~/.dema/modelfiles/${f}`);
if (evalRep) {
  for (const [k, v] of Object.entries(evalRep.results_by_model ?? {})) add(`eval_${k}`, "models", `Eval ${k.split(":").slice(-2).join(":")}`, "models", "MEASURED", `pass ${v.pass_count}/6, avg latency ${v.latency_ms_avg ?? "n/a"} ms (bizra-local-small; proves nothing beyond 6 micro-tasks).`, evalFile);
  for (const r of routes) add(`route_${r.role}`, "models", `${r.role} → ${r.model === "—" ? "unassigned" : r.model.split(":").slice(-1)[0]}`, "models", "PREVIEW_ONLY", r.why, "dema eval route (preview, routes no traffic)");
}

add("skills", "root", "Skill Parity", "skills", parity.ok ? "VERIFIED" : "UNKNOWN", `check-projection-parity exit ${parity.ok ? 0 : parity.code}; ${parityRows.length} projections checked.`, "scripts/skills/check-projection-parity.mjs", 28);
for (const l of parityRows.slice(0, 12)) { const m = l.match(/✓?\s*(\S+) @ (\S+): (\S+)/); if (m) add(`sk_${m[1]}_${m[2]}`, "skills", `${m[1]} ${m[2]}`, "skills", m[3] === "PARITY" ? "VERIFIED" : "UNKNOWN", `${m[3]}`, "skills-src/registry.json", 16); }

add("hygiene", "root", "Worktree & Ruflo", "next", "VERIFIED", `${worktree} dirty/untracked entries preserved (not cleaned). Ruflo quarantined=${ruflo.quarantined}; plugin present=${ruflo.plugin_present}; repo residue=${ruflo.repo_residue.join(", ") || "none"}.`, "git status --short; ~/ruflo-quarantine-20261028", 28);

add("corpus", "root", "Chat Corpus", "chat", cards ? "DERIVED" : "UNKNOWN", cards ? `${cards.count} conversation cards (metadata only), ${cards.cards.reduce((a, c) => a + c.message_count, 0)} messages.` : "No chat cards built.", "~/.dema/chat-cards/chatgpt.cards.json", 28);
for (const [i, t] of (shortlist?.distinct_top10 ?? []).entries()) add(`chat_${i}`, "corpus", t.title.slice(0, 22), "chat", "DERIVED", `${(t.created_at ?? "").slice(0, 10)} · ${t.message_count} msgs · structural score ${t.score}`, "chatgpt.shortlist.json", 16);
if (ledger) {
  add("gems", "corpus", `Gems ${ledger.atom_count}`, "chat", "UNKNOWN", `Atoms by kind: ${JSON.stringify(ledger.by_kind)}. Chat claims are UNKNOWN unless disk-anchored (DERIVED).`, "~/.dema/wisdom/chatgpt-top10-wisdom-ledger.json", 24);
  const slices = [...new Set(ledger.atoms.filter((a) => a.atom_kind === "LOST_GOLDEN_GEM" && !a.superseded_by).flatMap((a) => a.referenced_slices))].slice(-10);
  for (const s of slices) add(`gem_${s}`, "gems", s.slice(0, 24), "next", "UNKNOWN", `Slice named in chat but not found on disk: ${s}`, "wisdom ledger LOST_GOLDEN_GEM");
}
add("designed", "root", "Not Live", "next", "DESIGNED_NOT_LIVE", "Federation, token economy, PoI rewards, autonomous PAT/SAT, autopoietic runtime, RSI: designed or preview only (docs/CURRENT_LIMITS.md).", "docs/CURRENT_LIMITS.md", 26);

// radial layout: branches on a ring, children fan outward
const kids = (id) => nodes.filter((n) => n.parent === id);
const branches = kids("root");
branches.forEach((b, i) => {
  const a = (i / branches.length) * Math.PI * 2 - Math.PI / 2;
  b.x = Math.cos(a) * 230; b.y = Math.sin(a) * 230;
  const place = (n, ang, r) => kids(n.id).forEach((c, j, arr) => {
    const spread = Math.min(Math.PI * 0.9, 0.34 * arr.length);
    const ca = ang + (arr.length === 1 ? 0 : (j / (arr.length - 1) - 0.5) * spread);
    c.x = n.x + Math.cos(ca) * r; c.y = n.y + Math.sin(ca) * r; place(c, ca, 78);
  });
  place(b, a, 120);
});
nodes[0].x = 0; nodes[0].y = 0;

const data = { generated_at: new Date().toISOString(), nodes };
const dataHash = createHash("sha256").update(JSON.stringify(nodes)).digest("hex");
const json = JSON.stringify({ ...data, data_sha256: dataHash }).replace(/</g, "\\u003c");

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BIZRA Node0 · Live Mind Map (observed state)</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif;background:#0b1120;color:#e2e8f0;display:flex;flex-direction:column;height:100vh}
header{padding:10px 16px;border-bottom:1px solid #1e293b;background:#0f172a}
h1{margin:0;font-size:16px}.banner{margin:4px 0 0;font-size:12px;color:#fbbf24}
main{flex:1;display:grid;grid-template-columns:320px 1fr;min-height:0}
aside{overflow:auto;padding:12px;border-right:1px solid #1e293b;display:flex;flex-direction:column;gap:10px}
.card{background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:10px}
.badge{display:inline-block;padding:1px 7px;border-radius:6px;font-size:11px;border:1px solid #334155}
.VERIFIED,.MEASURED{color:#34d399;border-color:#065f46}.DERIVED{color:#2dd4bf;border-color:#115e59}.UNKNOWN{color:#fb7185;border-color:#881337}.PREVIEW_ONLY,.DESIGNED_NOT_LIVE{color:#fbbf24;border-color:#78350f}
textarea,input{width:100%;background:#020617;color:#e2e8f0;border:1px solid #1e293b;border-radius:8px;padding:6px;font:inherit}
button{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit}button:hover{background:#334155}
#wrap{position:relative;min-height:0}canvas{width:100%;height:100%;display:block;cursor:grab}
ul{list-style:none;margin:0;padding:0;max-height:200px;overflow:auto}li button{width:100%;text-align:left;margin-bottom:3px;font-size:12px}
.small{font-size:12px;color:#94a3b8}
</style></head><body>
<header><h1>BIZRA Node0 · Live Mind Map</h1>
<p class="banner">Observed state, not runtime. Not a live autopoietic loop. Rebuild: <code>node scripts/build-live-mindmap.mjs</code></p></header>
<main><aside>
<div class="card"><div id="badge" class="badge"></div> <b id="title"></b><p id="desc" class="small"></p><p id="src" class="small"></p>
<label class="small" for="note">Your note (saved in this browser)</label><textarea id="note" rows="4"></textarea></div>
<div class="card"><div class="small">Generated <span id="gen"></span><br>data sha256 <span id="hash"></span></div>
<p><button id="center">Center</button> <button id="zin">Zoom +</button> <button id="zout">Zoom −</button> <button id="reset">Reset layout</button></p>
<p><button id="exp">Export JSON</button> <button id="imp">Import JSON</button><input id="file" type="file" accept="application/json" hidden></p></div>
<div class="card"><label class="small" for="q">Find node</label><input id="q" placeholder="type to filter"><ul id="list"></ul></div>
</aside><div id="wrap"><canvas id="c" tabindex="0" aria-label="Mind map canvas"></canvas></div></main>
<script>
const D=${json};const KEY="bizra-node0-map:"+D.data_sha256.slice(0,12);
const COLORS={hub:"#0f766e",node0:"#312e81",models:"#4c1d95",skills:"#065f46",chat:"#78350f",next:"#881337"};
const EDGE={VERIFIED:"#34d399",MEASURED:"#34d399",DERIVED:"#2dd4bf",UNKNOWN:"#fb7185",PREVIEW_ONLY:"#fbbf24",DESIGNED_NOT_LIVE:"#fbbf24"};
let st={notes:{},pos:{}};try{st=JSON.parse(localStorage.getItem(KEY))||st}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
const N=D.nodes;N.forEach(n=>{if(st.pos[n.id]){n.x=st.pos[n.id][0];n.y=st.pos[n.id][1]}});
const cv=document.getElementById("c"),cx=cv.getContext("2d");let sel=N[0],view={x:0,y:0,k:1},drag=null,pan=null;
const $=id=>document.getElementById(id);$("gen").textContent=D.generated_at;$("hash").textContent=D.data_sha256.slice(0,16)+"…";
function fit(){const r=cv.parentElement.getBoundingClientRect();cv.width=r.width;cv.height=r.height;draw()}
const S=(x,y)=>({x:cv.width/2+view.x+x*view.k,y:cv.height/2+view.y+y*view.k});
const W=(sx,sy)=>({x:(sx-cv.width/2-view.x)/view.k,y:(sy-cv.height/2-view.y)/view.k});
function draw(){cx.clearRect(0,0,cv.width,cv.height);
N.forEach(n=>{if(!n.parent)return;const p=N.find(m=>m.id===n.parent),a=S(p.x,p.y),b=S(n.x,n.y);cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.strokeStyle="rgba(148,163,184,.3)";cx.lineWidth=1.5;cx.stroke()});
N.forEach(n=>{const p=S(n.x,n.y),r=n.radius*view.k;cx.beginPath();cx.arc(p.x,p.y,r,0,7);cx.fillStyle=COLORS[n.category]||"#334155";cx.fill();cx.lineWidth=n===sel?4:2.5;cx.strokeStyle=n===sel?"#fff":EDGE[n.claim]||"#64748b";cx.stroke();
cx.fillStyle="#f8fafc";cx.font=Math.max(9,10*view.k)+"px system-ui";cx.textAlign="center";cx.textBaseline="middle";cx.fillText(n.label.length>16?n.label.slice(0,15)+"…":n.label,p.x,p.y)})}
function pick(n){sel=n;$("title").textContent=n.label;$("badge").textContent=n.claim;$("badge").className="badge "+n.claim;$("desc").textContent=n.desc;$("src").textContent="source: "+n.source;$("note").value=st.notes[n.id]||"";draw()}
function hit(e){const r=cv.getBoundingClientRect(),w=W(e.clientX-r.left,e.clientY-r.top);for(let i=N.length-1;i>=0;i--){const n=N[i];if(Math.hypot(w.x-n.x,w.y-n.y)<=n.radius+4)return n}return null}
cv.addEventListener("pointerdown",e=>{const n=hit(e);if(n){drag=n;pick(n)}else pan={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};cv.setPointerCapture(e.pointerId)});
cv.addEventListener("pointermove",e=>{if(drag){const r=cv.getBoundingClientRect(),w=W(e.clientX-r.left,e.clientY-r.top);drag.x=w.x;drag.y=w.y;draw()}else if(pan){view.x=pan.vx+e.clientX-pan.x;view.y=pan.vy+e.clientY-pan.y;draw()}});
cv.addEventListener("pointerup",()=>{if(drag){st.pos[drag.id]=[drag.x,drag.y];save()}drag=null;pan=null});
cv.addEventListener("wheel",e=>{e.preventDefault();view.k=Math.min(3,Math.max(.3,view.k*(e.deltaY<0?1.1:.9)));draw()},{passive:false});
cv.addEventListener("keydown",e=>{const i=N.indexOf(sel);if(e.key==="ArrowRight"||e.key==="ArrowDown")pick(N[(i+1)%N.length]);if(e.key==="ArrowLeft"||e.key==="ArrowUp")pick(N[(i-1+N.length)%N.length])});
$("note").addEventListener("input",e=>{st.notes[sel.id]=e.target.value;save()});
$("center").onclick=()=>{view={x:0,y:0,k:1};draw()};$("zin").onclick=()=>{view.k=Math.min(3,view.k*1.2);draw()};$("zout").onclick=()=>{view.k=Math.max(.3,view.k/1.2);draw()};
$("reset").onclick=()=>{st.pos={};save();location.reload()};
$("exp").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({key:KEY,state:st},null,1)],{type:"application/json"}));a.download="bizra-node0-map-state.json";a.click()};
$("imp").onclick=()=>$("file").click();$("file").onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());if(j.state&&typeof j.state==="object"){st={notes:j.state.notes||{},pos:j.state.pos||{}};save();location.reload()}}catch(x){alert("Invalid file")}};
function list(f){const ul=$("list");ul.innerHTML="";N.filter(n=>(n.label+n.desc).toLowerCase().includes(f.toLowerCase())).slice(0,40).forEach(n=>{const li=document.createElement("li"),b=document.createElement("button");b.textContent=n.claim+" · "+n.label;b.onclick=()=>pick(n);li.appendChild(b);ul.appendChild(li)})}
$("q").oninput=e=>list(e.target.value);list("");addEventListener("resize",fit);fit();pick(N[0]);
</script></body></html>`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html);
console.log(JSON.stringify({ outFile, nodes: nodes.length, bytes: html.length, data_sha256: dataHash, external_refs: (html.match(/https?:\/\//g) ?? []).length }));
