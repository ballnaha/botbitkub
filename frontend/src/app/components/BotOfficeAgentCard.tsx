import { useMemo } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Switch, Typography } from "@mui/material";
import { Activity, Briefcase, Brain, Coins, Eye, Radar, ShieldCheck, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { AiWatchlistItem, BotConfig, HistoryItem, PositionItem } from "./dashboardTypes";
import { GeminiLogo, DeepSeekLogo } from "./Logos";
import { AgentSprite, type AgentSpriteConfig } from "./AgentSprite";

const AGENT_SPRITES: Record<string, AgentSpriteConfig | undefined> = {
  manager: undefined,
  scout: undefined,
  analyst: undefined,
  risk: undefined,
  trader: undefined,
};

interface OperationStat {
  label: string;
  value: React.ReactNode;
  color?: string;
}

interface BotOfficeAgentCardProps {
  botConfig: BotConfig;
  positions: PositionItem[];
  history: HistoryItem[];
  aiWatchlist: AiWatchlistItem[];
  riskLabel: string;
  riskColor: string;
  riskBg: string;
  operationStats: OperationStat[];
  handleBotToggle: () => void;
  setActiveView?: (view: "settings") => void;
}

type AgentStatus = "working" | "idle" | "alert" | "off";

const statusMeta: Record<AgentStatus, { label: string; color: string }> = {
  working: { label: "กำลังทำงาน", color: "#00c16a" },
  idle: { label: "รอจังหวะ", color: "#94a3b8" },
  alert: { label: "เฝ้าระวัง", color: "#fbbf24" },
  off: { label: "ปิดอยู่", color: "#64748b" },
};

// ── Pixel-art office worker (seated at a desk, lightly animated) ──────────────
const PIXEL_SKIN = "#f1c8a5";
const PIXEL_HAIR = "#3b2f2a";
const PIXEL_EYE = "#1f2937";

// Each layer is an 18×16 grid. '.' = transparent. Layers are stacked back-to-front.
const L_MONITOR = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "............MMMMM.",
  "............MLGGM.",
  "............MGLGM.",
  "............MGGLM.",
  "............MGGGM.",
  "............MMMMM.",
  "..............M...",
  "..................",
  "..................",
  "..................",
  "..................",
];

const L_BODY = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  ".......SS.........",
  "...AAAAAAAA.......",
  "..AAAAAAAAAA......",
  "..AAAAAAAAAA......",
  "...AAAAAAAA.......",
  "..................",
  "..................",
  "..................",
  "..................",
];

const L_HEAD = [
  "..................",
  "....HHHHHH........",
  "...HHHHHHHH.......",
  "...HSSSSSSH.......",
  "...HSESSESH.......",
  "...HSSSSSSH.......",
  "....SSSSSS........",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
];

const L_DESK = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "DDDDDDDDDDDDDDDDDD",
  "dddddddddddddddddd",
  "dddddddddddddddddd",
  "dddddddddddddddddd",
];

const L_KEYBOARD = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "....KKKKKKKK......",
  "..................",
  "..................",
  "..................",
];

