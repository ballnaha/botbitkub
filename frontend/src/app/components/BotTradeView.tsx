import { useState, useMemo } from "react";
import { Box, Button, Card, CardContent, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, TablePagination } from "@mui/material";
import { Brain, History, Inbox, TrendingUp } from "lucide-react";
import type { AiWatchlistItem, BotConfig, HistoryItem, PositionItem } from "./dashboardTypes";
import { BotOfficeAgentCard } from "./BotOfficeAgentCard";
import { GeminiLogo, DeepSeekLogo } from "./Logos";

type TradeHistoryRange = "7d" | "30d" | "month" | "year" | "all";

const tradeHistoryRangeOptions: { value: TradeHistoryRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All" },
];

const strategyDisplayNames: Record<string, string> = {
  macd_rsi: "เล่นตามจังหวะกลับตัว (Safe Reversal)",
  multi_indicator: "วิเคราะห์รอบด้าน (Balanced Signal)",
  aggressive_momentum: "เก็งกำไรเร็ว (Fast Breakout)",
  supertrend_ema: "เทรดตามเทรนด์ (Trend Following)",
  bounce_scalper: "เก็บเด้งขาลง (Bounce Scalper)",
};

const aiDecisionNotes = [
  { label: "BUY", color: "#00c16a", description: "AI อนุมัติให้ซื้อ ถ้าคะแนนและความมั่นใจผ่านเกณฑ์บอทจะพยายามเปิดออเดอร์" },
  { label: "WATCH", color: "#fbbf24", description: "AI ให้เฝ้าดู ยังไม่ควรซื้อทันที" },
  { label: "SKIP", color: "#ef5b63", description: "AI ไม่แนะนำให้ซื้อในรอบวิเคราะห์นี้" },
];

const aiStatusNotes = [
  { label: "ACTIVE", color: "#94a3b8", description: "สัญญาณล่าสุดยังอยู่ในรายการเฝ้าดู ยังไม่ได้ถูกใช้เปิดออเดอร์" },
  { label: "USED", color: "#00c16a", description: "สัญญาณนี้ถูกใช้แล้ว บอทนำไปเปิดออเดอร์ซื้อสำเร็จ" },
  { label: "SKIPPED", color: "#ef5b63", description: "สัญญาณถูกข้าม เพราะไม่ผ่านเงื่อนไข เช่น decision/score/confidence หรืองบไม่พอ" },
];

type PnLDataPoint = {
  pnl: number;
  label: string;
  time: string;
  tradeNumber: number;
  timestamp: number;
};

const MAX_EQUITY_RENDER_POINTS = 280;

function parseHistoryDate(value: string) {
  if (!value) return null;

  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const thaiDateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!thaiDateMatch) return null;

  const [, day, month, year, hour = "0", minute = "0", second = "0"] = thaiDateMatch;
  const fallbackDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function getTradeHistoryRangeStart(range: TradeHistoryRange) {
  const now = new Date();

  if (range === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return start;
  }

  if (range === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return start;
  }

  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (range === "year") {
    return new Date(now.getFullYear(), 0, 1);
  }

  return null;
}

function filterHistoryByRange(history: HistoryItem[], range: TradeHistoryRange) {
  const rangeStart = getTradeHistoryRangeStart(range);
  if (!rangeStart) return history;

  return history.filter((item) => {
    const tradeDate = parseHistoryDate(item.timestamp);
    return !tradeDate || tradeDate >= rangeStart;
  });
}

function getHistoryTimeValue(value: string, fallbackIndex: number) {
  const parsed = parseHistoryDate(value);
  return parsed ? parsed.getTime() : fallbackIndex;
}

