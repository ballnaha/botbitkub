"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  CircularProgress,
  IconButton,
  Button,
  Chip,
  Paper,
  Divider,
  Tooltip,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
} from "lucide-react";

interface AssetInfo {
  currency: string;
  available: number;
  reserved: number;
  total: number;
  bot_amount?: number;
  free_for_manual?: number;
  value_thb: number;
  bot_value_thb?: number;
  current_price: number;
  avg_entry_price: number | null;
  pnl_percent: number;
  pnl_thb: number;
}

interface WalletSummary {
  dry_run: boolean;
  total_balance_thb: number;
  total_invested_thb: number;
  overall_pnl_thb: number;
  overall_pnl_percent: number;
  assets: AssetInfo[];
}

interface WalletViewProps {
  dashboardInvestedThb?: number;
  dashboardTotalThb?: number;
  setActiveView?: (view: any) => void;
}

// Color scheme map for various cryptos
const CURRENCY_COLORS: Record<string, string> = {
  THB: "#475569", // Slate
  KUB: "#00c16a", // Bitkub Green
  BTC: "#f59e0b", // Gold/Orange
  ETH: "#6366f1", // Indigo
  USDT: "#10b981", // Emerald
  XRP: "#0ea5e9", // Sky
  ADA: "#2563eb", // Blue
  DOGE: "#ca8a04", // Yellow
};

const getCurrencyColor = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (CURRENCY_COLORS[upper]) return CURRENCY_COLORS[upper];

  // Hash function for dynamic color generation if coin is not in map
  let hash = 0;
  for (let i = 0; i < upper.length; i++) {
    hash = upper.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
};

