import { useState } from "react";
import { Box, Button, Card, CardContent, Chip, IconButton, InputAdornment, MenuItem, Paper, Select, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { Bot, History, Inbox, Minus, Plus, TrendingUp } from "lucide-react";
import type { BotConfig, HistoryItem, PositionItem } from "./dashboardTypes";

interface NumberStepperProps {
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
  suffix?: string;
}

function NumberStepper({ value, step, min, onChange, suffix }: NumberStepperProps) {
  const updateValue = (nextValue: number) => {
    const clampedValue = min === undefined ? nextValue : Math.max(min, nextValue);
    const precision = step < 1 ? 2 : 0;
    onChange(Number(clampedValue.toFixed(precision)));
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "36px 1fr 36px", alignItems: "stretch", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden", backgroundColor: "rgba(2, 6, 23, 0.45)" }}>
      <IconButton
        type="button"
        size="small"
        onClick={() => updateValue(value - step)}
        sx={{ borderRadius: 0, color: "text.secondary" }}
      >
        <Minus size={15} />
      </IconButton>
      <TextField
        type="number"
        value={value}
        onChange={(e) => updateValue(Number(e.target.value || 0))}
        variant="standard"
        slotProps={{
          input: {
            disableUnderline: true,
            endAdornment: suffix ? (
              <InputAdornment position="end">
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "text.secondary" }}>{suffix}</Typography>
              </InputAdornment>
            ) : undefined,
            inputProps: {
              step,
              min,
              style: { textAlign: "center", fontFamily: "monospace", fontWeight: 800, padding: "8px 4px" }
            }
          }
        }}
        sx={{ justifyContent: "center", "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 }, "& input[type=number]": { MozAppearance: "textfield" } }}
      />
      <IconButton
        type="button"
        size="small"
        onClick={() => updateValue(value + step)}
        sx={{ borderRadius: 0, color: "text.secondary" }}
      >
        <Plus size={15} />
      </IconButton>
    </Box>
  );
}

function PnLChart({ history }: { history: HistoryItem[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const closed = [...history].reverse().filter((h) => h.pnl_thb !== null);
  const isEmpty = closed.length === 0;

  // Calculate cumulative points starting at 0
  let cumulative = 0;
  const dataPoints = [{ pnl: 0, label: "เริ่มต้น", time: "" }];
  
  if (isEmpty) {
    // Generate dummy flat points for visual structure
    dataPoints.push({ pnl: 0, label: "ไม่มีข้อมูล", time: "" });
    dataPoints.push({ pnl: 0, label: "ไม่มีข้อมูล", time: "" });
  } else {
    closed.forEach((t) => {
      cumulative += t.pnl_thb || 0;
      dataPoints.push({
        pnl: cumulative,
        label: `${t.symbol} (${t.pnl_thb && t.pnl_thb > 0 ? "+" : ""}${(t.pnl_percent || 0).toFixed(1)}%)`,
        time: t.timestamp || ""
      });
    });
  }

  const pnls = dataPoints.map((d) => d.pnl);
  const maxVal = Math.max(...pnls);
  const minVal = Math.min(...pnls);
  const valRange = maxVal === minVal ? 10 : maxVal - minVal;

  const width = 600;
  const height = 150;
  const paddingX = 40;
  const paddingY = 20;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = dataPoints.map((d, i) => {
    const x = paddingX + (i / (dataPoints.length - 1)) * chartWidth;
    const y = paddingY + chartHeight - ((d.pnl - minVal) / valRange) * chartHeight;
    return { x, y, pnl: d.pnl, label: d.label, time: d.time };
  });

  // Zero-line Y coordinate
  const zeroY = paddingY + chartHeight - ((0 - minVal) / valRange) * chartHeight;
  const hasZeroLine = zeroY >= paddingY && zeroY <= (paddingY + chartHeight);

  // SVG Path strings
  let linePath = "";
  let areaPath = "";
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    areaPath = linePath + ` L ${points[points.length - 1].x} ${paddingY + chartHeight} L ${points[0].x} ${paddingY + chartHeight} Z`;
  }

  const isNetProfit = cumulative >= 0;
  const strokeColor = isEmpty ? "rgba(255,255,255,0.08)" : (isNetProfit ? "#10b981" : "#f43f5e");
  const gradientId = "pnl-area-gradient";

  return (
    <Paper sx={{
      p: 2,
      borderRadius: "14px",
      backgroundColor: "rgba(8, 12, 20, 0.4)",
      border: "1px solid rgba(255, 255, 255, 0.04)",
      mb: 3,
      position: "relative",
      overflow: "hidden"
    }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5 }}>
        กราฟการเติบโตของกำไรสะสม (Equity Curve)
      </Typography>

      <Box sx={{ width: "100%", height: 160, overflow: "visible", opacity: isEmpty ? 0.3 : 1 }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={isEmpty ? 0.05 : 0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1={paddingX} y1={paddingY + chartHeight / 2} x2={width - paddingX} y2={paddingY + chartHeight / 2} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          <line x1={paddingX} y1={paddingY + chartHeight} x2={width - paddingX} y2={paddingY + chartHeight} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

          {/* Zero profit baseline */}
          {hasZeroLine && (
            <line
              x1={paddingX}
              y1={zeroY}
              x2={width - paddingX}
              y2={zeroY}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
          )}

          {/* Area under the line */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {/* Main line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive dots */}
          {!isEmpty && points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? strokeColor : "#0d1321"}
                  stroke={strokeColor}
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>
      </Box>

      {/* Empty State Overlay */}
      {isEmpty && (
        <Box sx={{
          position: "absolute",
          top: "40px",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5
        }}>
          <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 700 }}>
            📉 ยังไม่มีประวัติการเทรด กราฟจะวาดอัตโนมัติหลังปิดไม้แรกสำเร็จ
          </Typography>
        </Box>
      )}

      {/* Tooltip Overlay */}
      {!isEmpty && hoveredIndex !== null && points[hoveredIndex] && (
        <Paper sx={{
          position: "absolute",
          top: "45px",
          left: points[hoveredIndex].x > width / 2 ? "16px" : "auto",
          right: points[hoveredIndex].x <= width / 2 ? "16px" : "auto",
          p: 1.5,
          borderRadius: "10px",
          backgroundColor: "rgba(9, 15, 30, 0.9)",
          border: `1px solid ${points[hoveredIndex].pnl >= 0 ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          zIndex: 10,
          pointerEvents: "none"
        }}>
          <Typography sx={{ fontSize: "0.62rem", color: "text.secondary", fontWeight: 700 }}>
            {hoveredIndex === 0 ? "จุดเริ่มต้น" : `ไม้ที่ ${hoveredIndex}: ${points[hoveredIndex].label}`}
          </Typography>
          <Typography sx={{
            fontSize: "0.78rem",
            fontWeight: 800,
            color: points[hoveredIndex].pnl >= 0 ? "primary.main" : "error.main",
            fontFamily: "monospace",
            mt: 0.2
          }}>
            กำไรสะสม: {points[hoveredIndex].pnl >= 0 ? "+" : ""}{points[hoveredIndex].pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
          </Typography>
          {points[hoveredIndex].time && (
            <Typography sx={{ fontSize: "0.58rem", color: "text.secondary", mt: 0.5 }}>
              {points[hoveredIndex].time}
            </Typography>
          )}
        </Paper>
      )}
    </Paper>
  );
}

interface BotTradeViewProps {
  botConfig: BotConfig;
  positions: PositionItem[];
  history: HistoryItem[];
  handleBotToggle: () => void;
  handleSaveBotSettings: () => void;
  handleOpenConfirmPanic: (symbol: string) => void;
  updateBotConfigDraft: (patch: Partial<BotConfig>) => void;
}

export function BotTradeView({ botConfig, positions, history, handleBotToggle, handleSaveBotSettings, handleOpenConfirmPanic, updateBotConfigDraft }: BotTradeViewProps) {
  // Strategy Risk Level Logic
  const sl = Math.abs(botConfig.stop_loss_pct || 5);
  const tp = Math.abs(botConfig.take_profit_pct || 10);
  const maxTrades = botConfig.max_open_trades || 3;
  const riskScore = sl * 0.4 + tp * 0.3 + maxTrades * 1.5;

  let riskLabel = "เสี่ยงต่ำ (Low Risk)";
  let riskColor = "#10b981"; // Emerald
  let riskBg = "rgba(16, 185, 129, 0.08)";
  let riskDescription = "กลยุทธ์จำกัดความเสียหายได้ดี เหมาะสำหรับการเทรดปลอดภัยในระยะยาว";

  if (riskScore > 12) {
    riskLabel = "เสี่ยงสูงมาก (High Speculative)";
    riskColor = "#f43f5e"; // Rose
    riskBg = "rgba(244, 63, 94, 0.08)";
    riskDescription = "คำเตือน: กลยุทธ์เก็งกำไรสูงมาก";
  } else if (riskScore > 6) {
    riskLabel = "เสี่ยงปานกลาง (Balanced Risk)";
    riskColor = "#fbbf24"; // Amber
    riskBg = "rgba(251, 191, 36, 0.08)";
    riskDescription = "กลยุทธ์แบบสมดุล มุ่งเน้นการเติบโตอย่างมั่นคงในสภาวะตลาดปกติ";
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3.8fr 8.2fr" }, gap: 2.5, alignItems: "start" }}>
      {/* Auto Bot Settings Form */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Bot size={18} style={{ color: "#10b981" }} />
              <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                บอทเทรดอัตโนมัติ (Auto Bot Settings)
              </Typography>
              <Chip
                label={`โควตาไม้: ${positions.length} / ${maxTrades}`}
                size="small"
                sx={{
                  fontSize: "9px",
                  fontWeight: 800,
                  backgroundColor: positions.length > 0 ? "rgba(59, 130, 246, 0.08)" : "rgba(255, 255, 255, 0.03)",
                  color: positions.length > 0 ? "#60a5fa" : "text.secondary",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  height: "18px"
                }}
              />
            </Stack>
            <Switch
              checked={botConfig.is_running}
              onChange={handleBotToggle}
              color="primary"
            />
          </Box>

          <Stack spacing={3}>
            {/* Dry Run / Live Switch Segmented Buttons */}
            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                โหมดทดสอบสัญญาณ (Dry-Run Mode)
              </Typography>
              <Box sx={{
                display: "flex",
                backgroundColor: "rgba(8, 12, 20, 0.72)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                p: 0.5,
                gap: 0.5,
                width: "100%"
              }}>
                <Button
                  onClick={() => updateBotConfigDraft({ dry_run: true })}
                  sx={{
                    flex: 1,
                    py: 1,
                    fontSize: "0.72rem",
                    fontWeight: botConfig.dry_run ? 800 : 500,
                    borderRadius: "8px",
                    backgroundColor: botConfig.dry_run ? "rgba(16, 185, 129, 0.12)" : "transparent",
                    color: botConfig.dry_run ? "primary.main" : "text.secondary",
                    border: botConfig.dry_run ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid transparent",
                    "&:hover": {
                      backgroundColor: botConfig.dry_run ? "rgba(16, 185, 129, 0.18)" : "rgba(255,255,255,0.03)",
                    }
                  }}
                >
                  Dry-Run (ระบบจำลอง)
                </Button>
                <Button
                  onClick={() => updateBotConfigDraft({ dry_run: false })}
                  sx={{
                    flex: 1,
                    py: 1,
                    fontSize: "0.72rem",
                    fontWeight: !botConfig.dry_run ? 800 : 500,
                    borderRadius: "8px",
                    backgroundColor: !botConfig.dry_run ? "rgba(244, 63, 94, 0.12)" : "transparent",
                    color: !botConfig.dry_run ? "#fb7185" : "text.secondary",
                    border: !botConfig.dry_run ? "1px solid rgba(244, 63, 94, 0.2)" : "1px solid transparent",
                    "&:hover": {
                      backgroundColor: !botConfig.dry_run ? "rgba(244, 63, 94, 0.18)" : "rgba(255,255,255,0.03)",
                    }
                  }}
                >
                  LIVE Trade (เทรดจริง)
                </Button>
              </Box>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 2
              }}
            >
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  Max Open Trades
                </Typography>
                <NumberStepper
                  value={botConfig.max_open_trades}
                  step={1}
                  min={1}
                  onChange={(value) => updateBotConfigDraft({ max_open_trades: Math.max(1, Math.round(value)) })}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  เงินทุน/ไม้ (THB)
                </Typography>
                <NumberStepper
                  value={botConfig.stake_amount_thb}
                  step={10}
                  min={0}
                  suffix="THB"
                  onChange={(value) => updateBotConfigDraft({ stake_amount_thb: value })}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  Stop Loss (%)
                </Typography>
                <NumberStepper
                  value={botConfig.stop_loss_pct}
                  step={1}
                  suffix="%"
                  onChange={(value) => updateBotConfigDraft({ stop_loss_pct: value })}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  Take Profit (%)
                </Typography>
                <NumberStepper
                  value={botConfig.take_profit_pct}
                  step={1}
                  min={0.1}
                  suffix="%"
                  onChange={(value) => updateBotConfigDraft({ take_profit_pct: value })}
                />
              </Box>
            </Box>

            {/* Dynamic Risk Level Evaluation UI Panel */}
            <Paper sx={{
              p: 2,
              borderRadius: "14px",
              backgroundColor: "rgba(255, 255, 255, 0.01)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              display: "flex",
              flexDirection: "column",
              gap: 1
            }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  ประเมินระดับความเสี่ยงกลยุทธ์
                </Typography>
                <Chip
                  label={riskLabel}
                  size="small"
                  sx={{
                    backgroundColor: riskBg,
                    color: riskColor,
                    border: `1px solid ${riskColor}30`,
                    fontSize: "10px",
                    fontWeight: 850,
                    height: "20px"
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", lineHeight: 1.4 }}>
                {riskDescription}
              </Typography>
            </Paper>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Chip size="small" label="LONG ONLY" color="success" variant="outlined" sx={{ fontWeight: 800, fontSize: "9px" }} />
              <Chip size="small" label="SPOT MARKET" variant="outlined" sx={{ fontWeight: 800, fontSize: "9px", borderColor: "rgba(255,255,255,0.12)" }} />
              <Chip size="small" label="LEVERAGE 1x" variant="outlined" sx={{ fontWeight: 800, fontSize: "9px", borderColor: "rgba(255,255,255,0.12)" }} />
              <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", ml: 0.5 }}>
                บอททำงานบนตลาด Bitkub Spot เทรดทิศทางขาขึ้นเท่านั้น
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="contained"
              onClick={handleSaveBotSettings}
              sx={{
                py: 1.5,
                fontSize: "0.75rem",
                fontWeight: 800,
                background: "linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #059669 100%)",
                color: "#080b11",
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)",
                "&:hover": {
                  background: "linear-gradient(90deg, #34d399 0%, #2dd4bf 50%, #059669 100%)",
                  boxShadow: "0 6px 20px rgba(16, 185, 129, 0.25)",
                }
              }}
            >
              บันทึกการตั้งค่าบอท
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Right Column: Positions & History */}
      <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0 }}>
        {/* Active Positions Table Card */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
              ตำแหน่งถือครองของบอทเทรด (Active Positions)
            </Typography>
            <TrendingUp size={18} style={{ color: "#3b82f6" }} />
          </Box>

          {positions.length === 0 ? (
            <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
              <Inbox size={36} style={{ color: "rgba(255,255,255,0.15)" }} />
              <Typography sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
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
                    <TableCell align="right">ราคาซื้อเข้า</TableCell>
                    <TableCell align="center" sx={{ minWidth: 220 }}>เป้าหมายออกออเดอร์ (Exit Targets)</TableCell>
                    <TableCell align="right">กำไร / ขาดทุน (PnL)</TableCell>
                    <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>เวลาที่ซื้อ</TableCell>
                    <TableCell align="center" sx={{ pr: 0 }}>จัดการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positions.map((pos) => {
                    const isProfit = pos.pnl_thb > 0;
                    const pnlColor = isProfit ? "primary.main" : (pos.pnl_thb < 0 ? "error.main" : "text.secondary");

                    // Progress bar calculations
                    const slPct = botConfig.stop_loss_pct || -5;
                    const tpPct = botConfig.take_profit_pct || 10;
                    const buyPrice = pos.buy_price;
                    const currentPrice = pos.current_price;

                    const slPrice = buyPrice * (1 + slPct / 100);
                    const tpPrice = buyPrice * (1 + tpPct / 100);

                    let progressPercent = 50;
                    if (tpPrice > slPrice) {
                      progressPercent = ((currentPrice - slPrice) / (tpPrice - slPrice)) * 100;
                      progressPercent = Math.max(0, Math.min(100, progressPercent)); // clamp
                    }

                    const entryPercent = ((buyPrice - slPrice) / (tpPrice - slPrice)) * 100;

                    return (
                      <TableRow key={pos.symbol}>
                        <TableCell sx={{ pl: 0, fontWeight: 800, fontSize: "0.78rem" }}>{pos.symbol}</TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={`${(pos.trade_direction || "long").toUpperCase()}`} variant="outlined" sx={{ fontSize: "8px", height: "18px", borderColor: "rgba(16,185,129,0.3)", color: "primary.main", fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.primary", fontWeight: 600 }}>
                          {pos.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                          {pos.buy_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        {/* Visual Exit targets bar */}
                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 200 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 800, color: "text.secondary", fontFamily: "monospace" }}>
                              <span style={{ color: "#fb7185" }}>SL: {slPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <span style={{ color: "#94a3b8" }}>Entry</span>
                              <span style={{ color: "#34d399" }}>TP: {tpPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </Box>

                            <Box sx={{ position: "relative", height: "5px", width: "100%", borderRadius: "2.5px", backgroundColor: "rgba(255, 255, 255, 0.08)", overflow: "visible", mt: 0.5 }}>
                              {/* Red Zone */}
                              <Box sx={{
                                position: "absolute",
                                left: 0,
                                width: `${entryPercent}%`,
                                height: "100%",
                                borderTopLeftRadius: "2.5px",
                                borderBottomLeftRadius: "2.5px",
                                background: "linear-gradient(90deg, rgba(244, 63, 94, 0.2) 0%, rgba(244, 63, 94, 0.05) 100%)"
                              }} />
                              {/* Green Zone */}
                              <Box sx={{
                                position: "absolute",
                                left: `${entryPercent}%`,
                                width: `${100 - entryPercent}%`,
                                height: "100%",
                                borderTopRightRadius: "2.5px",
                                borderBottomRightRadius: "2.5px",
                                background: "linear-gradient(90deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.2) 100%)"
                              }} />
                              {/* Entry line marker */}
                              <Box sx={{
                                position: "absolute",
                                left: `${entryPercent}%`,
                                top: "-2.5px",
                                width: "1.5px",
                                height: "10px",
                                backgroundColor: "rgba(255, 255, 255, 0.4)",
                                zIndex: 2
                              }} />
                              {/* Current Price Dot */}
                              <Box sx={{
                                position: "absolute",
                                left: `${progressPercent}%`,
                                top: "-4.5px",
                                transform: "translateX(-50%)",
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                backgroundColor: isProfit ? "#10b981" : "#f43f5e",
                                border: "2.5px solid #0d1321",
                                boxShadow: isProfit ? "0 0 10px rgba(16, 185, 129, 0.6)" : "0 0 10px rgba(244, 63, 94, 0.6)",
                                transition: "left 0.3s ease",
                                zIndex: 3
                              }} />
                            </Box>
                            <Box sx={{ display: "flex", height: 12, position: "relative" }}>
                              <Typography sx={{
                                position: "absolute",
                                left: `${progressPercent}%`,
                                transform: "translateX(-50%)",
                                fontSize: "8px",
                                fontWeight: 800,
                                fontFamily: "monospace",
                                color: isProfit ? "primary.main" : "error.main",
                                mt: 0.2
                              }}>
                                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell align="right" sx={{ color: pnlColor, fontWeight: 800, fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {isProfit ? "+" : ""}{pos.pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB ({isProfit ? "+" : ""}{pos.pnl_pct.toFixed(2)}%)
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.7rem", color: "text.secondary", display: { xs: "none", md: "table-cell" } }}>
                          {pos.buy_time}
                        </TableCell>
                        <TableCell align="center" sx={{ pr: 0 }}>
                          <Button
                            onClick={() => handleOpenConfirmPanic(pos.symbol)}
                            variant="outlined"
                            size="small"
                            sx={{
                              fontSize: "9px",
                              fontWeight: 800,
                              py: 0.6,
                              px: 1.5,
                              borderRadius: "8px",
                              borderColor: "rgba(244, 63, 94, 0.3)",
                              backgroundColor: "rgba(244, 63, 94, 0.04)",
                              color: "#fb7185",
                              "&:hover": {
                                backgroundColor: "error.main",
                                color: "white",
                                borderColor: "error.main",
                                boxShadow: "0 0 10px rgba(244, 63, 94, 0.45)"
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

      {/* Trade History Card */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
              ประวัติการทำรายการเสร็จสิ้น (Trade History)
            </Typography>
            <History size={18} style={{ color: "#10b981" }} />
          </Box>

          {/* Performance Analytics Header Panel */}
          {history.length > 0 && (() => {
            const closedTrades = history.filter((h) => h.pnl_thb !== null);
            const totalClosed = closedTrades.length;
            const winningTrades = closedTrades.filter((h) => (h.pnl_thb || 0) > 0).length;
            const winRate = totalClosed > 0 ? Math.round((winningTrades / totalClosed) * 100) : 0;
            const netPnL = closedTrades.reduce((sum, h) => sum + (h.pnl_thb || 0), 0);

            return (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 2.5 }}>
                <Paper sx={{ p: 2, borderRadius: "14px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.04)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    อัตราการชนะ (Win Rate)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: winRate >= 50 ? "primary.main" : "error.main", fontFamily: "monospace" }}>
                    {winRate}% <span style={{ fontSize: "0.75rem", opacity: 0.5, fontWeight: 500, marginLeft: "4px" }}>(W/L: {winningTrades}/{totalClosed})</span>
                  </Typography>
                  <Typography sx={{ fontSize: "9px", color: "text.secondary", mt: 0.5 }}>
                    ชนะ {winningTrades} จากทั้งหมด {totalClosed} ไม้ที่ปิดแล้ว
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, borderRadius: "14px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.04)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    กำไรรวมสุทธิ (Net PnL)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: netPnL >= 0 ? "primary.main" : "error.main", fontFamily: "monospace" }}>
                    {netPnL >= 0 ? "+" : ""}{netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                  </Typography>
                  <Typography sx={{ fontSize: "9px", color: "text.secondary", mt: 0.5 }}>
                    ผลตอบแทนรวมสะสมจากการปิดออเดอร์
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, borderRadius: "14px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.04)", textAlign: "center" }}>
                  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    รายการปิดแล้ว (Closed Trades)
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "secondary.main", fontFamily: "monospace" }}>
                    {totalClosed} ไม้
                  </Typography>
                  <Typography sx={{ fontSize: "9px", color: "text.secondary", mt: 0.5 }}>
                    ประวัติการซื้อ-ขายครบวงรอบสแกน
                  </Typography>
                </Paper>
              </Box>
            );
          })()}

          <PnLChart history={history} />

          {history.length === 0 ? (
            <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
              <Inbox size={36} style={{ color: "rgba(255,255,255,0.15)" }} />
              <Typography sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                ไม่มีประวัติการเทรดของบอทขณะนี้
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pl: 0 }}>วัน-เวลา</TableCell>
                    <TableCell>คู่เหรียญ</TableCell>
                    <TableCell align="center">ธุรกรรม</TableCell>
                    <TableCell align="right">จำนวน</TableCell>
                    <TableCell align="right">ราคาซื้อเข้า</TableCell>
                    <TableCell align="right">ราคาขายออก</TableCell>
                    <TableCell align="right">มูลค่ารวม THB</TableCell>
                    <TableCell align="right">กำไร/ขาดทุน</TableCell>
                    <TableCell sx={{ pr: 0, display: { xs: "none", md: "table-cell" } }}>สาเหตุการขาย</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((item, index) => {
                    const isBuy = item.side.toUpperCase() === "BUY";
                    const pnlText = item.pnl_thb !== null
                      ? `${item.pnl_thb > 0 ? "+" : ""}${item.pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB (${item.pnl_thb > 0 ? "+" : ""}${Number(item.pnl_percent).toFixed(2)}%)`
                      : "-";
                    const pnlColor = item.pnl_thb !== null
                      ? (item.pnl_thb > 0 ? "primary.main" : "error.main")
                      : "text.secondary";
                    const pnlWeight = item.pnl_thb !== null ? 800 : 500;

                    return (
                      <TableRow key={index}>
                        <TableCell sx={{ pl: 0, fontFamily: "monospace", fontSize: "0.7rem", color: "text.secondary" }}>
                          {item.timestamp}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>{item.symbol}</TableCell>
                        <TableCell align="center">
                          {isBuy ? (
                            <Chip size="small" label="BUY" variant="outlined" color="success" sx={{ fontSize: "8px", height: "18px", fontWeight: 800 }} />
                          ) : (
                            <Chip size="small" label="SELL" variant="outlined" color="error" sx={{ fontSize: "8px", height: "18px", fontWeight: 800 }} />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {item.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                          {item.buy_price !== undefined ? item.buy_price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ color: pnlColor, fontWeight: pnlWeight, fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {pnlText}
                        </TableCell>
                        <TableCell sx={{ pr: 0, fontSize: "10px", color: "text.secondary", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: { xs: "none", md: "table-cell" } }} title={item.reason}>
                          {item.reason}
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
    </Box>
  );
}
