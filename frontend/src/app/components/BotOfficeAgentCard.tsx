import { useMemo } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Switch, Typography } from "@mui/material";
import { Activity, Briefcase, Brain, Coins, Eye, Radar, ShieldCheck, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { AiWatchlistItem, BotConfig, HistoryItem, PositionItem } from "./dashboardTypes";
import { GeminiLogo, DeepSeekLogo } from "./Logos";
import { AgentSprite, type AgentSpriteConfig } from "./AgentSprite";

/**
 * Optional PNG sprite per agent. Leave a slot undefined to keep the built-in
 * pixel-SVG character. To use real art, drop a horizontal-strip sheet into
 * `frontend/public/sprites/` and fill in the config — see AgentSprite.tsx.
 *
 *   trader: { src: "/sprites/trader_idle.png", frames: 4, frameWidth: 32, frameHeight: 32, fps: 6 },
 */
const AGENT_SPRITES: Record<string, AgentSpriteConfig | undefined> = {
  manager: { src: "/sprites/manager_idle.png", frames: 1, frameWidth: 32, frameHeight: 32, fps: 6 },
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
    <svg width={size} height={(size * 16) / 18} viewBox="0 0 18 16" shapeRendering="crispEdges" style={{ display: "block" }}>
      {active && <style>{PIXEL_KEYFRAMES}</style>}
      {/* monitor (screen line flickers) */}
      <g className={active ? "pa-screen" : undefined}>{layerRects(L_MONITOR, palette, "mon")}</g>
      {/* torso */}
      {layerRects(L_BODY, palette, "body")}
      {/* head bobs gently */}
      <g className={active ? "pa-head" : undefined}>{layerRects(L_HEAD, palette, "head")}</g>
      {/* desk in front of the worker */}
      {layerRects(L_DESK, palette, "desk")}
      {layerRects(L_KEYBOARD, palette, "kb")}
      {/* hands typing on the keyboard */}
      <g className={active ? "pa-hl" : undefined}>
        <rect x={4} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        <rect x={5} y={11} width={1} height={1} fill={PIXEL_SKIN} />
      </g>
      <g className={active ? "pa-hr" : undefined}>
        <rect x={8} y={11} width={1} height={1} fill={PIXEL_SKIN} />
        <rect x={9} y={11} width={1} height={1} fill={PIXEL_SKIN} />
      </g>
    </svg>
  );
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

    return {
      watchSize, buys, watching, skips, avgConfidence,
      openCount, maxTrades, unrealizedPnl,
      winRate, closedCount: closedTrades.length, todayPnl, todayTradeCount: todayTrades.length,
      universeMode, universeCount,
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
              {AGENT_SPRITES.manager
                ? <AgentSprite {...AGENT_SPRITES.manager} active={running} />
                : <PixelAgent accent="#00c16a" active={running} size={50} />}
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

        {/* ── Agent desks ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
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
                {/* Worker row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
                  <Box sx={{ position: "relative", flexShrink: 0 }}>
                    <Box sx={{ width: 54, height: 46, borderRadius: "12px", display: "grid", placeItems: "center", overflow: "hidden", backgroundColor: active ? `${desk.accent}1a` : "rgba(148, 163, 184, 0.06)", border: active ? `1px solid ${desk.accent}33` : "1px solid rgba(255,255,255,0.05)" }}>
                      {AGENT_SPRITES[desk.key]
                        ? <AgentSprite {...AGENT_SPRITES[desk.key]!} active={active} />
                        : <PixelAgent accent={desk.accent} active={active} size={50} />}
                    </Box>
                    <Box sx={{ position: "absolute", bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%", backgroundColor: meta.color, border: "2px solid #0b1120", ...(active ? { animation: "officePulse 1.8s ease-in-out infinite" } : {}) }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ color: active ? desk.accent : "#64748b", display: "grid", placeItems: "center", flexShrink: 0 }}>{desk.icon}</Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "text.primary", fontFamily: "Outfit, sans-serif", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {desk.name}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", lineHeight: 1.2, mt: 0.1 }}>
                      {desk.role}
                    </Typography>
                  </Box>
                </Box>

                {/* Status line */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mb: 1.25 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: meta.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: meta.color, flexShrink: 0 }}>
                    {meta.label}
                  </Typography>
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

                {/* Activity bar */}
                <Box sx={{ mt: 1.25, height: 3, borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  {active ? (
                    <Box sx={{ width: "40%", height: "100%", borderRadius: "3px", background: `linear-gradient(90deg, transparent, ${desk.accent}, transparent)`, animation: "officeWork 2.4s linear infinite" }} />
                  ) : null}
                </Box>
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