export function WalletView({ dashboardInvestedThb, dashboardTotalThb, setActiveView }: WalletViewProps) {
  const [data, setData] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hideSmall, setHideSmall] = useState(true);
  const [assetPage, setAssetPage] = useState(0);
  const [assetRowsPerPage, setAssetRowsPerPage] = useState(10);
  const [showBalances, setShowBalances] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wallet_show_balances");
      return saved !== "false";
    }
    return true;
  });

  const toggleShowBalances = () => {
    setShowBalances((prev) => {
      const next = !prev;
      localStorage.setItem("wallet_show_balances", String(next));
      return next;
    });
  };

  const fetchWalletSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/bot/wallet-summary");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP error ${res.status}`);
      }
      const summary: WalletSummary = await res.json();

      // Sort assets so that THB is always first, then others by value desc
      if (summary.assets) {
        summary.assets.sort((a, b) => {
          if (a.currency === "THB") return -1;
          if (b.currency === "THB") return 1;
          return b.value_thb - a.value_thb;
        });
      }

      setData(summary);
    } catch (err: any) {
      console.error("Failed to load wallet summary:", err);
      setError(err.message || "Failed to load wallet data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletSummary();

    // Auto refresh every 20 seconds
    const timer = setInterval(() => {
      fetchWalletSummary(true);
    }, 20000);

    return () => clearInterval(timer);
  }, [fetchWalletSummary]);

  if (loading) {
    return (
      <Box sx={{ py: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <CircularProgress size={40} thickness={4} sx={{ color: "primary.main" }} />
        <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
          กำลังโหลดกระเป๋าเงินของคุณ...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Card sx={{ border: "1px solid rgba(239, 91, 99, 0.15)", backgroundColor: "rgba(239, 91, 99, 0.03)", m: 2 }}>
        <CardContent sx={{ py: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Typography sx={{ color: "#ef5b63", fontWeight: 600 }}>เกิดข้อผิดพลาดในการโหลดกระเป๋าเงิน</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", textAlign: "center", maxWidth: 400 }}>
            {error}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshCw size={14} />}
            onClick={() => fetchWalletSummary()}
            sx={{ mt: 1, borderColor: "rgba(255,255,255,0.15)", color: "text.primary" }}
          >
            ลองอีกครั้ง
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const {
    dry_run,
    total_balance_thb,
    total_invested_thb,
    overall_pnl_thb,
    overall_pnl_percent,
    assets,
  } = data;

  const displayTotalBalanceThb = typeof dashboardTotalThb === "number" ? dashboardTotalThb : total_balance_thb;
  const displayInvestedThb = typeof dashboardInvestedThb === "number" ? dashboardInvestedThb : total_invested_thb;



  // Filter out microscopic assets for allocation bar
  const allocationAssets = assets.filter(a => {
    if (a.value_thb <= 0) return false;
    if (hideSmall && a.currency !== "THB") {
      return a.value_thb >= 1.0;
    }
    return true;
  });
  const totalAllocated = allocationAssets.reduce((sum, a) => sum + a.value_thb, 0);

  const filteredAssets = assets.filter(a => {
    if (hideSmall && a.currency !== "THB") {
      return a.value_thb >= 1.0;
    }
    return true;
  });
  const assetPageCount = Math.max(1, Math.ceil(filteredAssets.length / assetRowsPerPage));
  const safeAssetPage = Math.min(assetPage, assetPageCount - 1);
  const paginatedAssets = filteredAssets.slice(
    safeAssetPage * assetRowsPerPage,
    safeAssetPage * assetRowsPerPage + assetRowsPerPage
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto", mt: { xs: 1, sm: 1.5 }, display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 } }}>

      {/* Header bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: { xs: 1.5, sm: 0 } }}>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 1, color: "text.primary" }}>
            <Wallet size={20} style={{ color: "#00c16a" }} />
            กระเป๋าเงินของฉัน
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.35 }}>
            {dry_run ? "บัญชีจำลอง (Dry-Run Mode)" : "บัญชีจริง Bitkub (LIVE Mode)"}
          </Typography>
        </Box>
        <IconButton
          onClick={() => fetchWalletSummary(true)}
          disabled={refreshing}
          sx={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "text.primary"
          }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </IconButton>
      </Box>

      {/* Balance Summary Header Area */}
      <Card
        sx={{
          background: "linear-gradient(135deg, rgba(8, 12, 20, 0.82) 0%, rgba(0, 193, 106, 0.03) 50%, rgba(8, 12, 20, 0.9) 100%)",
          border: "1px solid rgba(0, 193, 106, 0.16)",
          borderRadius: "20px",
          boxShadow: "0 10px 30px 0 rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(20px)",
          overflow: "hidden"
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ 
            display: "grid", 
            gridTemplateColumns: { xs: "1fr", md: "1.2fr 1fr" }, 
            gap: 3, 
            alignItems: "center" 
          }}>
            {/* Left side: Main Balance */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  มูลค่าสินทรัพย์สุทธิ (Net Asset Value)
                </Typography>
                <Tooltip title={showBalances ? "ซ่อนยอดเงิน" : "แสดงยอดเงิน"}>
                  <IconButton onClick={toggleShowBalances} size="small" sx={{ color: "text.secondary", p: 0.5 }}>
                    {showBalances ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 1 }}>
                <Typography
                  sx={{
                    fontSize: { xs: "2rem", sm: "2.45rem", md: "2.65rem" },
                    fontWeight: 800,
                    fontFamily: "monospace",
                    color: "text.primary",
                    lineHeight: 1.05,
                    textShadow: "0 0 18px rgba(255, 255, 255, 0.18)"
                  }}
                >
                  {showBalances 
                    ? displayTotalBalanceThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "••••••••"
                  }
                </Typography>
                <Typography component="span" sx={{ fontSize: { xs: "0.78rem", sm: "0.88rem" }, color: "text.secondary", fontWeight: 600 }}>
                  THB โดยประมาณ
                </Typography>
              </Box>
              
              {/* PnL and Mode badges directly below balance */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
                <Chip
                  label={dry_run ? "DRY-RUN SIMULATION" : "LIVE ACCOUNT"}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: "9px",
                    color: dry_run ? "#e2e8f0" : "#00c16a",
                    backgroundColor: dry_run ? "rgba(255,255,255,0.06)" : "rgba(0, 193, 106, 0.08)",
                    border: `1px solid ${dry_run ? "rgba(255,255,255,0.12)" : "rgba(0, 193, 106, 0.18)"}`,
                    height: 20,
                    px: 0.5
                  }}
                />
                
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ color: "text.secondary", fontSize: "0.72rem" }}>กำไรสะสม:</Typography>
                  <Typography 
                    sx={{ 
                      color: overall_pnl_thb >= 0 ? "#00c16a" : "#ef5b63", 
                      fontSize: "0.78rem", 
                      fontWeight: 700, 
                      display: "flex", 
                      alignItems: "center",
                      gap: 0.25 
                    }}
                  >
                    {overall_pnl_thb >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {showBalances 
                      ? `${overall_pnl_thb >= 0 ? "+" : ""}${overall_pnl_percent.toFixed(2)}% (${overall_pnl_thb >= 0 ? "+" : ""}${overall_pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB)`
                      : "•••••"
                    }
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Right side: Invested vs Cash breakdown */}
            <Box>
              <Box sx={{ 
                backgroundColor: "rgba(255, 255, 255, 0.015)", 
                border: "1px solid rgba(255, 255, 255, 0.04)", 
                borderRadius: "14px", 
                p: 2,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 2
              }}>
                {/* Cash balance box */}
                <Box sx={{ borderRight: "1px solid rgba(255,255,255,0.06)", pr: 2 }}>
                  <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", textTransform: "uppercase", fontWeight: 600 }}>
                    เงินสดพร้อมใช้งาน (Cash)
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 0.5 }}>
                    <Typography sx={{ fontSize: { xs: "1.42rem", sm: "1.32rem" }, fontWeight: 700, fontFamily: "monospace", color: "text.primary", textShadow: "0 0 12px rgba(255, 255, 255, 0.15)" }}>
                      {showBalances
                        ? (assets.find(a => a.currency === "THB")?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "••••••"
                      }
                    </Typography>
                    <Typography component="span" sx={{ fontSize: "0.78rem", color: "text.secondary", fontWeight: 500 }}>
                      THB
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", mt: 0.25 }}>
                    สัดส่วน: {(((assets.find(a => a.currency === "THB")?.total || 0) / (displayTotalBalanceThb || 1)) * 100).toFixed(1)}%
                  </Typography>
                </Box>

                {/* Invested balance box */}
                <Box sx={{ pl: 1 }}>
                  <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", textTransform: "uppercase", fontWeight: 600 }}>
                    เงินที่ลงทุนอยู่ (Invested)
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 0.5 }}>
                    <Typography sx={{ fontSize: { xs: "1.42rem", sm: "1.32rem" }, fontWeight: 700, fontFamily: "monospace", color: "text.primary", textShadow: "0 0 12px rgba(255, 255, 255, 0.15)" }}>
                      {showBalances
                        ? displayInvestedThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "••••••"
                      }
                    </Typography>
                    <Typography component="span" sx={{ fontSize: "0.78rem", color: "text.secondary", fontWeight: 500 }}>
                      THB
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", mt: 0.25 }}>
                    สัดส่วน: {((displayInvestedThb / (displayTotalBalanceThb || 1)) * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Asset Allocation Horizontal Bar */}
      {totalAllocated > 0 && (
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.84rem", mb: 2, color: "text.primary" }}>
              สัดส่วนการกระจายความเสี่ยงสินทรัพย์ (Asset Allocation)
            </Typography>

            {/* The multi-colored progress bar */}
            <Box
              sx={{
                height: 20,
                width: "100%",
                borderRadius: "10px",
                overflow: "hidden",
                display: "flex",
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                mb: 2.5
              }}
            >
              {allocationAssets.map((asset) => {
                const percentage = (asset.value_thb / totalAllocated) * 100;
                return (
                  <Tooltip
                    key={asset.currency}
                    title={`${asset.currency}: ${percentage.toFixed(1)}% (฿${asset.value_thb.toLocaleString(undefined, { maximumFractionDigits: 0 })})`}
                    arrow
                  >
                    <Box
                      sx={{
                        width: `${percentage}%`,
                        height: "100%",
                        backgroundColor: getCurrencyColor(asset.currency),
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        "&:hover": {
                          opacity: 0.85,
                          transform: "scaleY(1.1)",
                        }
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>

            {/* Allocation Badges */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5 }}>
              {allocationAssets.map((asset) => {
                const percentage = (asset.value_thb / totalAllocated) * 100;
                const color = getCurrencyColor(asset.currency);
                return (
                  <Box key={asset.currency} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color }} />
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>{asset.currency}</Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                      {percentage.toFixed(1)}%
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Asset Table / Cards List */}
      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 1.5, mb: 1, gap: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: "text.primary" }}>
                รายการสินทรัพย์ทั้งหมด (Assets List)
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.25 }}>
                ถือครองทั้งหมด {filteredAssets.length} สกุลเงิน
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={hideSmall}
                  onChange={(e) => {
                    setHideSmall(e.target.checked);
                    setAssetPage(0);
                  }}
                  size="small"
                  sx={{
                    color: "rgba(255,255,255,0.2)",
                    p: 0.5,
                    "&.Mui-checked": {
                      color: "primary.main",
                    },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", userSelect: "none" }}>
                  ซ่อน &lt; 1 บาท
                </Typography>
              }
            />
          </Box>

          {/* DESKTOP VIEW: Clean Table */}
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <TableContainer>
              <Table size="small" sx={{ "& .MuiTableCell-root": { py: 0.6, px: 1, borderBottom: "1px solid rgba(255,255,255,0.03)" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pl: 0, fontWeight: 600 }}>สินทรัพย์</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>จำนวนทั้งหมด</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>ราคาปัจจุบัน</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>มูลค่าปัจจุบัน (THB)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>ทุนเฉลี่ย (THB)</TableCell>
                    <TableCell align="right" sx={{ pr: 0, fontWeight: 600 }}>PnL บอท</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedAssets.map((asset) => {
                    const hasPosition = asset.avg_entry_price !== null && asset.currency !== "THB";
                    const isAssetProfit = asset.pnl_thb >= 0;
                    const assetPnlColor = isAssetProfit ? "#00c16a" : "#ef5b63";
                    const botAmount = asset.bot_amount ?? 0;
                    const freeForManual = asset.free_for_manual ?? asset.available;
                    const botValueThb = asset.bot_value_thb ?? 0;
                    const showSplit = asset.currency !== "THB" && (botAmount > 0 || freeForManual > 0);

                    return (
                      <TableRow key={asset.currency} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                        <TableCell sx={{ pl: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                              {asset.currency}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 600 }}>
                            {showBalances ? asset.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : "••••••"}
                          </Typography>
                          {showBalances && showSplit && (
                            <Box sx={{ mt: 0.25, display: "flex", flexDirection: "column", gap: 0.1 }}>
                              {botAmount > 0 && (
                                <Typography sx={{ fontFamily: "monospace", fontSize: "0.66rem", color: "#00c16a", lineHeight: 1.2 }}>
                                  บอท: {botAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                </Typography>
                              )}
                              {freeForManual > 0 && (
                                <Typography sx={{ fontFamily: "monospace", fontSize: "0.66rem", color: "text.secondary", lineHeight: 1.2 }}>
                                  พร้อมใช้: {freeForManual.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.82rem", color: "text.secondary" }}>
                          {asset.currency === "THB" ? "1.00" : (showBalances ? asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "••••••")}
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 600 }}>
                            ฿{showBalances ? asset.value_thb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "••••••"}
                          </Typography>
                          {showBalances && botValueThb > 0 && (
                            <Typography sx={{ fontFamily: "monospace", fontSize: "0.66rem", color: "#00c16a", lineHeight: 1.2 }}>
                              บอท: ฿{botValueThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.82rem", color: "text.secondary" }}>
                          {hasPosition ? (showBalances ? `฿${asset.avg_entry_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "••••••") : "-"}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 0 }}>
                          {hasPosition ? (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <Typography sx={{ color: assetPnlColor, fontWeight: 700, fontSize: "0.82rem" }}>
                                {isAssetProfit ? "+" : ""}{asset.pnl_percent.toFixed(2)}%
                              </Typography>
                              <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", fontFamily: "monospace" }}>
                                {showBalances ? `${isAssetProfit ? "+" : ""}${asset.pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB` : "••••••"}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography sx={{ color: "text.secondary", fontSize: "0.8rem" }}>-</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* MOBILE VIEW: Card Stack (No horizontal scrolling) */}
          <Box sx={{ display: { xs: "flex", sm: "none" }, flexDirection: "column", gap: 1 }}>
            {paginatedAssets.map((asset) => {
              const hasPosition = asset.avg_entry_price !== null && asset.currency !== "THB";
              const isAssetProfit = asset.pnl_thb >= 0;
              const assetPnlColor = isAssetProfit ? "#00c16a" : "#ef5b63";
              const botAmount = asset.bot_amount ?? 0;
              const freeForManual = asset.free_for_manual ?? asset.available;
              const botValueThb = asset.bot_value_thb ?? 0;
              const showSplit = asset.currency !== "THB" && (botAmount > 0 || freeForManual > 0);

              return (
                <Paper
                  key={asset.currency}
                  elevation={0}
                  sx={{
                    p: 1.25,
                    borderRadius: "12px",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1
                  }}
                >
                  {/* Top line: Icon, Symbol, and current PnL badge */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>
                        {asset.currency}
                      </Typography>
                    </Box>

                    {hasPosition ? (
                      <Chip
                        label={`${isAssetProfit ? "+" : ""}${asset.pnl_percent.toFixed(2)}%`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "10px",
                          fontWeight: 700,
                          color: assetPnlColor,
                          backgroundColor: `${assetPnlColor}10`,
                          border: `1px solid ${assetPnlColor}26`,
                        }}
                      />
                    ) : (
                      <Chip
                        label="HOLD"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "text.secondary",
                          backgroundColor: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      />
                    )}
                  </Box>

                  {/* Middle Section: Balances */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <Box>
                      <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", textTransform: "uppercase" }}>
                        จำนวนเหรียญที่ถือ
                      </Typography>
                      <Typography sx={{ fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 600, mt: 0.35 }}>
                        {showBalances ? asset.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "••••••"}
                      </Typography>
                      {showBalances && showSplit && (
                        <Box sx={{ mt: 0.35, display: "grid", gap: 0.15 }}>
                          {botAmount > 0 && (
                            <Typography sx={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#00c16a" }}>
                              บอทดูแล: {botAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                            </Typography>
                          )}
                          {freeForManual > 0 && (
                            <Typography sx={{ fontFamily: "monospace", fontSize: "0.68rem", color: "text.secondary" }}>
                              พร้อมใช้: {freeForManual.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={{ color: "text.secondary", fontSize: "0.68rem", textTransform: "uppercase" }}>
                        มูลค่าเทียบเท่า THB
                      </Typography>
                      <Typography sx={{ fontFamily: "monospace", fontSize: "0.95rem", fontWeight: 700, color: "text.primary", mt: 0.35 }}>
                        {showBalances ? `฿${asset.value_thb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "฿ ••••••"}
                      </Typography>
                      {showBalances && botValueThb > 0 && (
                        <Typography sx={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#00c16a", mt: 0.35 }}>
                          บอท: ฿{botValueThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Bottom details (Only for coins with active position tracking) */}
                  {hasPosition && (
                    <>
                      <Divider sx={{ borderStyle: "dashed", borderColor: "rgba(255,255,255,0.06)" }} />
                      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                          <Typography sx={{ color: "text.secondary" }}>ทุน:</Typography>
                          <Typography sx={{ fontFamily: "monospace", color: "text.primary" }}>
                            {showBalances ? `฿${asset.avg_entry_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "••••••"}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                          <Typography sx={{ color: "text.secondary" }}>ราคาปัจจุบัน:</Typography>
                          <Typography sx={{ fontFamily: "monospace", color: "text.primary" }}>
                            {showBalances ? `฿${asset.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "••••••"}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                          <Typography sx={{ color: "text.secondary" }}>PnL บอท:</Typography>
                          <Typography sx={{ fontFamily: "monospace", color: assetPnlColor, fontWeight: 700 }}>
                            {showBalances ? `${isAssetProfit ? "+" : ""}${asset.pnl_thb.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "••••••"}
                          </Typography>
                        </Box>
                      </Box>
                    </>
                  )}
                </Paper>
              );
            })}
          </Box>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredAssets.length}
            rowsPerPage={assetRowsPerPage}
            page={safeAssetPage}
            onPageChange={(_, nextPage) => setAssetPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setAssetRowsPerPage(Number(event.target.value));
              setAssetPage(0);
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
        </CardContent>
      </Card>


    </Box>
  );
}