function layerRects(rows: string[], palette: Record<string, string>, prefix: string) {
  const out: React.ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = palette[row[x]];
      if (fill) out.push(<rect key={`${prefix}-${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  });
  return out;
}

const PIXEL_KEYFRAMES = `
@keyframes paBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.4px); } }
@keyframes paTypeA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.7px); } }
@keyframes paTypeB { 0%,100% { transform: translateY(0.7px); } 50% { transform: translateY(0); } }
@keyframes paScreen { 0%,100% { opacity: 1; } 50% { opacity: 0.72; } }
.pa-head { animation: paBob 2.8s ease-in-out infinite; }
.pa-hl { animation: paTypeA 0.5s steps(2,end) infinite; }
.pa-hr { animation: paTypeB 0.5s steps(2,end) infinite; }
.pa-screen { animation: paScreen 1.6s steps(2,end) infinite; }
`;

function PixelOfficeDecor({ accent, active }: { accent: string; active: boolean }) {
  const mutedAccent = active ? accent : "#64748b";

  return (
    <>
      <rect x={2} y={16} width={16} height={1} fill="rgba(2, 6, 23, 0.55)" />
      <rect x={4} y={15} width={12} height={1} fill="rgba(2, 6, 23, 0.45)" />
      <rect x={6} y={8} width={6} height={4} fill="#1f2937" />
      <rect x={7} y={7} width={4} height={1} fill="#334155" />
      <rect x={6} y={9} width={1} height={3} fill="#111827" />
      <rect x={11} y={9} width={1} height={3} fill="#111827" />
      <rect x={12} y={5} width={6} height={6} fill="rgba(255,255,255,0.03)" />
      <rect x={13} y={6} width={4} height={1} fill={`${mutedAccent}66`} />
      <rect x={13} y={8} width={3} height={1} fill={`${mutedAccent}44`} />
      <rect x={3} y={13} width={1} height={1} fill="#c08457" />
      <rect x={4} y={13} width={1} height={1} fill="#7c4a2d" />
      <rect x={2} y={12} width={2} height={1} fill="#e2e8f0" opacity={active ? 0.7 : 0.35} />
      <rect x={3} y={3} width={1} height={3} fill="#0f172a" />
      <rect x={4} y={2} width={2} height={1} fill="#0f172a" />
      <rect x={9} y={2} width={1} height={1} fill="#0f172a" />
      <rect x={9} y={3} width={1} height={3} fill="#0f172a" />
      <rect x={10} y={5} width={1} height={1} fill={mutedAccent} />
    </>
  );
}

// ── Pixel-art manager (the boss) ──────────────────────────────────────────
const L_MANAGER_HEAD = [
  ".....C..C.........",
  ".....CCCC.........",
  "....HHHHHH........",
  "...HHHHHHHH.......",
  "...HSSSSSSH.......",
  "...HGESSEGH.......",
  "...HSSMMSSH.......",
  "....SSSSSS........",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
];

const L_MANAGER_BODY = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  ".......SS.........",
  "...AAAWWTAAA......",
  "..AAAWWTAAAA......",
  "..AAAAAAAAAA......",
  "...AAAAAAAA.......",
  "..................",
  "..................",
  "..................",
  "..................",
];

const L_MANAGER_MONITOR = [
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "............mmmmm.",
  "............mgygm.",
  "............myyym.",
  "............mgygm.",
  "............mgggm.",
  "............mmmmm.",
  "..............m...",
  "..................",
  "..................",
  "..................",
  "..................",
];

const MANAGER_KEYFRAMES = `
@keyframes paBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.4px); } }
@keyframes paTypeA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.7px); } }
@keyframes paTypeB { 0%,100% { transform: translateY(0.7px); } 50% { transform: translateY(0); } }
@keyframes paScreen { 0%,100% { opacity: 1; } 50% { opacity: 0.72; } }
@keyframes bossSteamL { 0%,100% { transform: translateY(0) translateX(0); opacity: 0.35; } 50% { transform: translateY(-0.8px) translateX(0.3px); opacity: 0.8; } }
@keyframes bossSteamR { 0%,100% { transform: translateY(0.8px) translateX(0.3px); opacity: 0.8; } 50% { transform: translateY(0) translateX(0); opacity: 0.35; } }
.pa-head { animation: paBob 2.8s ease-in-out infinite; }
.pa-hl { animation: paTypeA 0.5s steps(2,end) infinite; }
.pa-hr { animation: paTypeB 0.5s steps(2,end) infinite; }
.pa-screen { animation: paScreen 1.6s steps(2,end) infinite; }
.pa-steam-left { animation: bossSteamL 1.8s ease-in-out infinite; }
.pa-steam-right { animation: bossSteamR 1.8s ease-in-out infinite; }
`;

function PixelManagerDecor({ active }: { active: boolean }) {
  return (
    <>
      <rect x={2} y={16} width={16} height={1} fill="rgba(2, 6, 23, 0.55)" />
      <rect x={4} y={15} width={12} height={1} fill="rgba(2, 6, 23, 0.45)" />
      {/* Boss Chair */}
      <rect x={5} y={6} width={6} height={6} fill="#7f1d1d" rx={0.5} />
      <rect x={4} y={7} width={8} height={4} fill="#991b1b" rx={0.5} />
      <rect x={5} y={7} width={6} height={1} fill="#fbbf24" opacity={active ? 0.8 : 0.4} />
      {/* Background Decor */}
      <rect x={12} y={5} width={6} height={6} fill="rgba(255,255,255,0.03)" />
      {/* Mug */}
      <rect x={3} y={13} width={1} height={1} fill="#c08457" />
      <rect x={4} y={13} width={1} height={1} fill="#7c4a2d" />
      {/* Mug content */}
      <rect x={3} y={12} width={1} height={1} fill="#e2e8f0" opacity={active ? 0.7 : 0.35} />
      {/* Steam */}
      <rect className={active ? "pa-steam-left" : undefined} x={3} y={11} width={1} height={1} fill="#f1f5f9" opacity={active ? 0.75 : 0.2} />
      <rect className={active ? "pa-steam-right" : undefined} x={4} y={10} width={1} height={1} fill="#f1f5f9" opacity={active ? 0.5 : 0.1} />
      {/* Gold Nameplate */}
      <rect x={13} y={13} width={3} height={1} fill="#fbbf24" />
      <rect x={14} y={12} width={1} height={1} fill="#1e293b" />
    </>
  );
}

function PixelManager({ active = true, size = 46 }: { active?: boolean; size?: number }) {
  const shirt = active ? "#1e293b" : "#475569";
  const palette: Record<string, string> = {
    H: PIXEL_HAIR,
    S: PIXEL_SKIN,
    E: "#0f172a",
    G: "#fbbf24",
    M: "#3b2f2a",
    A: shirt,
    W: "#f8fafc",
    T: "#ef5b63",
    D: "#451a03",
    d: "#270b00",
    m: "#243044",
    g: "#0e2a20",
    y: "#fbbf24",
    K: "#11161f",
    C: "#fbbf24",
  };
  return (
    <svg width={size} height={(size * 18) / 20} viewBox="0 0 20 18" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{MANAGER_KEYFRAMES}</style>}
      <g transform="translate(1 1)">
        <PixelManagerDecor active={active} />
        <g className={active ? "pa-screen" : undefined}>{layerRects(L_MANAGER_MONITOR, palette, "mon")}</g>
        {layerRects(L_MANAGER_BODY, palette, "body")}
        <g className={active ? "pa-head" : undefined}>{layerRects(L_MANAGER_HEAD, palette, "head")}</g>
        {layerRects(L_DESK, palette, "desk")}
        {layerRects(L_KEYBOARD, palette, "kb")}
        <g className={active ? "pa-hl" : undefined}>
          <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
        <g className={active ? "pa-hr" : undefined}>
          <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
      </g>
    </svg>
  );
}

function PixelAgent({ accent, active = true, size = 46 }: { accent: string; active?: boolean; size?: number }) {
  const shirt = active ? accent : "#64748b";
  const palette: Record<string, string> = {
    H: PIXEL_HAIR,
    S: PIXEL_SKIN,
    E: PIXEL_EYE,
    A: shirt,
    D: "#6b4a2b",
    d: "#4a3017",
    M: "#243044",
    G: "#0e2a20",
    L: shirt,
    K: "#11161f",
  };
  return (
    <svg width={size} height={(size * 18) / 20} viewBox="0 0 20 18" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{PIXEL_KEYFRAMES}</style>}
      <g transform="translate(1 1)">
        <PixelOfficeDecor accent={accent} active={active} />
        <g className={active ? "pa-screen" : undefined}>{layerRects(L_MONITOR, palette, "mon")}</g>
        {layerRects(L_BODY, palette, "body")}
        <g className={active ? "pa-head" : undefined}>{layerRects(L_HEAD, palette, "head")}</g>
        {layerRects(L_DESK, palette, "desk")}
        {layerRects(L_KEYBOARD, palette, "kb")}
        <rect x={11} y={12} width={2} height={1} fill={accent} opacity={active ? 0.85 : 0.4} />
        <g className={active ? "pa-hl" : undefined}>
          <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
        <g className={active ? "pa-hr" : undefined}>
          <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
      </g>
    </svg>
  );
}

// ── Pixel-art scout (the investigator) ────────────────────────────────────
const L_SCOUT_HEAD = [
  "..................",
  ".....HHHHHH.......",
  "....HHHHHHHH......",
  "...PHSSSSSSHP.....",
  "..PPHSVVVVHPP.....",
  "..P.HSSSSSH.P.....",
  "....SSSSSS..t.....",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
];

function PixelScoutDecor({ accent, active }: { accent: string; active: boolean }) {
  const mutedAccent = active ? accent : "#64748b";

  return (
    <>
      <rect x={2} y={16} width={16} height={1} fill="rgba(2, 6, 23, 0.55)" />
      <rect x={4} y={15} width={12} height={1} fill="rgba(2, 6, 23, 0.45)" />
      <rect x={1} y={5} width={5} height={5} fill="rgba(96, 165, 250, 0.08)" />
      <rect x={12} y={4} width={6} height={7} fill="rgba(255,255,255,0.035)" />
      <rect x={13} y={5} width={4} height={1} fill={`${mutedAccent}55`} />
      <rect x={13} y={9} width={3} height={1} fill={`${mutedAccent}33`} />
      <rect x={2} y={12} width={1} height={2} fill="#334155" />
      <rect x={2} y={10} width={1} height={2} fill="#475569" />
      <rect className={active ? "sa-antenna-blink" : undefined} x={2} y={9} width={1} height={1} fill={mutedAccent} />
      <rect x={3} y={13} width={2} height={1} fill="#1e293b" />
      <rect x={3} y={12} width={1} height={1} fill="#475569" />
      <rect x={4} y={12} width={1} height={1} fill="#475569" />
      <rect x={14} y={12} width={3} height={1} fill={mutedAccent} opacity={active ? 0.75 : 0.28} />
    </>
  );
}

function PixelScout({ accent, active = true, size = 46 }: { accent: string; active?: boolean; size?: number }) {
  const shirt = active ? accent : "#64748b";
  const palette: Record<string, string> = {
    H: PIXEL_HAIR,
    S: PIXEL_SKIN,
    E: PIXEL_EYE,
    A: shirt,
    D: "#6b4a2b",
    d: "#4a3017",
    M: "#162030",
    G: "#071827",
    B: accent,
    C: "#00c16a",
    R: "#ef5b63",
    Y: "#fbbf24",
    K: "#11161f",
    P: "#334155", // headphones
    t: "#94a3b8", // mic boom
    V: active ? accent : "#64748b", // visor
    W: "#dbeafe",
  };

  // small scan panel — left side (x=0-3, rows 5-9)
  const L_SCAN = [
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    ".MMMMM............",
    ".MGBGM............",
    ".MBCBM............",
    ".MGGBM............",
    ".MMMMM............",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
  ];

  // price trend monitor — right side (x=12-16, rows 5-11)
  const L_PRICE = [
    "..................",
    "..................",
    "..................",
    "..................",
    "............MMMMMM",
    "............MMMMM.",
    "............MBYGM.",
    "............MGBRM.",
    "............MGBGM.",
    "............MCGGM.",
    "............MMMMM.",
    "..............M...",
    "..................",
    "..................",
    "..................",
    "..................",
  ];

  const KF = `
    @keyframes paBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.4px)}}
    @keyframes paTypeA{0%,100%{transform:translateY(0)}50%{transform:translateY(.7px)}}
    @keyframes paTypeB{0%,100%{transform:translateY(.7px)}50%{transform:translateY(0)}}
    @keyframes saScan{0%,100%{opacity:1}25%{opacity:.15}50%{opacity:.8}75%{opacity:.4}}
    @keyframes saSweep{0%{transform:translateX(0);opacity:.25}50%{opacity:1}100%{transform:translateX(4px);opacity:.25}}
    @keyframes saTick{0%,100%{opacity:1}50%{opacity:.55}}
    @keyframes saAntenna{0%,100%{opacity:1}50%{opacity:0.3}}
    @keyframes saVisor{0%,100%{opacity:.72}50%{opacity:1}}
    .pa-head{animation:paBob 2.8s ease-in-out infinite}
    .pa-hl{animation:paTypeA .5s steps(2,end) infinite}
    .pa-hr{animation:paTypeB .5s steps(2,end) infinite}
    .sa-scan{animation:saScan .7s steps(4,end) infinite}
    .sa-sweep{animation:saSweep 1.2s steps(4,end) infinite}
    .sa-tick{animation:saTick 1.6s steps(2,end) infinite}
    .sa-antenna-blink{animation:saAntenna 0.8s ease-in-out infinite}
    .sa-visor{animation:saVisor 1.4s steps(2,end) infinite}
  `;

  return (
    <svg width={size} height={(size * 18) / 20} viewBox="0 0 20 18" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{KF}</style>}
      <g transform="translate(1 1)">
        <PixelScoutDecor accent={accent} active={active} />
        <g className={active ? "sa-scan" : undefined}>{layerRects(L_SCAN, palette, "sc")}</g>
        <g className={active ? "sa-sweep" : undefined}>
          <rect x={2} y={6} width={1} height={3} fill={accent} opacity={active ? 0.9 : 0.25} />
        </g>
        <g className={active ? "sa-tick" : undefined}>{layerRects(L_PRICE, palette, "pr")}</g>
        {layerRects(L_BODY, palette, "body")}
        <g className={active ? "pa-head" : undefined}>{layerRects(L_SCOUT_HEAD, palette, "head")}</g>
        <g className={active ? "sa-visor" : undefined}>
          <rect x={6} y={5} width={4} height={1} fill={accent} opacity={active ? 0.35 : 0.18} />
        </g>
        {layerRects(L_DESK, palette, "desk")}
        {layerRects(L_KEYBOARD, palette, "kb")}
        <rect x={1} y={6} width={2} height={1} fill={accent} opacity={active ? 0.9 : 0.35} />
        <rect x={14} y={7} width={2} height={1} fill="#00c16a" opacity={active ? 0.9 : 0.35} />
        <rect x={15} y={8} width={1} height={1} fill="#ef5b63" opacity={active ? 0.82 : 0.3} />
        <rect x={16} y={6} width={1} height={1} fill="#fbbf24" opacity={active ? 0.82 : 0.3} />
        <g className={active ? "pa-hl" : undefined}>
          <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
        <g className={active ? "pa-hr" : undefined}>
          <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
      </g>
    </svg>
  );
}

const L_ANALYST_HEAD = [
  "..................",
  "....HHHHHH........",
  "...HHHHHHHH.......",
  "..HSSSSSSSH.......",
  "..HSESVSESH.......",
  "..HSSSSSSSH.......",
  "...SSSSSS........",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
];

function PixelAnalystDecor({ accent, active }: { accent: string; active: boolean }) {
  const mutedAccent = active ? accent : "#64748b";

  return (
    <>
      <rect x={2} y={16} width={16} height={1} fill="rgba(2, 6, 23, 0.55)" />
      <rect x={4} y={15} width={12} height={1} fill="rgba(2, 6, 23, 0.45)" />
      <rect x={1} y={4} width={5} height={5} fill="rgba(167, 139, 250, 0.07)" />
      <rect x={12} y={4} width={6} height={7} fill="rgba(255,255,255,0.035)" />
      <rect x={13} y={5} width={1} height={5} fill={`${mutedAccent}36`} />
      <rect x={15} y={6} width={1} height={4} fill={`${mutedAccent}55`} />
      <rect x={17} y={7} width={1} height={3} fill={`${mutedAccent}28`} />
      <rect x={3} y={3} width={1} height={1} fill={mutedAccent} opacity={active ? 0.8 : 0.3} />
      <rect x={5} y={2} width={1} height={1} fill={mutedAccent} opacity={active ? 0.55 : 0.22} />
      <rect x={2} y={12} width={3} height={1} fill="#111827" />
      <rect x={3} y={11} width={1} height={1} fill={mutedAccent} opacity={active ? 0.85 : 0.3} />
    </>
  );
}

function PixelAnalyst({ accent, active = true, size = 46 }: { accent: string; active?: boolean; size?: number }) {
  const shirt = active ? accent : "#64748b";
  const palette: Record<string, string> = {
    H: "#30263f",
    S: PIXEL_SKIN,
    E: PIXEL_EYE,
    A: shirt,
    D: "#3f2a56",
    d: "#261936",
    M: "#172033",
    G: "#071827",
    B: accent,
    C: "#00c16a",
    V: active ? accent : "#64748b",
    K: "#11161f",
    W: "#dbeafe",
    P: "#a78bfa",
  };

  const L_BRAIN = [
    "..................",
    "..................",
    "..MMMM............",
    ".MBPBM............",
    ".MPBPM............",
    ".MBPBM............",
    "..MMMM............",
    "...M..............",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
  ];

  const L_MODEL = [
    "..................",
    "..................",
    "..................",
    "..................",
    "............MMMMM.",
    "............MBCBM.",
    "............MCBCM.",
    "............MBCBM.",
    "............MCBCM.",
    "............MMMMM.",
    "..............M...",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
  ];

  const KF = `
    @keyframes paBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.4px)}}
    @keyframes paTypeA{0%,100%{transform:translateY(0)}50%{transform:translateY(.7px)}}
    @keyframes paTypeB{0%,100%{transform:translateY(.7px)}50%{transform:translateY(0)}}
    @keyframes aaPulse{0%,100%{opacity:.65}50%{opacity:1}}
    @keyframes aaNode{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-1px);opacity:1}}
    .pa-head{animation:paBob 2.8s ease-in-out infinite}
    .pa-hl{animation:paTypeA .5s steps(2,end) infinite}
    .pa-hr{animation:paTypeB .5s steps(2,end) infinite}
    .aa-pulse{animation:aaPulse 1.1s steps(2,end) infinite}
    .aa-node{animation:aaNode 1.8s ease-in-out infinite}
  `;

  return (
    <svg width={size} height={(size * 18) / 20} viewBox="0 0 20 18" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{KF}</style>}
      <g transform="translate(1 1)">
        <PixelAnalystDecor accent={accent} active={active} />
        <g className={active ? "aa-pulse" : undefined}>{layerRects(L_BRAIN, palette, "brain")}</g>
        <g className={active ? "aa-pulse" : undefined}>{layerRects(L_MODEL, palette, "model")}</g>
        {layerRects(L_BODY, palette, "body")}
        <g className={active ? "pa-head" : undefined}>{layerRects(L_ANALYST_HEAD, palette, "head")}</g>
        <g className={active ? "aa-node" : undefined}>
          <rect x={5} y={5} width={1} height={1} fill={accent} opacity={active ? 0.9 : 0.28} />
          <rect x={12} y={6} width={1} height={1} fill={accent} opacity={active ? 0.75 : 0.24} />
          <rect x={16} y={5} width={1} height={1} fill={accent} opacity={active ? 0.65 : 0.22} />
        </g>
        {layerRects(L_DESK, palette, "desk")}
        {layerRects(L_KEYBOARD, palette, "kb")}
        <rect x={11} y={12} width={2} height={1} fill={accent} opacity={active ? 0.85 : 0.35} />
        <g className={active ? "pa-hl" : undefined}>
          <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
        <g className={active ? "pa-hr" : undefined}>
          <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
      </g>
    </svg>
  );
}

const L_RISK_HEAD = [
  "..................",
  "....HHHHHH........",
  "...HHHHHHHH.......",
  "...HSSSSSSH.......",
  "...HSESSESH.......",
  "...HSSMMSSH.......",
  "....SSSSSS........",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
];

function PixelRisk({ accent, active = true, size = 46 }: { accent: string; active?: boolean; size?: number }) {
  const palette: Record<string, string> = {
    H: PIXEL_HAIR,
    S: PIXEL_SKIN,
    E: PIXEL_EYE,
    A: active ? "#334155" : "#64748b",
    D: "#5b3a14",
    d: "#392207",
    M: "#172033",
    G: "#071827",
    B: accent,
    R: "#ef5b63",
    C: "#00c16a",
    K: "#11161f",
  };

  const KF = `
    @keyframes paBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.4px)}}
    @keyframes paTypeA{0%,100%{transform:translateY(0)}50%{transform:translateY(.7px)}}
    @keyframes paTypeB{0%,100%{transform:translateY(.7px)}50%{transform:translateY(0)}}
    @keyframes raShield{0%,100%{opacity:.7}50%{opacity:1}}
    .pa-head{animation:paBob 2.8s ease-in-out infinite}
    .pa-hl{animation:paTypeA .5s steps(2,end) infinite}
    .pa-hr{animation:paTypeB .5s steps(2,end) infinite}
    .ra-shield{animation:raShield 1.2s steps(2,end) infinite}
  `;

  return (
    <svg width={size} height={(size * 18) / 20} viewBox="0 0 20 18" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{KF}</style>}
      <g transform="translate(1 1)">
        <rect x={2} y={16} width={16} height={1} fill="rgba(2, 6, 23, 0.55)" />
        <rect x={4} y={15} width={12} height={1} fill="rgba(2, 6, 23, 0.45)" />
        <rect x={1} y={5} width={5} height={6} fill="rgba(251, 191, 36, 0.06)" />
        <rect x={13} y={4} width={4} height={6} fill="rgba(255,255,255,0.035)" />
        <rect x={14} y={5} width={2} height={1} fill={accent} opacity={active ? 0.75 : 0.25} />
        <rect x={14} y={7} width={1} height={2} fill="#ef5b63" opacity={active ? 0.75 : 0.25} />
        <g className={active ? "ra-shield" : undefined}>
          <rect x={2} y={6} width={3} height={1} fill={accent} opacity={active ? 0.9 : 0.3} />
          <rect x={2} y={7} width={3} height={2} fill={accent} opacity={active ? 0.65 : 0.22} />
          <rect x={3} y={9} width={1} height={1} fill={accent} opacity={active ? 0.9 : 0.3} />
        </g>
        {layerRects(L_BODY, palette, "body")}
        <g className={active ? "pa-head" : undefined}>{layerRects(L_RISK_HEAD, palette, "head")}</g>
        {layerRects(L_DESK, palette, "desk")}
        {layerRects(L_KEYBOARD, palette, "kb")}
        <rect x={11} y={12} width={2} height={1} fill={accent} opacity={active ? 0.85 : 0.35} />
        <g className={active ? "pa-hl" : undefined}>
          <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
        <g className={active ? "pa-hr" : undefined}>
          <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
      </g>
    </svg>
  );
}

const L_TRADER_HEAD = [
  "..................",
  "....HHHHHH........",
  "...HHHHHHHH.......",
  "...HSSSSSSH.......",
  "...HSESSESH.......",
  "...HSSSSSSH.......",
  "....SSSSSS........",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
  "..................",
];

function PixelTrader({ accent, active = true, size = 46 }: { accent: string; active?: boolean; size?: number }) {
  const palette: Record<string, string> = {
    H: "#2b211d",
    S: PIXEL_SKIN,
    E: PIXEL_EYE,
    A: active ? accent : "#64748b",
    D: "#31502e",
    d: "#1e321c",
    M: "#162030",
    G: "#071827",
    B: accent,
    R: "#ef5b63",
    Y: "#fbbf24",
    K: "#11161f",
  };

  const L_TERMINAL = [
    "..................",
    "..................",
    "..................",
    "..................",
    "............MMMMM.",
    "............MCGGM.",
    "............MGCGM.",
    "............MMGCM.",
    "............MCCGM.",
    "............MMMMM.",
    "..............M...",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
  ];

  const KF = `
    @keyframes paBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.4px)}}
    @keyframes paTypeA{0%,100%{transform:translateY(0)}50%{transform:translateY(.7px)}}
    @keyframes paTypeB{0%,100%{transform:translateY(.7px)}50%{transform:translateY(0)}}
    @keyframes taCandle{0%,100%{transform:scaleY(.7);transform-origin:bottom}50%{transform:scaleY(1);transform-origin:bottom}}
    .pa-head{animation:paBob 2.8s ease-in-out infinite}
    .pa-hl{animation:paTypeA .5s steps(2,end) infinite}
    .pa-hr{animation:paTypeB .5s steps(2,end) infinite}
    .ta-candle{animation:taCandle .9s steps(2,end) infinite}
  `;

  return (
    <svg width={size} height={(size * 18) / 20} viewBox="0 0 20 18" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{KF}</style>}
      <g transform="translate(1 1)">
        <rect x={2} y={16} width={16} height={1} fill="rgba(2, 6, 23, 0.55)" />
        <rect x={4} y={15} width={12} height={1} fill="rgba(2, 6, 23, 0.45)" />
        <rect x={1} y={5} width={5} height={6} fill="rgba(0, 193, 106, 0.06)" />
        <g className={active ? "ta-candle" : undefined}>
          <rect x={2} y={8} width={1} height={2} fill={accent} opacity={active ? 0.9 : 0.3} />
          <rect x={4} y={6} width={1} height={4} fill={accent} opacity={active ? 0.75 : 0.25} />
          <rect x={6} y={7} width={1} height={3} fill="#ef5b63" opacity={active ? 0.75 : 0.25} />
        </g>
        <g className={active ? "pa-screen" : undefined}>{layerRects(L_TERMINAL, palette, "term")}</g>
        {layerRects(L_BODY, palette, "body")}
        <g className={active ? "pa-head" : undefined}>{layerRects(L_TRADER_HEAD, palette, "head")}</g>
        {layerRects(L_DESK, palette, "desk")}
        {layerRects(L_KEYBOARD, palette, "kb")}
        <rect x={11} y={12} width={2} height={1} fill={accent} opacity={active ? 0.85 : 0.35} />
        <g className={active ? "pa-hl" : undefined}>
          <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
        <g className={active ? "pa-hr" : undefined}>
          <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
          <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        </g>
      </g>
    </svg>
  );
}

function AgentAvatar({
  agentKey,
  accent,
  active,
  size = 50,
}: {
  agentKey: string;
  accent: string;
  active: boolean;
  size?: number;
}) {
  const sprite = AGENT_SPRITES[agentKey];

  if (sprite) {
    return <AgentSprite {...sprite} fitWidth={size + 4} fitHeight={Math.round(size * 0.92)} active={active} />;
  }

  if (agentKey === "manager") {
    return <PixelManager active={active} size={size} />;
  }

  if (agentKey === "scout") {
    return <PixelScout accent={accent} active={active} size={size} />;
  }

  if (agentKey === "analyst") {
    return <PixelAnalyst accent={accent} active={active} size={size} />;
  }

  if (agentKey === "risk") {
    return <PixelRisk accent={accent} active={active} size={size} />;
  }

  if (agentKey === "trader") {
    return <PixelTrader accent={accent} active={active} size={size} />;
  }

  return <PixelAgent accent={accent} active={active} size={size} />;
}

interface AgentDesk {
  key: string;
  name: string;
  role: string;
  accent: string;
  icon: React.ReactNode;
  status: AgentStatus;
  note: React.ReactNode;
  metrics: OperationStat[];
}

interface BotTradingRoomProps {
  desks: AgentDesk[];
  positions: PositionItem[];
  running: boolean;
  radarSource: string;
  watchSize: number;
  buys: number;
  openCount: number;
  maxTrades: number;
  unrealizedPnl: number;
  avgConfidence: number;
}

function BotTradingRoom({ desks, positions, running, radarSource, watchSize, buys, openCount, maxTrades, unrealizedPnl, avgConfidence }: BotTradingRoomProps) {
  const pnlColor = unrealizedPnl > 0 ? "#00c16a" : unrealizedPnl < 0 ? "#ef5b63" : "#94a3b8";
  const roomGlow = running ? "rgba(0, 193, 106, 0.16)" : "rgba(148, 163, 184, 0.08)";
  const roomDesks = desks.slice(0, 4);
  const positionBars = positions.slice(0, 12);
  const maxAbsPositionPnl = Math.max(...positionBars.map((position) => Math.abs(position.pnl_thb || 0)), 1);

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: { xs: 420, sm: 360, lg: 300 },
        borderRadius: "12px",
        border: running ? "1px solid rgba(0, 193, 106, 0.18)" : "1px solid rgba(255, 255, 255, 0.055)",
        background:
          "linear-gradient(180deg, rgba(12, 20, 35, 0.92) 0%, rgba(5, 10, 20, 0.98) 58%, rgba(3, 7, 14, 1) 100%)",
        boxShadow: running ? `inset 0 0 42px ${roomGlow}` : "inset 0 0 34px rgba(0, 0, 0, 0.36)",
        mb: 1.25,
        imageRendering: "pixelated",
        "@keyframes roomScan": {
          "0%": { transform: "translateX(-110%)" },
          "100%": { transform: "translateX(110%)" },
        },
        "@keyframes roomBlink": {
          "0%, 100%": { opacity: 0.35 },
          "50%": { opacity: 1 },
        },
        "@keyframes roomTicker": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "42%",
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.92) 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.055) 0 2px, transparent 2px 18px), repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 18px)",
          clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)",
        }}
      />

      <Box sx={{ position: "relative", zIndex: 1, p: { xs: 1.25, sm: 1.5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1.8fr 1.1fr" }, gap: 1.1, alignItems: "stretch" }}>
          <Box sx={{ display: "grid", gap: 1 }}>
            <RoomPanel label="RADAR" value={radarSource} accent="#60a5fa" active={running} />
            <RoomPanel label="AI SIGNAL" value={`${fmt(buys)} buy / ${fmt(avgConfidence, 0)}%`} accent="#a78bfa" active={running && buys > 0} />
          </Box>

          <Box
            sx={{
              position: "relative",
              minHeight: { xs: 132, sm: 150, lg: 164 },
              overflow: "hidden",
              borderRadius: "8px",
              border: `1px solid ${pnlColor}33`,
              backgroundColor: "rgba(2, 6, 23, 0.68)",
              boxShadow: `0 0 24px ${pnlColor}14`,
            }}
          >
            <Box sx={{ position: "absolute", inset: 0, opacity: 0.34, backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "100% 14px" }} />
            {running && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "55%",
                  background: `linear-gradient(90deg, transparent, ${pnlColor}22, transparent)`,
                  animation: "roomScan 3.6s linear infinite",
                }}
              />
            )}
            <Box sx={{ position: "relative", p: 1.25, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", fontWeight: 800, letterSpacing: "0.12em" }}>
                  OPEN POSITION PNL
                </Typography>
                <Chip
                  size="small"
                  label={running ? "ONLINE" : "OFFLINE"}
                  sx={{
                    height: 20,
                    fontSize: "9px",
                    fontWeight: 900,
                    color: running ? "#00c16a" : "#94a3b8",
                    backgroundColor: running ? "rgba(0, 193, 106, 0.1)" : "rgba(148, 163, 184, 0.08)",
                    border: running ? "1px solid rgba(0, 193, 106, 0.22)" : "1px solid rgba(148, 163, 184, 0.12)",
                  }}
                />
              </Box>

              <Box sx={{ minHeight: 72, px: 0.25, display: "flex", alignItems: "end", gap: "4px" }}>
                {positionBars.length > 0 ? positionBars.map((position) => {
                  const pnl = position.pnl_thb || 0;
                  const barColor = pnl > 0 ? "#00c16a" : pnl < 0 ? "#ef5b63" : "#94a3b8";
                  const height = Math.max(10, Math.round((Math.abs(pnl) / maxAbsPositionPnl) * 54));
                  const symbol = position.symbol.replace(/^THB_?/i, "").replace(/_THB$/i, "");
                  return (
                    <Box key={position.symbol} sx={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.45 }}>
                      <Box
                        title={`${position.symbol}: ${pnl >= 0 ? "+" : ""}${fmt(pnl, 2)} THB`}
                        sx={{
                          width: "100%",
                          maxWidth: 22,
                          height,
                          backgroundColor: barColor,
                          opacity: running ? 0.88 : 0.34,
                          boxShadow: running ? `0 0 10px ${barColor}66` : "none",
                        }}
                      />
                      <Typography sx={{ width: "100%", color: "text.secondary", fontSize: "0.52rem", fontWeight: 800, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1 }}>
                        {symbol}
                      </Typography>
                    </Box>
                  );
                }) : (
                  <Box sx={{ width: "100%", minHeight: 58, display: "grid", placeItems: "center", border: "1px dashed rgba(148, 163, 184, 0.18)", backgroundColor: "rgba(15, 23, 42, 0.22)" }}>
                    <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em" }}>
                      NO OPEN POSITIONS
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.06)", pt: 0.8 }}>
                <Typography
                  component="div"
                  sx={{
                    whiteSpace: "nowrap",
                    color: pnlColor,
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    fontFamily: "Outfit, monospace",
                    animation: running ? "roomTicker 10s linear infinite" : "none",
                  }}
                >
                  {` PNL ${unrealizedPnl >= 0 ? "+" : ""}${fmt(unrealizedPnl, 2)} THB  |  OPEN ${fmt(openCount)}/${fmt(maxTrades)}  |  WATCH ${fmt(watchSize)}  |  BUY SIGNALS ${fmt(buys)}  |  `}
                  {` PNL ${unrealizedPnl >= 0 ? "+" : ""}${fmt(unrealizedPnl, 2)} THB  |  OPEN ${fmt(openCount)}/${fmt(maxTrades)}  |  WATCH ${fmt(watchSize)}  |  BUY SIGNALS ${fmt(buys)}  |  `}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: "grid", gap: 1 }}>
            <RoomPanel label="POSITIONS" value={`${fmt(openCount)} / ${fmt(maxTrades)}`} accent="#fbbf24" active={running && openCount >= maxTrades} />
            <RoomPanel label="LIVE PNL" value={`${unrealizedPnl >= 0 ? "+" : ""}${fmt(unrealizedPnl, 2)}`} accent={pnlColor} active={running} />
          </Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1, mt: 1.2 }}>
          {roomDesks.map((desk) => {
            const active = desk.status === "working" || desk.status === "alert";
            const meta = statusMeta[desk.status];
            return (
              <Box
                key={`room-${desk.key}`}
                sx={{
                  position: "relative",
                  minHeight: 92,
                  p: 1,
                  overflow: "hidden",
                  borderRadius: "8px",
                  backgroundColor: active ? `${desk.accent}10` : "rgba(15, 23, 42, 0.56)",
                  border: active ? `1px solid ${desk.accent}30` : "1px solid rgba(255,255,255,0.055)",
                }}
              >
                <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18, backgroundColor: active ? `${desk.accent}22` : "rgba(148, 163, 184, 0.08)" }} />
                <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 0.85 }}>
                  <Box sx={{ flexShrink: 0, filter: active ? `drop-shadow(0 0 8px ${desk.accent}55)` : "grayscale(0.8)", opacity: active ? 1 : 0.58 }}>
                    <AgentAvatar agentKey={desk.key} accent={desk.accent} active={active} size={54} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      <Box sx={{ width: 6, height: 6, backgroundColor: meta.color, boxShadow: active ? `0 0 8px ${meta.color}` : "none", animation: active ? "roomBlink 1.4s steps(2,end) infinite" : "none", flexShrink: 0 }} />
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {desk.name}
                      </Typography>
                    </Box>
                    <Typography sx={{ mt: 0.35, fontSize: "0.66rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {desk.metrics[0]?.label}: {desk.metrics[0]?.value}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function RoomPanel({ label, value, accent, active }: { label: string; value: React.ReactNode; accent: string; active: boolean }) {
  return (
    <Box
      sx={{
        minHeight: 72,
        p: 1,
        borderRadius: "8px",
        border: active ? `1px solid ${accent}33` : "1px solid rgba(255,255,255,0.055)",
        backgroundColor: "rgba(2, 6, 23, 0.58)",
        boxShadow: active ? `inset 0 0 18px ${accent}12` : "none",
      }}
    >
      <Typography sx={{ color: "text.secondary", fontSize: "0.62rem", fontWeight: 900, letterSpacing: "0.11em" }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.8, color: accent, fontSize: "0.98rem", fontWeight: 900, fontFamily: "Outfit, monospace", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </Typography>
    </Box>
  );
}

function fmt(value: number, digits = 0) {
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function isToday(value: string) {
  if (!value) return false;
  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth() && parsed.getDate() === now.getDate();
}

export function BotOfficeAgentCard({
  botConfig,
  positions,
  history,
  aiWatchlist,
  riskLabel,
  riskColor,
  riskBg,
  operationStats,
  handleBotToggle,
  setActiveView,
}: BotOfficeAgentCardProps) {
  const running = botConfig.is_running;

  const stats = useMemo(() => {
    const watchSize = aiWatchlist.length;
    const buys = aiWatchlist.filter((w) => (w.decision || "").toLowerCase() === "buy").length;
    const watching = aiWatchlist.filter((w) => (w.decision || "").toLowerCase() === "watch").length;
    const skips = aiWatchlist.filter((w) => (w.decision || "").toLowerCase() === "skip").length;
    const avgConfidence = watchSize > 0 ? aiWatchlist.reduce((sum, w) => sum + (w.confidence || 0), 0) / watchSize : 0;

    const openCount = positions.length;
    const maxTrades = botConfig.max_open_trades || 3;
    const unrealizedPnl = positions.reduce((sum, p) => sum + (p.pnl_thb || 0), 0);

    const targetMode = botConfig.dry_run ? "Dry-Run" : "LIVE";
    const closedTrades = history.filter((h) => (h.mode === targetMode) && h.pnl_thb !== null && h.pnl_thb !== undefined);
    const wins = closedTrades.filter((h) => (h.pnl_thb as number) > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    const todayTrades = closedTrades.filter((h) => isToday(h.timestamp));
    const todayPnl = todayTrades.reduce((sum, h) => sum + (h.pnl_thb as number), 0);

    const universeMode = botConfig.market_universe_mode === "top_gainers" ? "Top Gainers" : "เหรียญที่กำหนด";
    const universeCount = botConfig.market_universe_mode === "top_gainers"
      ? (botConfig.top_gainers_limit || 0)
      : (botConfig.symbols?.length || 0);
    const radarSource = botConfig.market_universe_mode === "top_gainers"
      ? `Top ${botConfig.top_gainers_limit || universeCount} Gain`
      : "Fix Coin";

    return {
      watchSize, buys, watching, skips, avgConfidence,
      openCount, maxTrades, unrealizedPnl,
      winRate, closedCount: closedTrades.length, todayPnl, todayTradeCount: todayTrades.length,
      universeMode, universeCount, radarSource,
    };
  }, [aiWatchlist, positions, history, botConfig]);

  const providerLabel = botConfig.ai_provider
    ? botConfig.ai_provider.charAt(0).toUpperCase() + botConfig.ai_provider.slice(1)
    : "Gemini";
  const providerLogo = botConfig.ai_provider === "deepseek" ? <DeepSeekLogo size={14} /> : <GeminiLogo size={14} />;

  const desks: AgentDesk[] = [
    {
      key: "scout",
      name: "Market Scout",
      role: "สอดส่องตลาด",
      accent: "#60a5fa",
      icon: <Radar size={14} />,
      status: running ? "working" : "off",
      note: running ? `สแกน ${stats.universeMode}` : "หยุดการสแกน",
      metrics: [
        { label: "เหรียญที่ติดตาม", value: fmt(stats.universeCount) },
        { label: "อยู่ในเรดาร์", value: fmt(stats.watchSize) },
      ],
    },
    {
      key: "analyst",
      name: "AI Analyst",
      role: "นักวิเคราะห์ AI",
      accent: botConfig.ai_provider === "deepseek" ? "#a78bfa" : "#60a5fa",
      icon: <Brain size={14} />,
      status: !botConfig.ai_enabled ? "off" : (stats.buys > 0 ? "working" : "idle"),
      note: botConfig.ai_enabled ? (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          {providerLogo}
          <Box component="span">{providerLabel}</Box>
        </Box>
      ) : "ปิดการใช้ AI",
      metrics: [
        { label: "อนุมัติซื้อ", value: fmt(stats.buys), color: stats.buys > 0 ? "#00c16a" : undefined },
        { label: "เฝ้าดู / ข้าม", value: `${fmt(stats.watching)} / ${fmt(stats.skips)}` },
        { label: "ความมั่นใจเฉลี่ย", value: `${fmt(stats.avgConfidence, 0)}%` },
      ],
    },
    {
      key: "risk",
      name: "Risk Manager",
      role: "ผู้จัดการความเสี่ยง",
      accent: "#fbbf24",
      icon: <ShieldCheck size={14} />,
      status: !running ? "off" : (stats.openCount >= stats.maxTrades ? "alert" : "working"),
      note: stats.openCount >= stats.maxTrades && running ? "ใช้พอร์ตเต็มเพดาน" : "คุมความเสี่ยงตามแผน",
      metrics: [
        { label: "TP / SL", value: `+${botConfig.take_profit_pct}% / ${botConfig.stop_loss_pct}%` },
        { label: "ไม้ที่เปิด", value: `${fmt(stats.openCount)} / ${fmt(stats.maxTrades)}`, color: stats.openCount >= stats.maxTrades ? "#fbbf24" : undefined },
        { label: "Trailing Stop", value: botConfig.trailing_stop_enabled ? "เปิด" : "ปิด", color: botConfig.trailing_stop_enabled ? "#00c16a" : undefined },
      ],
    },
    {
      key: "trader",
      name: "Trader",
      role: "เทรดเดอร์",
      accent: "#00c16a",
      icon: <Briefcase size={14} />,
      status: !running ? "off" : (stats.openCount > 0 ? "working" : "idle"),
      note: stats.openCount > 0 ? `ดูแล ${stats.openCount} ตำแหน่ง` : "รอสัญญาณเข้า",
      metrics: [
        {
          label: "PnL ที่ยังไม่ปิด",
          value: `${stats.unrealizedPnl >= 0 ? "+" : ""}${fmt(stats.unrealizedPnl, 2)}`,
          color: stats.unrealizedPnl > 0 ? "#00c16a" : stats.unrealizedPnl < 0 ? "#ef5b63" : undefined,
        },
        {
          label: "PnL วันนี้",
          value: `${stats.todayPnl >= 0 ? "+" : ""}${fmt(stats.todayPnl, 2)}`,
          color: stats.todayPnl > 0 ? "#00c16a" : stats.todayPnl < 0 ? "#ef5b63" : undefined,
        },
        { label: "Win Rate", value: stats.closedCount > 0 ? `${fmt(stats.winRate, 0)}%` : "—" },
      ],
    },
  ];

  const workingCount = desks.filter((d) => d.status === "working" || d.status === "alert").length;

  return (
    <Card
      sx={{
        border: running ? "1px solid rgba(0, 193, 106, 0.25)" : "1px solid rgba(255, 255, 255, 0.04)",
        boxShadow: running ? "0 4px 20px rgba(0, 193, 106, 0.06)" : "0 4px 20px rgba(0, 0, 0, 0.3)",
        transition: "all 0.3s ease",
        "@keyframes officePulse": {
          "0%, 100%": { opacity: 0.35, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.35)" },
        },
        "@keyframes officeWork": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(250%)" },
        },
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        {/* ── Bot operations header ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(260px, 1.3fr) minmax(0, 3fr) auto" }, gap: 1.25, alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0 }}>
            <Box sx={{ width: 54, height: 46, borderRadius: "12px", display: "grid", placeItems: "center", overflow: "hidden", backgroundColor: running ? "rgba(0, 193, 106, 0.1)" : "rgba(148, 163, 184, 0.08)", border: running ? "1px solid rgba(0, 193, 106, 0.2)" : "1px solid rgba(148, 163, 184, 0.14)", flexShrink: 0 }}>
              <AgentAvatar agentKey="manager" accent="#00c16a" active={running} size={50} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: { xs: "0.96rem", sm: "1.04rem" }, color: "text.primary", fontFamily: "Outfit, sans-serif" }}>
                บอทเทรดอัตโนมัติ
              </Typography>
              <Stack direction="row" spacing={0.65} sx={{ mt: 0.55, alignItems: "center", flexWrap: "wrap", gap: 0.65 }}>
                <Chip size="small" label={running ? "RUNNING" : "STOPPED"} sx={{ height: 20, fontSize: "10px", fontWeight: 800, color: running ? "#00c16a" : "text.secondary", backgroundColor: running ? "rgba(0, 193, 106, 0.1)" : "rgba(255,255,255,0.035)", border: running ? "1px solid rgba(0, 193, 106, 0.2)" : "1px solid rgba(255,255,255,0.06)" }} />
                <Chip size="small" label={botConfig.dry_run ? "DRY-RUN" : "LIVE"} sx={{ height: 20, fontSize: "10px", fontWeight: 800, color: botConfig.dry_run ? "#94a3b8" : "#00c16a", backgroundColor: botConfig.dry_run ? "rgba(148, 163, 184, 0.08)" : "rgba(0, 193, 106, 0.1)", border: botConfig.dry_run ? "1px solid rgba(148, 163, 184, 0.14)" : "1px solid rgba(0, 193, 106, 0.2)" }} />
                <Chip size="small" label={riskLabel} sx={{ height: 20, fontSize: "10px", fontWeight: 700, color: riskColor, backgroundColor: riskBg, border: `1px solid ${riskColor}24` }} />
              </Stack>
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(6, minmax(0, 1fr))" }, gap: 0.75 }}>
            {operationStats.map((item) => (
              <Box key={item.label} sx={{ minHeight: 54, p: 1, borderRadius: "10px", backgroundColor: "rgba(2, 6, 23, 0.36)", border: "1px solid rgba(255, 255, 255, 0.045)", minWidth: 0 }}>
                <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.1 }}>
                  {item.label}
                </Typography>
                <Typography sx={{ mt: 0.55, color: item.color, fontSize: "0.82rem", fontWeight: 700, fontFamily: "Outfit, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: { xs: "space-between", lg: "flex-end" }, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setActiveView && setActiveView("settings")}
              sx={{ height: 38, px: 1.5, fontSize: "0.78rem", fontWeight: 700, borderColor: "rgba(255, 255, 255, 0.08)", color: "text.primary", borderRadius: "10px", textTransform: "none", whiteSpace: "nowrap", "&:hover": { borderColor: "rgba(255, 255, 255, 0.2)", backgroundColor: "rgba(255, 255, 255, 0.03)" } }}
            >
              Settings
            </Button>
            <Switch checked={running} onChange={handleBotToggle} color="primary" />
          </Box>
        </Box>

        {/* ── Office subsection header ── */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, borderTop: "1px solid rgba(255,255,255,0.05)", mt: 2, pt: 2, mb: 1.75 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Activity size={16} style={{ color: running ? "#00c16a" : "#94a3b8" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                สำนักงานเอเจนต์ AI
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.1 }}>
                ทีมเอเจนต์ช่วยกันสแกน วิเคราะห์ คุมเสี่ยง และเทรดให้อัตโนมัติ
              </Typography>
            </Box>
          </Box>
          <Chip
            size="small"
            label={running ? `${workingCount} เอเจนต์กำลังทำงาน` : "สำนักงานปิดทำการ"}
            sx={{ height: 22, fontSize: "10px", fontWeight: 800, color: running ? "#00c16a" : "text.secondary", backgroundColor: running ? "rgba(0, 193, 106, 0.1)" : "rgba(255,255,255,0.035)", border: running ? "1px solid rgba(0, 193, 106, 0.2)" : "1px solid rgba(255,255,255,0.06)" }}
          />
        </Box>

        <BotTradingRoom
          desks={desks}
          positions={positions}
          running={running}
          radarSource={stats.radarSource}
          watchSize={stats.watchSize}
          buys={stats.buys}
          openCount={stats.openCount}
          maxTrades={stats.maxTrades}
          unrealizedPnl={stats.unrealizedPnl}
          avgConfidence={stats.avgConfidence}
        />

        {/* ── Agent desks ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
          {desks.map((desk) => {
            const meta = statusMeta[desk.status];
            const active = desk.status === "working" || desk.status === "alert";
            return (
              <Box
                key={desk.key}
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  p: 1.5,
                  borderRadius: "13px",
                  backgroundColor: "rgba(2, 6, 23, 0.4)",
                  border: active ? `1px solid ${desk.accent}33` : "1px solid rgba(255, 255, 255, 0.045)",
                  transition: "border-color 0.3s ease",
                }}
              >
                {/* Agent summary */}
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 1.25 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
                      <Box sx={{ width: 24, height: 24, borderRadius: "7px", color: active ? desk.accent : "#64748b", backgroundColor: active ? `${desk.accent}18` : "rgba(148, 163, 184, 0.06)", border: active ? `1px solid ${desk.accent}30` : "1px solid rgba(255,255,255,0.055)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        {desk.icon}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "text.primary", fontFamily: "Outfit, sans-serif", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {desk.name}
                        </Typography>
                        <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", lineHeight: 1.2, mt: 0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {desk.role}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.45, flexShrink: 0, px: 0.75, py: 0.35, borderRadius: "999px", color: meta.color, backgroundColor: `${meta.color}12`, border: `1px solid ${meta.color}24` }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: meta.color, ...(active ? { animation: "officePulse 1.8s ease-in-out infinite" } : {}) }} />
                    <Typography sx={{ fontSize: "0.64rem", fontWeight: 800 }}>
                      {meta.label}
                    </Typography>
                  </Box>
                </Box>

                {/* Current task */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mb: 1.25 }}>
                  <Box sx={{ width: 3, alignSelf: "stretch", minHeight: 18, borderRadius: "3px", backgroundColor: active ? desk.accent : "rgba(148, 163, 184, 0.24)", flexShrink: 0 }} />
                  <Typography component="span" sx={{ fontSize: "0.7rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 0.4 }}>
                    · {desk.note}
                  </Typography>
                </Box>

                {/* Metrics */}
                <Stack spacing={0.6}>
                  {desk.metrics.map((m) => (
                    <Box key={m.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.label}
                      </Typography>
                      <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, fontFamily: "Outfit, monospace", color: m.color || "text.primary", flexShrink: 0 }}>
                        {m.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

              </Box>
            );
          })}
        </Box>

        {/* ── Office footer summary ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1, mt: 1.5 }}>
          {[
            { icon: <Eye size={14} />, label: "ในเรดาร์", value: fmt(stats.watchSize), accent: "#60a5fa" },
            { icon: <Zap size={14} />, label: "สัญญาณซื้อ", value: fmt(stats.buys), accent: "#00c16a" },
            { icon: <Coins size={14} />, label: "ไม้ที่เปิด", value: `${fmt(stats.openCount)}/${fmt(stats.maxTrades)}`, accent: "#fbbf24" },
            {
              icon: stats.unrealizedPnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
              label: "PnL รวม",
              value: `${stats.unrealizedPnl >= 0 ? "+" : ""}${fmt(stats.unrealizedPnl, 2)}`,
              accent: stats.unrealizedPnl >= 0 ? "#00c16a" : "#ef5b63",
            },
          ].map((item) => (
            <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.9, p: 1, borderRadius: "10px", backgroundColor: "rgba(2, 6, 23, 0.36)", border: "1px solid rgba(255, 255, 255, 0.045)", minWidth: 0 }}>
              <Box sx={{ color: item.accent, display: "grid", placeItems: "center", flexShrink: 0 }}>{item.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: "text.secondary", fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.label}
                </Typography>
                <Typography sx={{ color: item.accent, fontSize: "0.82rem", fontWeight: 700, fontFamily: "Outfit, monospace", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