function formatCompactTHB(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function downsampleEquityPoints(points: PnLDataPoint[], maxPoints = MAX_EQUITY_RENDER_POINTS) {
  if (points.length <= maxPoints) return points;

  const first = points[0];
  const last = points[points.length - 1];
  const middle = points.slice(1, -1);
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = Math.ceil(middle.length / bucketCount);
  const sampled: PnLDataPoint[] = [first];

  for (let start = 0; start < middle.length; start += bucketSize) {
    const bucket = middle.slice(start, start + bucketSize);
    let minPoint = bucket[0];
    let maxPoint = bucket[0];

    bucket.forEach((point) => {
      if (point.pnl < minPoint.pnl) minPoint = point;
      if (point.pnl > maxPoint.pnl) maxPoint = point;
    });

    if (minPoint.tradeNumber < maxPoint.tradeNumber) {
      sampled.push(minPoint, maxPoint);
    } else if (maxPoint.tradeNumber < minPoint.tradeNumber) {
      sampled.push(maxPoint, minPoint);
    } else {
      sampled.push(minPoint);
    }
  }

  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function PnLChart({ history }: { history: HistoryItem[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const closed = useMemo(() => [...history].reverse().filter((h) => h.pnl_thb !== null), [history]);
  const isEmpty = closed.length === 0;

  const dataPoints = useMemo(() => {
    let runningTotal = 0;
    const firstTradeTime = closed.length > 0 ? getHistoryTimeValue(closed[0].timestamp || "", 0) : 0;
    const points: PnLDataPoint[] = [{ pnl: 0, label: "เริ่มต้น", time: "", tradeNumber: 0, timestamp: firstTradeTime }];

    if (closed.length === 0) {
      points.push({ pnl: 0, label: "ไม่มีข้อมูล", time: "", tradeNumber: 1, timestamp: 1 });
      points.push({ pnl: 0, label: "ไม่มีข้อมูล", time: "", tradeNumber: 2, timestamp: 2 });
      return points;
    }

    closed.forEach((t, index) => {
      runningTotal += t.pnl_thb || 0;
      points.push({
        pnl: runningTotal,
        label: `${t.symbol} (${t.pnl_thb && t.pnl_thb > 0 ? "+" : ""}${(t.pnl_percent || 0).toFixed(1)}%)`,
        time: t.timestamp || "",
        tradeNumber: index + 1,
        timestamp: getHistoryTimeValue(t.timestamp || "", index + 1),
      });
    });

    return points;
  }, [closed]);

  const displayPoints = useMemo(() => downsampleEquityPoints(dataPoints), [dataPoints]);
  const cumulative = dataPoints[dataPoints.length - 1]?.pnl || 0;
  const pnls = dataPoints.map((d) => d.pnl);

  // สรุปสถิติเชิงปริมาณ (มาตรฐาน equity curve มืออาชีพ)
  const metrics = useMemo(() => {
    if (isEmpty) {
      return { net: 0, peak: 0, maxDD: 0, ddPeakTs: null as number | null, ddTroughTs: null as number | null, winRate: 0, trades: 0 };
    }
    let curPeakVal = dataPoints[0].pnl;
    let curPeakTs = dataPoints[0].timestamp;
    let peak = dataPoints[0].pnl;
    let maxDD = 0;
    let ddPeakTs: number | null = null;
    let ddTroughTs: number | null = null;
    for (const p of dataPoints) {
      if (p.pnl > curPeakVal) { curPeakVal = p.pnl; curPeakTs = p.timestamp; }
      if (p.pnl > peak) peak = p.pnl;
      const dd = curPeakVal - p.pnl;
      if (dd > maxDD) { maxDD = dd; ddPeakTs = curPeakTs; ddTroughTs = p.timestamp; }
    }
    const wins = closed.filter((c) => (c.pnl_thb || 0) > 0).length;
    return {
      net: dataPoints[dataPoints.length - 1].pnl,
      peak,
      maxDD,
      ddPeakTs,
      ddTroughTs,
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
      trades: closed.length,
    };
  }, [dataPoints, closed, isEmpty]);

  // แท่ง PnL ต่อเทรด (รวมเป็น bucket ถ้ามากเกินไป เพื่อให้แท่งกว้างพอ)
  const bars = useMemo(() => {
    if (isEmpty) return [] as { pnl: number; timestamp: number }[];
    const maxBars = 60;
    const src = closed.map((t, i) => ({ pnl: t.pnl_thb || 0, timestamp: getHistoryTimeValue(t.timestamp || "", i + 1) }));
    if (src.length <= maxBars) return src;
    const bucketSize = Math.ceil(src.length / maxBars);
    const out: { pnl: number; timestamp: number }[] = [];
    for (let s = 0; s < src.length; s += bucketSize) {
      const b = src.slice(s, s + bucketSize);
      out.push({ pnl: b.reduce((a, c) => a + c.pnl, 0), timestamp: b[Math.floor(b.length / 2)].timestamp });
    }
    return out;
  }, [closed, isEmpty]);

  const maxAbsBar = useMemo(() => {
    const m = Math.max(...bars.map((b) => Math.abs(b.pnl)), 0);
    return m === 0 ? 1 : m;
  }, [bars]);

  // ----- เรขาคณิตของกราฟ (minimal) -----
  const width = 680;
  const height = 132;
  const padTop = 8;
  const padBottom = 16;
  const padLeft = 10;
  const padRight = 10;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const chartBottom = padTop + chartHeight;

  const timeValues = dataPoints.map((d) => d.timestamp);
  const minTime = Math.min(...timeValues);
  const maxTime = Math.max(...timeValues);
  const timeRange = maxTime === minTime ? 1 : maxTime - minTime;

  // โดเมนแกน Y รวม 0 เสมอ + เผื่อขอบบน/ล่าง 12%
  const rawMax = Math.max(...pnls, 0);
  const rawMin = Math.min(...pnls, 0);
  const span = rawMax - rawMin || 10;
  const yMax = rawMax + span * 0.12;
  const yMin = rawMin - span * 0.12;
  const valRange = yMax - yMin || 10;

  const xScale = (ts: number) => padLeft + ((ts - minTime) / timeRange) * chartWidth;
  const yScale = (v: number) => padTop + chartHeight - ((v - yMin) / valRange) * chartHeight;

  const points = displayPoints.map((d) => ({
    x: xScale(d.timestamp),
    y: yScale(d.pnl),
    pnl: d.pnl,
    label: d.label,
    time: d.time,
    tradeNumber: d.tradeNumber,
    timestamp: d.timestamp,
  }));

  const zeroY = yScale(0);

  let linePath = "";
  let areaPath = "";
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
    areaPath = linePath + ` L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z`;
  }

  const isNetProfit = cumulative >= 0;
  const strokeColor = isEmpty ? "rgba(255,255,255,0.10)" : (isNetProfit ? "#00c16a" : "#ef5b63");
  const gradientId = "equity-area-gradient";

  const lastPoint = points[points.length - 1];

  const kpis = [
    {
      label: "NET",
      value: `${isNetProfit ? "+" : ""}${formatCompactTHB(metrics.net)} THB`,
      color: isEmpty ? "#94a3b8" : (isNetProfit ? "#00c16a" : "#ef5b63"),
    },
    {
      label: "WIN",
      value: `${metrics.winRate.toFixed(0)}%`,
      color: isEmpty ? "#94a3b8" : (metrics.winRate >= 50 ? "#00c16a" : "#fbbf24"),
    },
  ];

  return (
    <Paper sx={{
      p: 1.5,
      borderRadius: "12px",
      background: "linear-gradient(180deg, rgba(13, 19, 33, 0.55) 0%, rgba(8, 12, 20, 0.4) 100%)",
      border: "1px solid rgba(255, 255, 255, 0.05)",
      mb: 2,
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Header + KPI inline (กระชับในแถวเดียว) */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0 }}>
          <Box sx={{ width: 22, height: 22, borderRadius: "7px", display: "grid", placeItems: "center", color: strokeColor, backgroundColor: `${strokeColor}1a`, border: `1px solid ${strokeColor}33`, flexShrink: 0 }}>
            <TrendingUp size={13} />
          </Box>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "text.primary", fontFamily: "Outfit, sans-serif", whiteSpace: "nowrap" }}>
            กำไรสะสม <Box component="span" sx={{ color: "text.secondary", fontWeight: 600, fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Equity Curve</Box>
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: { xs: 0.75, sm: 1.25 } }}>
          {kpis.map((k) => (
            <Box key={k.label} sx={{ display: "flex", alignItems: "baseline", gap: 0.45 }}>
              <Typography sx={{ color: "text.secondary", fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {k.label}
              </Typography>
              <Typography sx={{ color: k.color, fontSize: "0.82rem", fontWeight: 800, fontFamily: "Outfit, monospace", lineHeight: 1 }}>
                {k.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ width: "100%", aspectRatio: `${width} / ${height}`, overflow: "visible", opacity: isEmpty ? 0.35 : 1 }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={isEmpty ? 0.05 : 0.22} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Zero baseline (จาง) */}
          <line x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke="rgba(255,255,255,0.10)" strokeDasharray="4 5" strokeWidth="1" />

          {/* แท่ง PnL ต่อเทรด (เลเยอร์หลัง โทนจาง) */}
          {!isEmpty && bars.map((b, i) => {
            const isUp = b.pnl >= 0;
            const avail = isUp ? (zeroY - padTop) : (chartBottom - zeroY);
            const bh = Math.min((Math.abs(b.pnl) / maxAbsBar) * (chartHeight * 0.42), Math.max(0, avail));
            const bw = Math.max(2, Math.min(13, (chartWidth / bars.length) * 0.6));
            const bx = xScale(b.timestamp) - bw / 2;
            const by = isUp ? zeroY - bh : zeroY;
            return (
              <rect
                key={`bar-${i}`}
                x={bx}
                y={by}
                width={bw}
                height={Math.max(1, bh)}
                fill={isUp ? "#00c16a" : "#ef5b63"}
                opacity={0.2}
                rx="1"
              />
            );
          })}

          {/* Area + line */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover crosshair */}
          {!isEmpty && hoveredIndex !== null && points[hoveredIndex] && (
            <line
              x1={points[hoveredIndex].x}
              y1={padTop}
              x2={points[hoveredIndex].x}
              y2={chartBottom}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Last-value dot */}
          {!isEmpty && lastPoint && (
            <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={strokeColor} />
          )}

          {/* Hover hit-areas + dot */}
          {!isEmpty && points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g key={`${p.tradeNumber}-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={points.length > 90 ? 9 : 7}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={strokeColor}
                    stroke="#0d1321"
                    strokeWidth="2"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </Box>

      {isEmpty && (
        <Box sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5
        }}>
          <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", fontWeight: 500 }}>
            ยังไม่มีประวัติการเทรดในช่วงที่เลือก
          </Typography>
        </Box>
      )}

      {!isEmpty && hoveredIndex !== null && points[hoveredIndex] && (
        <Paper sx={{
          position: "absolute",
          bottom: "16px",
          left: points[hoveredIndex].x > width / 2 ? "16px" : "auto",
          right: points[hoveredIndex].x <= width / 2 ? "16px" : "auto",
          p: 1.5,
          borderRadius: "11px",
          backgroundColor: "rgba(9, 15, 30, 0.92)",
          backdropFilter: "blur(6px)",
          border: `1px solid ${points[hoveredIndex].pnl >= 0 ? "rgba(0, 193, 106, 0.3)" : "rgba(239, 91, 99, 0.3)"}`,
          boxShadow: "0 6px 24px rgba(0, 0, 0, 0.5)",
          zIndex: 10,
          pointerEvents: "none"
        }}>
          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 500 }}>
            {points[hoveredIndex].tradeNumber === 0 ? "จุดเริ่มต้น" : `ไม้ที่ ${points[hoveredIndex].tradeNumber}: ${points[hoveredIndex].label}`}
          </Typography>
          {points[hoveredIndex].time && (
            <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", fontFamily: "monospace", mt: 0.2 }}>
              วันที่: {points[hoveredIndex].time}
            </Typography>
          )}
          <Typography sx={{
            fontSize: "0.88rem",
            fontWeight: 700,
            color: points[hoveredIndex].pnl >= 0 ? "primary.main" : "error.main",
            fontFamily: "monospace",
            mt: 0.2
          }}>
            กำไรสะสม: {points[hoveredIndex].pnl >= 0 ? "+" : ""}{points[hoveredIndex].pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
          </Typography>
        </Paper>
      )}
    </Paper>
  );
}
interface BotTradeViewProps {
  botConfig: BotConfig;
  positions: PositionItem[];
  history: HistoryItem[];
  aiWatchlist: AiWatchlistItem[];
  handleBotToggle: () => void;
  handleOpenConfirmPanic: (symbol: string) => void;
  setActiveView?: (view: "settings") => void;
  dataLoading?: boolean;
}

export function BotTradeView({ botConfig, positions, history, aiWatchlist, handleBotToggle, handleOpenConfirmPanic, setActiveView, dataLoading = false }: BotTradeViewProps) {
  const [tradeHistoryRange, setTradeHistoryRange] = useState<TradeHistoryRange>("30d");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Strategy Risk Level Logic
  const sl = Math.abs(botConfig.stop_loss_pct || 5);
  const tp = Math.abs(botConfig.take_profit_pct || 10);
  const maxTrades = botConfig.max_open_trades || 3;
  const riskScore = sl * 0.4 + tp * 0.3 + maxTrades * 1.5;

  let riskLabel = "เสี่ยงต่ำ (Low Risk)";
  let riskColor = "#00c16a"; // Emerald
  let riskBg = "rgba(0, 193, 106, 0.08)";

  if (riskScore > 12) {
    riskLabel = "เสี่ยงสูงมาก (High Speculative)";
    riskColor = "#ef5b63"; // Rose
    riskBg = "rgba(239, 91, 99, 0.08)";
  } else if (riskScore > 6) {
    riskLabel = "เสี่ยงปานกลาง (Balanced Risk)";
    riskColor = "#fbbf24"; // Amber
    riskBg = "rgba(251, 191, 36, 0.08)";
  }

  const modeFilteredHistory = useMemo(() => {
    const targetMode = botConfig.dry_run ? "Dry-Run" : "LIVE";
    return history.filter((h) => h.mode === targetMode);
  }, [history, botConfig.dry_run]);

  const filteredHistory = filterHistoryByRange(modeFilteredHistory, tradeHistoryRange);
  const selectedTradeHistoryRange = tradeHistoryRangeOptions.find((option) => option.value === tradeHistoryRange);

  const paginatedHistory = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredHistory.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredHistory, page, rowsPerPage]);

  const strategyDisplayName = strategyDisplayNames[botConfig.strategy] || botConfig.strategy?.replace(/_/g, " ") || "multi indicator";
  const operationStats = [
    { label: "Strategy", value: strategyDisplayName, color: "text.primary" },
    {
      label: "AI Review",
      value: botConfig.ai_enabled ? (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, verticalAlign: "middle" }}>
          {botConfig.ai_provider === "deepseek" ? <DeepSeekLogo size={14} /> : <GeminiLogo size={14} />}
          <Box component="span" sx={{ ml: 0.5 }}>
            {botConfig.ai_provider ? botConfig.ai_provider.charAt(0).toUpperCase() + botConfig.ai_provider.slice(1) : "Gemini"}
          </Box>
        </Box>
      ) : "Off",
      color: botConfig.ai_enabled ? (botConfig.ai_provider === "deepseek" ? "#a78bfa" : "#60a5fa") : "text.secondary"
    },
    { label: "Stake", value: `${botConfig.stake_amount_thb} THB`, color: "text.primary" },
    { label: "Max Trades", value: `${positions.length} / ${maxTrades}`, color: positions.length >= maxTrades ? "#fbbf24" : "text.primary" },
    { label: "TP / SL", value: `+${botConfig.take_profit_pct}% / ${botConfig.stop_loss_pct}%`, color: "text.primary" },
    { label: "Budget", value: `${botConfig.max_budget_thb ?? 5000} THB`, color: "text.primary" },
  ];

  return (
    <Stack spacing={1.25} sx={{ width: "100%", minWidth: 0 }}>
      <BotOfficeAgentCard
        botConfig={botConfig}
        positions={positions}
        history={history}
        aiWatchlist={aiWatchlist}
        riskLabel={riskLabel}
        riskColor={riskColor}
        riskBg={riskBg}
        operationStats={operationStats}
        handleBotToggle={handleBotToggle}
        setActiveView={setActiveView}
      />

      {/* Operations Data */}
      <Stack spacing={1.25} sx={{ minWidth: 0 }}>
        {/* Active Positions Table Card */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                ตำแหน่งถือครองของบอทเทรด (Active Positions)
              </Typography>
              <TrendingUp size={18} style={{ color: "#3b82f6" }} />
            </Box>

            {dataLoading ? (
              <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                <CircularProgress size={28} thickness={4} />
                <Typography sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
                  กำลังโหลดตำแหน่งถือครองของบอท...
                </Typography>
              </Box>
            ) : positions.length === 0 ? (
              <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <Inbox size={36} style={{ color: "rgba(255,255,255,0.15)" }} />
                <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                  ไม่มีตำแหน่งเหรียญที่ถือครองอยู่ขณะนี้
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 0 }}>คู่เหรียญ</TableCell>
                      <TableCell align="center">ประเภท</TableCell>
                      <TableCell align="right">จำนวนเหรียญ</TableCell>
                      <TableCell align="right">ราคาซื้อ (ทุนรวม)</TableCell>
                      <TableCell align="right" sx={{ minWidth: 132 }}>เป้าหมายออกออเดอร์</TableCell>
                      <TableCell align="right">กำไร / ขาดทุน (PnL)</TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>เวลาที่ซื้อ</TableCell>
                      <TableCell align="center" sx={{ pr: 0 }}>จัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {positions.map((pos) => {
                      const isProfit = pos.pnl_thb > 0;
                      const pnlColor = isProfit ? "primary.main" : (pos.pnl_thb < 0 ? "error.main" : "text.secondary");

                      const slPct = botConfig.stop_loss_pct || -5;
                      const tpPct = botConfig.take_profit_pct || 10;
                      const buyPrice = pos.buy_price;
                      const currentPrice = pos.current_price;

                      const slPrice = buyPrice * (1 + slPct / 100);
                      const tpPrice = buyPrice * (1 + tpPct / 100);

                      return (
                        <TableRow key={pos.symbol}>
                          <TableCell sx={{ pl: 0, fontWeight: 600, fontSize: "0.88rem" }}>{pos.symbol}</TableCell>
                          <TableCell align="center">
                            <Chip size="small" label={`${(pos.trade_direction || "long").toUpperCase()}`} variant="outlined" sx={{ fontSize: "9px", height: "19px", borderColor: "rgba(16,185,129,0.3)", color: "primary.main", fontWeight: 500 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.85rem", color: "text.primary", fontWeight: 600 }}>
                            {pos.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                          </TableCell>
                          <TableCell align="right">
                            <Typography sx={{ fontFamily: "monospace", fontSize: "0.85rem", color: "text.secondary", fontWeight: 600 }}>
                              {pos.buy_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Typography>
                            <Typography sx={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontFamily: "monospace", mt: 0.35 }}>
                              {(pos.amount * pos.buy_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                            </Typography>
                          </TableCell>

                          <TableCell align="right" sx={{ py: 1.2 }}>
                            <Box sx={{ display: "grid", gap: 0.45, minWidth: 122 }}>
                              {[
                                { label: "SL", value: slPrice, color: "#ff7a82" },
                                { label: "Now", value: currentPrice, color: isProfit ? "#00c16a" : "#f4f7f4" },
                                { label: "TP", value: tpPrice, color: "#1fe385" },
                              ].map((target) => (
                                <Box
                                  key={target.label}
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: "34px 1fr",
                                    alignItems: "baseline",
                                    gap: 0.75,
                                    lineHeight: 1.15,
                                  }}
                                >
                                  <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: target.color, fontFamily: "monospace" }}>
                                    {target.label}
                                  </Typography>
                                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: target.color, fontFamily: "monospace", textAlign: "right" }}>
                                    {target.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </TableCell>

                          <TableCell align="right" sx={{ color: pnlColor, fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem" }}>
                            {isProfit ? "+" : ""}{pos.pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB ({isProfit ? "+" : ""}{pos.pnl_pct.toFixed(2)}%)
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: "text.secondary", display: { xs: "none", md: "table-cell" } }}>
                            {pos.buy_time}
                          </TableCell>
                          <TableCell align="center" sx={{ pr: 0 }}>
                            <Button
                              onClick={() => handleOpenConfirmPanic(pos.symbol)}
                              variant="outlined"
                              size="small"
                              sx={{
                                fontSize: "10px",
                                fontWeight: 600,
                                py: 0.6,
                                px: 1.5,
                                borderRadius: "9px",
                                borderColor: "rgba(239, 91, 99, 0.3)",
                                backgroundColor: "rgba(239, 91, 99, 0.04)",
                                color: "#ff7a82",
                                "&:hover": {
                                  backgroundColor: "error.main",
                                  color: "white",
                                  borderColor: "error.main",
                                  boxShadow: "0 0 11px rgba(239, 91, 99, 0.45)"
                                }
                              }}
                            >
                              Panic Sell
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                  AI Watchlist
                </Typography>
                <Typography sx={{ color: "text.secondary", fontSize: "0.76rem", mt: 0.35 }}>
                  สัญญาณที่ AI วิเคราะห์ไว้ก่อนตัดสินใจซื้อ
                </Typography>
              </Box>
              <Brain size={18} style={{ color: "#60a5fa" }} />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1, mb: 2 }}>
              {[
                { title: "ผล AI (Decision)", items: aiDecisionNotes },
                { title: "สถานะรายการ (Status)", items: aiStatusNotes },
              ].map((group) => (
                <Paper
                  key={group.title}
                  sx={{
                    p: 1.2,
                    borderRadius: "10px",
                    backgroundColor: "rgba(2, 6, 23, 0.28)",
                    border: "1px solid rgba(255,255,255,0.045)",
                  }}
                >
                  <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                    {group.title}
                  </Typography>
                  <Stack spacing={0.65}>
                    {group.items.map((item) => (
                      <Box key={item.label} sx={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 1, alignItems: "baseline" }}>
                        <Chip
                          size="small"
                          label={item.label}
                          sx={{
                            height: 18,
                            fontSize: "9px",
                            fontWeight: 800,
                            color: item.color,
                            backgroundColor: `${item.color}12`,
                            border: `1px solid ${item.color}33`,
                          }}
                        />
                        <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", lineHeight: 1.35 }}>
                          {item.description}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Box>

            {!botConfig.ai_enabled ? (
              <Box sx={{ py: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <Brain size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
                <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                  AI Signal Review ยังไม่ได้เปิดใช้งาน
                </Typography>
              </Box>
            ) : dataLoading ? (
              <Box sx={{ py: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
                <CircularProgress size={24} thickness={4} />
                <Typography sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
                  กำลังโหลด AI watchlist...
                </Typography>
              </Box>
            ) : aiWatchlist.length === 0 ? (
              <Box sx={{ py: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <Inbox size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
                <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                  ยังไม่มีสัญญาณที่ AI วิเคราะห์ไว้
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 0 }}>คู่เหรียญ</TableCell>
                      <TableCell align="center">ผล AI</TableCell>
                      <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" } }}>สถานะ</TableCell>
                      <TableCell align="right">คะแนน</TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>ราคา</TableCell>
                      <TableCell sx={{ pr: 0 }}>เหตุผล</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {aiWatchlist.slice(0, 8).map((item) => {
                      const decision = (item.decision || "watch").toLowerCase();
                      const decisionColor = decision === "buy" ? "#00c16a" : decision === "skip" ? "#ef5b63" : "#fbbf24";
                      return (
                        <TableRow key={item.id}>
                          <TableCell sx={{ pl: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.84rem" }}>{item.symbol}</Typography>
                            <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontFamily: "monospace" }}>
                              {item.created_at}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={decision.toUpperCase()}
                              sx={{
                                height: 20,
                                fontSize: "9px",
                                fontWeight: 700,
                                color: decisionColor,
                                backgroundColor: `${decisionColor}12`,
                                border: `1px solid ${decisionColor}33`,
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                            <Chip
                              size="small"
                              label={(item.status || "active").toUpperCase()}
                              sx={{
                                height: 19,
                                fontSize: "9px",
                                fontWeight: 700,
                                color: item.status === "used" ? "#00c16a" : item.status === "skipped" ? "#ef5b63" : "text.secondary",
                                backgroundColor: "rgba(255,255,255,0.025)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 700, color: "text.primary" }}>
                            {item.score}
                            <Typography component="span" sx={{ color: "text.secondary", fontSize: "0.7rem", ml: 0.35 }}>
                              /100
                            </Typography>
                            <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", lineHeight: 1.2 }}>
                              {(item.confidence * 100).toFixed(0)}%
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" }, fontFamily: "monospace", color: "text.secondary", fontSize: "0.8rem" }}>
                            {item.last_price ? item.last_price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                          </TableCell>
                          <TableCell sx={{ pr: 0, maxWidth: 320 }}>
                            <Typography title={item.reason} sx={{ color: "text.secondary", fontSize: "0.75rem", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>
                              {item.reason || "-"}
                            </Typography>
                            {item.replace_candidate && (
                              <Typography sx={{ color: "#60a5fa", fontSize: "0.68rem", mt: 0.25 }}>
                                replace: {item.replace_candidate}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* Trade History Card */}
      <Card sx={{ gridColumn: "1 / -1", width: "100%" }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, gap: 1.5, flexDirection: { xs: "column", md: "row" }, borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 3 }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
              ประวัติการทำรายการเสร็จสิ้น (Trade History)
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: { xs: "space-between", md: "flex-end" } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(5, minmax(0, 1fr))", sm: "repeat(5, auto)" }, gap: 0.5, p: 0.4, borderRadius: "10px", backgroundColor: "rgba(255, 255, 255, 0.025)", border: "1px solid rgba(255, 255, 255, 0.05)", width: { xs: "100%", sm: "auto" } }}>
                {tradeHistoryRangeOptions.map((option) => {
                  const isActive = option.value === tradeHistoryRange;
                  return (
                    <Button
                      key={option.value}
                      onClick={() => {
                        setTradeHistoryRange(option.value);
                        setPage(0);
                      }}
                      sx={{
                        minWidth: { xs: 0, sm: 72 },
                        height: 30,
                        px: { xs: 0.5, sm: 1 },
                        borderRadius: "8px",
                        fontSize: { xs: "0.72rem", sm: "0.76rem" },
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#102018" : "text.secondary",
                        backgroundColor: isActive ? "primary.main" : "transparent",
                        "&:hover": {
                          backgroundColor: isActive ? "primary.main" : "rgba(255, 255, 255, 0.04)",
                          color: isActive ? "#102018" : "text.primary",
                        },
                      }}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </Box>
              <History size={18} style={{ color: "#00c16a", flexShrink: 0 }} />
            </Box>
          </Box>

          {/* Performance Analytics Header Panel */}
          {filteredHistory.length > 0 && (() => {
            const closedTrades = filteredHistory.filter((h) => h.pnl_thb !== null);
            const totalClosed = closedTrades.length;
            const winningTrades = closedTrades.filter((h) => (h.pnl_thb || 0) > 0).length;
            const winRate = totalClosed > 0 ? Math.round((winningTrades / totalClosed) * 100) : 0;
            const netPnL = closedTrades.reduce((sum, h) => sum + (h.pnl_thb || 0), 0);

            return (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1, mb: 2.5 }}>
                <Paper sx={{ p: 2, borderRadius: "14px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.04)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    อัตราการชนะ (Win Rate)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600, mt: 0.5, color: winRate >= 50 ? "primary.main" : "error.main", fontFamily: "monospace" }}>
                    {winRate}% <span style={{ fontSize: "0.85rem", opacity: 0.5, fontWeight: 500, marginLeft: "4px" }}>(W/L: {winningTrades}/{totalClosed})</span>
                  </Typography>
                  <Typography sx={{ fontSize: "10px", color: "text.secondary", mt: 0.5 }}>
                    ชนะ {winningTrades} จากทั้งหมด {totalClosed} ไม้ที่ปิดแล้ว
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, borderRadius: "14px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.04)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    กำไรรวมสุทธิ (Net PnL)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600, mt: 0.5, color: netPnL >= 0 ? "primary.main" : "error.main", fontFamily: "monospace" }}>
                    {netPnL >= 0 ? "+" : ""}{netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                  </Typography>
                  <Typography sx={{ fontSize: "10px", color: "text.secondary", mt: 0.5 }}>
                    ผลตอบแทนรวมสะสมจากการปิดออเดอร์
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, borderRadius: "14px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.04)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    รายการปิดแล้ว (Closed Trades)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600, mt: 0.5, color: "secondary.main", fontFamily: "monospace" }}>
                    {totalClosed} ไม้
                  </Typography>
                  <Typography sx={{ fontSize: "10px", color: "text.secondary", mt: 0.5 }}>
                    ประวัติการซื้อ-ขายครบวงรอบสแกน
                  </Typography>
                </Paper>
              </Box>
            );
          })()}

          <PnLChart history={filteredHistory} />

          {dataLoading ? (
            <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <CircularProgress size={28} thickness={4} />
              <Typography sx={{ color: "text.secondary", fontSize: "0.82rem" }}>
                กำลังโหลดประวัติการทำรายการ...
              </Typography>
            </Box>
          ) : filteredHistory.length === 0 ? (
            <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
              <Inbox size={36} style={{ color: "rgba(255,255,255,0.15)" }} />
              <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                ไม่มีประวัติการเทรดในช่วง {selectedTradeHistoryRange?.label || ""}
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
                  แสดง {filteredHistory.length.toLocaleString()} รายการ จากทั้งหมด {history.length.toLocaleString()} รายการ
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>
                  ช่วง: {selectedTradeHistoryRange?.label || "All"}
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small" sx={{ "& .MuiTableCell-root": { py: 0.6, px: 1, borderBottom: "1px solid rgba(255,255,255,0.03)" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ pl: 0, minWidth: 100 }}>วัน-เวลา</TableCell>
                      <TableCell>คู่เหรียญ</TableCell>
                      <TableCell align="right">จำนวน (มูลค่าขาย)</TableCell>
                      <TableCell align="right">ราคาซื้อ / ขาย (ทุนรวม)</TableCell>
                      <TableCell align="right">กำไร/ขาดทุน</TableCell>
                      <TableCell sx={{ pr: 0, display: { xs: "none", md: "table-cell" }, minWidth: 150 }}>สาเหตุการขาย</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedHistory.map((item, index) => {
                      const pnlColor = item.pnl_thb !== null
                        ? (item.pnl_thb > 0 ? "primary.main" : "error.main")
                        : "text.secondary";

                      return (
                        <TableRow key={index} sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.015)" } }}>
                          {/* 1. วัน-เวลา */}
                          <TableCell sx={{ pl: 0, fontFamily: "monospace", fontSize: "0.76rem", color: "text.secondary" }}>
                            {item.timestamp}
                          </TableCell>
                          
                          {/* 2. คู่เหรียญ */}
                          <TableCell sx={{ py: 0.6 }}>
                            <Box sx={{ display: "flex", flexDirection: "column" }}>
                              <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "text.primary" }}>
                                {item.symbol}
                              </Typography>
                              <Typography sx={{ fontSize: "0.65rem", color: "error.main", fontWeight: 600, letterSpacing: "0.02em" }}>
                                CLOSED (SELL)
                              </Typography>
                            </Box>
                          </TableCell>
                          
                          {/* 3. จำนวน (มูลค่าขาย) */}
                          <TableCell align="right">
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <Typography sx={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 600, color: "text.primary" }}>
                                {item.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                              </Typography>
                              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontFamily: "monospace" }}>
                                {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
                              </Typography>
                            </Box>
                          </TableCell>
                          
                          {/* 4. ราคาซื้อ / ขาย (ทุนรวม) */}
                          <TableCell align="right">
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              {item.buy_price !== undefined ? (
                                <>
                                  <Typography sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: "text.secondary" }}>
                                    ซื้อ: {item.buy_price.toLocaleString(undefined, { minimumFractionDigits: 2 })} 
                                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>
                                      ({(item.amount * item.buy_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB)
                                    </span>
                                  </Typography>
                                </>
                              ) : (
                                <Typography sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: "text.secondary" }}>ซื้อ: -</Typography>
                              )}
                              <Typography sx={{ fontFamily: "monospace", fontSize: "0.82rem", color: "text.primary", fontWeight: 600, mt: 0.25 }}>
                                ขาย: {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          </TableCell>
                          
                          {/* 5. กำไร/ขาดทุน */}
                          <TableCell align="right">
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <Typography sx={{ color: pnlColor, fontWeight: 700, fontFamily: "monospace", fontSize: "0.82rem" }}>
                                {item.pnl_thb !== null ? `${item.pnl_thb > 0 ? "+" : ""}${item.pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB` : "-"}
                              </Typography>
                              <Typography sx={{ color: pnlColor, fontFamily: "monospace", fontSize: "0.68rem", fontWeight: 600 }}>
                                {item.pnl_percent !== null ? `${item.pnl_percent > 0 ? "+" : ""}${Number(item.pnl_percent).toFixed(2)}%` : ""}
                              </Typography>
                            </Box>
                          </TableCell>
                          
                          {/* 6. สาเหตุการขาย */}
                          <TableCell sx={{ pr: 0, fontSize: "0.74rem", color: "text.secondary", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: { xs: "none", md: "table-cell" } }} title={item.reason}>
                            {item.reason}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={filteredHistory.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(0);
                }}
                sx={{
                  color: "text.secondary",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  "& .MuiTablePagination-selectIcon": {
                    color: "text.secondary",
                  },
                  "& .MuiIconButton-root": {
                    color: "text.secondary",
                  },
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
