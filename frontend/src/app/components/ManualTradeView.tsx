import React, { useEffect, useState, useMemo } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { Wallet, FileText } from "lucide-react";
import type { BalanceItem, TickerData } from "./dashboardTypes";
import { useToast } from "./Toast";
import { LiveMarketTabs } from "./LiveMarketTabs";

const MARKET_ROWS_PER_PAGE = 50;
const DUST_BALANCE_THB = 1;

function floorThb(value: number) {
  return Math.floor(Math.max(0, value) * 100) / 100;
}

function getEstimatedThbValue(asset: string, amount: number, tickers: Record<string, TickerData>) {
  if (asset === "THB") return floorThb(amount);
  const ticker = tickers[`${asset}/THB`];
  const valuationPrice = ticker?.bid || ticker?.last || 0;
  return floorThb(amount * valuationPrice);
}

interface CustomInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  unit: string;
  isBuy: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function CustomInput({ label, value, onChange, unit, isBuy, disabled = false, placeholder = "0.00" }: CustomInputProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "9px",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        p: "11px 14px",
        opacity: disabled ? 0.7 : 1,
        transition: "border-color 0.15s ease-in-out",
        "&:focus-within": {
          borderColor: disabled ? "rgba(255, 255, 255, 0.08)" : (isBuy ? "#00c16a" : "#ef5b63"),
        },
        "& input[type=number]": {
          MozAppearance: "textfield",
        },
        "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
          WebkitAppearance: "none",
          margin: 0,
        },
      }}
    >
      <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", whiteSpace: "nowrap", fontWeight: 500 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1, justifyContent: "flex-end" }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={!disabled}
          step="any"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: disabled ? "rgba(255, 255, 255, 0.5)" : "#fff",
            textAlign: "right",
            fontFamily: "monospace",
            fontSize: "0.95rem",
            fontWeight: 500,
            width: "100%",
          }}
        />
        <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 500, minWidth: "35px", textAlign: "right" }}>
          {unit}
        </Typography>
      </Box>
    </Box>
  );
}

interface PercentageButtonsProps {
  onPercentClick: (pct: number) => void;
  isBuy: boolean;
}

function PercentageButtons({ onPercentClick, isBuy }: PercentageButtonsProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", alignItems: "center", mt: 1 }}>
      <Stack direction="row" spacing={1}>
        {[25, 50, 75, 100].map((pct) => (
          <Button
            key={pct}
            onClick={() => onPercentClick(pct)}
            size="small"
            variant="text"
            sx={{
              minWidth: "49px",
              height: "26px",
              p: 0,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "6px",
              fontSize: "0.82rem",
              color: "text.primary",
              fontFamily: "monospace",
              fontWeight: 500,
              textTransform: "none",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              "&:hover": {
                borderColor: isBuy ? "#00c16a" : "#ef5b63",
                backgroundColor: isBuy ? "rgba(0, 193, 106, 0.05)" : "rgba(239, 91, 99, 0.05)",
              }
            }}
          >
            {pct}%
          </Button>
        ))}
      </Stack>
    </Box>
  );
}


interface ManualTradeViewProps {
  actionLoading: boolean;
  balances: BalanceItem[];
  calculatePercentage: (percent: number) => void;
  filterTradeSymbolOptions: (options: string[], state: { inputValue: string }) => string[];
  filteredMarketTickers: [string, TickerData][];
  handleOpenConfirmManual: (e: FormEvent) => void;
  marketPage: number;
  marketSearch: string;
  setMarketPage: Dispatch<SetStateAction<number>>;
  setMarketSearch: Dispatch<SetStateAction<string>>;
  setTradeAmount: Dispatch<SetStateAction<string>>;
  setTradePrice: Dispatch<SetStateAction<string>>;
  setTradeSide: Dispatch<SetStateAction<"buy" | "sell">>;
  setTradeSymbol: Dispatch<SetStateAction<string>>;
  setTradeType: Dispatch<SetStateAction<"market" | "limit">>;
  sortedTickers: [string, TickerData][];
  tickers: Record<string, TickerData>;
  tradeAmount: string;
  tradePrice: string;
  tradeSide: "buy" | "sell";
  tradeSymbol: string;
  tradeSymbolOptions: string[];
  tradeType: "market" | "limit";
  wsConnected: boolean;
}

export function ManualTradeView({ actionLoading, balances, calculatePercentage, filterTradeSymbolOptions, filteredMarketTickers, handleOpenConfirmManual, marketPage, marketSearch, setMarketPage, setMarketSearch, setTradeAmount, setTradePrice, setTradeSide, setTradeSymbol, setTradeType, sortedTickers, tickers, tradeAmount, tradePrice, tradeSide, tradeSymbol, tradeSymbolOptions, tradeType, wsConnected }: ManualTradeViewProps) {
  const { addToast } = useToast();

  // Local States for Buy and Sell forms to prevent overlap
  const [buyAmount, setBuyAmount] = useState("");

  // Open Orders and Trade History State
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterCurrentSymbol, setFilterCurrentSymbol] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [recentlyCancelledIds, setRecentlyCancelledIds] = useState<string[]>([]);

  const fetchOpenOrders = async () => {
    try {
      const res = await fetch("/api/open-orders");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setOpenOrders(data.open_orders || []);
        }
      }
    } catch (err) {
      console.error("Error fetching open orders:", err);
    }
  };

  const fetchTradeHistory = async () => {
    try {
      const res = await fetch("/api/order-history");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          setTradeHistory(data.history || []);
        }
      }
    } catch (err) {
      console.error("Error fetching trade history:", err);
    }
  };

  const handleCancelOrder = async (orderId: string, symbol: string, side: string) => {
    setCancellingId(orderId);
    try {
      const res = await fetch("/api/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          order_id: orderId,
          side
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          // Immediately filter it locally and keep it in cache list to avoid api refresh latency
          setRecentlyCancelledIds(prev => [...prev, orderId]);
          setOpenOrders(prev => prev.filter((o) => o.id !== orderId));
          addToast({
            type: "success",
            title: "ยกเลิกคำสั่งสำเร็จ",
            message: `ยกเลิกคำสั่ง ${side.toUpperCase()} สำหรับ ${symbol} เรียบร้อยแล้ว`
          });
          // Background fetch to sync
          fetchOpenOrders();
          fetchTradeHistory();
        } else {
          addToast({
            type: "error",
            title: "ยกเลิกคำสั่งไม่สำเร็จ",
            message: data.detail || "ไม่สามารถยกเลิกคำสั่งได้"
          });
        }
      } else {
        addToast({
          type: "error",
          title: "เชื่อมต่อล้มเหลว",
          message: "เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อขาย"
        });
      }
    } catch (err) {
      console.error("Error cancelling order:", err);
      addToast({
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message: "ระบบเกิดข้อผิดพลาดขณะยกเลิกคำสั่ง"
      });
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    fetchOpenOrders();
    fetchTradeHistory();
  }, [balances]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOpenOrders();
      fetchTradeHistory();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const displayedOpenOrders = useMemo(() => {
    const activeOrders = openOrders.filter((o) => !recentlyCancelledIds.includes(o.id));
    if (filterCurrentSymbol) {
      return activeOrders.filter((o) => o.symbol === tradeSymbol);
    }
    return activeOrders;
  }, [openOrders, filterCurrentSymbol, tradeSymbol, recentlyCancelledIds]);

  const displayedHistory = useMemo(() => {
    if (filterCurrentSymbol) {
      return tradeHistory.filter((o) => o.symbol === tradeSymbol);
    }
    return tradeHistory;
  }, [tradeHistory, filterCurrentSymbol, tradeSymbol]);

  const formatTimestamp = (ts: string | number) => {
    if (!ts) return "-";
    const num = typeof ts === "string" ? parseFloat(ts) : ts;
    const ms = num < 99999999999 ? num * 1000 : num;
    const date = new Date(ms);
    return date.toLocaleDateString("en-GB") + " " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };
  const [buyPrice, setBuyPrice] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [hideDustBalances, setHideDustBalances] = useState(true);

  // Set default trade symbol only once when options load initially
  useEffect(() => {
    if (!tradeSymbol && tradeSymbolOptions.length > 0) {
      const defaultSym = tradeSymbolOptions.includes("BTC/THB") ? "BTC/THB" : tradeSymbolOptions[0];
      setTradeSymbol(defaultSym);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeSymbolOptions]);

  // Sync initial price from ticker when tradeSymbol changes
  useEffect(() => {
    if (tradeSymbol && tickers[tradeSymbol]) {
      const p = tickers[tradeSymbol].last.toString();
      setBuyPrice(p);
      setSellPrice(p);
    } else {
      setBuyPrice("");
      setSellPrice("");
    }
    setBuyAmount("");
    setSellAmount("");
  }, [tradeSymbol]);

  // Extract base asset (e.g. KUB) and quote asset (e.g. THB)
  const baseAsset = useMemo(() => {
    if (!tradeSymbol) return "COIN";
    return tradeSymbol.split("/")[0];
  }, [tradeSymbol]);

  const quoteAsset = useMemo(() => {
    if (!tradeSymbol) return "THB";
    return tradeSymbol.split("/")[1] || "THB";
  }, [tradeSymbol]);

  // Extract relevant balances
  const thbBalance = useMemo(() => {
    const b = balances.find((x) => x.asset === "THB");
    return b ? (b.free_for_manual !== undefined ? b.free_for_manual : b.free) : 0;
  }, [balances]);

  const baseAssetBalance = useMemo(() => {
    const b = balances.find((x) => x.asset === baseAsset);
    return b ? (b.free_for_manual !== undefined ? b.free_for_manual : b.free) : 0;
  }, [balances, baseAsset]);

  const balanceSummary = useMemo(() => {
    return balances.reduce(
      (summary, item) => {
        const totalValue = getEstimatedThbValue(item.asset, item.total, tickers);
        const availableValue = item.asset === "THB"
          ? (item.free_for_manual !== undefined ? item.free_for_manual : item.free)
          : 0;
        const botLockedValue = getEstimatedThbValue(item.asset, item.locked_by_bot ?? 0, tickers);

        return {
          totalThb: summary.totalThb + totalValue,
          availableThb: summary.availableThb + floorThb(availableValue),
          botLockedThb: summary.botLockedThb + botLockedValue,
        };
      },
      { totalThb: 0, availableThb: 0, botLockedThb: 0 }
    );
  }, [balances, tickers]);

  const visibleBalances = useMemo(() => {
    const hasVisibleAmount = (item: BalanceItem) => {
      const manualFree = item.free_for_manual !== undefined ? item.free_for_manual : item.free;
      const amount = Math.max(item.total, manualFree, item.free, item.used, item.locked_by_bot ?? 0);
      if (amount <= 0.00000001) return false;

      const ticker = tickers[`${item.asset}/THB`];
      if (hideDustBalances && (ticker?.bid || ticker?.last || 0) > 0) {
        return getEstimatedThbValue(item.asset, amount, tickers) >= DUST_BALANCE_THB;
      }

      return true;
    };

    return [...balances]
      .filter((item) => item.asset === "THB" || hasVisibleAmount(item))
      .sort((a, b) => {
        const priority = (item: BalanceItem) => {
          if (item.asset === "THB") return 0;
          if (item.asset === baseAsset && hasVisibleAmount(item)) return 1;
          return 2;
        };

        const priorityDiff = priority(a) - priority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return a.asset.localeCompare(b.asset);
      });
  }, [balances, baseAsset, hideDustBalances, tickers]);

  // Percentage Handlers
  const handleBuyPercent = (pct: number) => {
    const toSpend = thbBalance * (pct / 100);
    const formatted = (Math.floor(toSpend * 100) / 100).toString();
    setBuyAmount(formatted);
  };

  const handleSellPercent = (pct: number) => {
    const toSell = baseAssetBalance * (pct / 100);
    const formatted = (Math.floor(toSell * 100000000) / 100000000).toString();
    setSellAmount(formatted);
  };

  // Live Conversion calculations
  const buyReceiveQty = useMemo(() => {
    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) return "0.00000000";

    if (tradeType === "limit") {
      const price = parseFloat(buyPrice);
      if (!price || price <= 0) return "0.00000000";
      return (amount / price).toFixed(8);
    } else {
      const price = tickers[tradeSymbol]?.last || 0;
      if (price <= 0) return "0.00000000";
      return (amount / price).toFixed(8);
    }
  }, [buyAmount, buyPrice, tradeType, tickers, tradeSymbol]);

  const sellReceiveThb = useMemo(() => {
    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) return "0.00";

    if (tradeType === "limit") {
      const price = parseFloat(sellPrice);
      if (!price || price <= 0) return "0.00";
      return (amount * price).toFixed(2);
    } else {
      const price = tickers[tradeSymbol]?.last || 0;
      if (price <= 0) return "0.00";
      return (amount * price).toFixed(2);
    }
  }, [sellAmount, sellPrice, tradeType, tickers, tradeSymbol]);

  // Submission handlers that update parent state and trigger confirmation dialog
  const submitBuy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSymbol) return;

    const amountThb = parseFloat(buyAmount);
    if (!buyAmount || amountThb <= 0) return;

    if (tradeType === "limit") {
      const price = parseFloat(buyPrice);
      if (!buyPrice || price <= 0) return;
    }

    setTradeSide("buy");
    setTradeAmount(buyAmount);
    setTradePrice(tradeType === "limit" ? buyPrice : "");

    setTimeout(() => {
      handleOpenConfirmManual(e);
    }, 50);
  };

  const submitSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSymbol) return;

    const amountCoin = parseFloat(sellAmount);
    if (!sellAmount || amountCoin <= 0) return;

    if (tradeType === "limit") {
      const price = parseFloat(sellPrice);
      if (!sellPrice || price <= 0) return;
    }

    setTradeSide("sell");
    setTradeAmount(sellAmount);
    setTradePrice(tradeType === "limit" ? sellPrice : "");

    setTimeout(() => {
      handleOpenConfirmManual(e);
    }, 50);
  };


  const getTradingViewSymbol = (sym: string) => {
    if (!sym) return "BITKUB:BTCTHB";
    const parts = sym.toUpperCase().split("/");
    if (parts.length === 2) {
      return `BITKUB:${parts[0]}${parts[1]}`;
    }
    return `BITKUB:${sym.replace("/", "")}`;
  };

  const tvSymbol = getTradingViewSymbol(tradeSymbol);
  const iframeSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=15&theme=dark&style=1&timezone=Asia%2FBangkok&locale=th`;

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "7.2fr 4.8fr" }, gap: 1, alignItems: "start" }}>
        <Box>
          <Stack spacing={1.5}>
            {/* TradingView Live Chart Card */}
            <Card
              sx={{
                background: "rgba(8, 12, 20, 0.72)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "20px",
                boxShadow: "0 9px 32px 0 rgba(0, 0, 0, 0.38)",
                overflow: "hidden"
              }}
            >
              <Box sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <Typography sx={{ fontWeight: 600, fontSize: "0.92rem", letterSpacing: "0.05em", color: "text.primary", fontFamily: "Outfit, sans-serif" }}>
                  กราฟราคา Technical Realtime (Live Chart): {tradeSymbol || "BTC/THB"}
                </Typography>
                <Chip
                  size="small"
                  label="TradingView"
                  sx={{
                    height: 18,
                    fontSize: "9px",
                    fontWeight: 500,
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    color: "text.secondary",
                    borderRadius: "5px"
                  }}
                />
              </Box>
              <CardContent sx={{ p: 0, height: "480px", position: "relative" }}>
                <iframe
                  src={iframeSrc}
                  width="100%"
                  height="100%"
                  style={{ border: "none" }}
                  allowFullScreen
                  title="TradingView Chart"
                />
              </CardContent>
            </Card>
            {/* Manual Trading Form */}
            <Card
              sx={{
                background: "rgba(8, 12, 20, 0.72)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "20px",
                boxShadow: "0 9px 32px 0 rgba(0, 0, 0, 0.38)"
              }}
            >
              <CardContent sx={{ p: 3 }}>
                {/* Trade Controls */}
                <Stack spacing={1.5} sx={{ mb: 3 }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 190px" }, gap: 1.25, alignItems: "stretch" }}>
                    <Box>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                        เลือกคู่เหรียญเทรด
                      </Typography>
                      <Autocomplete
                        fullWidth
                        size="small"
                        value={tradeSymbol || null}
                        options={tradeSymbolOptions}
                        getOptionKey={(option) => option}
                        isOptionEqualToValue={(option, value) => option === value}
                        filterOptions={filterTradeSymbolOptions}
                        openOnFocus={false}
                        forcePopupIcon={false}
                        autoHighlight
                        clearOnEscape
                        noOptionsText="ค้นหาไม่พบ"
                        onChange={(_, value) => {
                          setTradeSymbol(value ?? "");
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="ค้นหาคู่เหรียญ เช่น BTC/THB"
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: "12px",
                                backgroundColor: "rgba(255, 255, 255, 0.01)"
                              }
                            }}
                          />
                        )}
                        renderOption={(props, sym) => {
                          const data = tickers[sym];
                          const { key, ...optionProps } = props;

                          return (
                            <Box key={sym} component="li" {...optionProps} sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                              <Typography sx={{ fontWeight: 500, fontSize: "0.9rem" }}>{sym}</Typography>
                              <Typography sx={{ fontSize: "0.8rem", color: (data?.percentage ?? 0) >= 0 ? "#00c16a" : "#ef5b63", fontFamily: "monospace", ml: 2 }}>
                                {data && data.last > 0 ? data.last.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                              </Typography>
                            </Box>
                          );
                        }}
                        slotProps={{ paper: { sx: { maxHeight: 300, borderRadius: "11px" } } }}
                      />
                    </Box>

                    <Box sx={{ p: 1.4, borderRadius: "12px", backgroundColor: "rgba(255, 255, 255, 0.018)", border: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 72 }}>
                      <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", fontWeight: 500 }}>
                        ราคาล่าสุด
                      </Typography>
                      <Typography sx={{ fontSize: "1rem", color: "text.primary", fontFamily: "monospace", fontWeight: 600, mt: 0.3 }}>
                        {(tickers[tradeSymbol]?.last || 0) > 0 ? tickers[tradeSymbol].last.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

                  <Box>
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 500, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                      ประเภทคำสั่ง
                    </Typography>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 2, borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      {[
                        { id: "limit", label: "ลิมิต" },
                        { id: "market", label: "มาร์เก็ต" }
                      ].map((tab) => {
                        const isActive = tradeType === tab.id;
                        return (
                          <Button
                            key={tab.id}
                            onClick={() => setTradeType(tab.id as "limit" | "market")}
                            sx={{
                              minWidth: 0,
                              minHeight: 30,
                              px: 0,
                              pb: 0.85,
                              borderRadius: 0,
                              position: "relative",
                              textTransform: "none",
                              color: isActive ? "primary.main" : "text.secondary",
                              backgroundColor: "transparent",
                              border: "none",
                              fontWeight: 600,
                              "&::after": {
                                content: '""',
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: -1,
                                height: "2px",
                                borderRadius: "2px",
                                backgroundColor: isActive ? "primary.main" : "transparent",
                              },
                              "&:hover": {
                                backgroundColor: "transparent",
                                color: isActive ? "primary.main" : "text.primary",
                              }
                            }}
                          >
                            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.1 }}>
                              {tab.label}
                            </Typography>
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </Stack>

                {/* Side-by-Side Panels */}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 4 }}>

                  {/* Buy Form (ซื้อ) */}
                  <form onSubmit={submitBuy}>
                    <Stack spacing={1.25}>
                      <Stack spacing={0.8} sx={{ mb: 0.5 }}>
                        <Box
                          onClick={() => handleBuyPercent(100)}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            "&:hover": { opacity: 0.8 }
                          }}
                        >
                          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", fontWeight: 500 }}>คงเหลือ</Typography>
                          <Typography sx={{ fontSize: "0.85rem", color: "#00c16a", fontWeight: 500, textDecoration: "underline" }}>
                            {thbBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                          </Typography>
                        </Box>
                      </Stack>

                      <CustomInput
                        label="จำนวนที่ต้องจ่าย"
                        value={buyAmount}
                        onChange={setBuyAmount}
                        unit="THB"
                        isBuy={true}
                        placeholder="0.00"
                      />

                      <PercentageButtons onPercentClick={handleBuyPercent} isBuy={true} />

                      {tradeType === "limit" ? (
                        <CustomInput
                          label={`ราคาต่อ ${baseAsset}`}
                          value={buyPrice}
                          onChange={setBuyPrice}
                          unit="THB"
                          isBuy={true}
                          placeholder="0.00"
                        />
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                            borderRadius: "9px",
                            backgroundColor: "rgba(255, 255, 255, 0.01)",
                            p: "11px 14px",
                            opacity: 0.6
                          }}
                        >
                          <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 500 }}>
                            ราคาต่อ {baseAsset}
                          </Typography>
                          <Typography sx={{ fontSize: "0.95rem", fontWeight: 500, color: "text.secondary", pr: "35px" }}>
                            ราคาตลาด (Market)
                          </Typography>
                        </Box>
                      )}

                      <CustomInput
                        label={`${baseAsset} จำนวนที่จะได้รับ`}
                        value={buyReceiveQty}
                        onChange={() => { }}
                        unit={baseAsset}
                        isBuy={true}
                        disabled={true}
                        placeholder="0.00000000"
                      />

                      <Button
                        fullWidth
                        type="submit"
                        disabled={actionLoading}
                        variant="contained"
                        sx={{
                          py: 1.5,
                          fontSize: "1rem",
                          fontWeight: 600,
                          backgroundColor: "#00c16a",
                          color: "#ffffff",
                          borderRadius: "9px",
                          textTransform: "none",
                          "&:hover": {
                            backgroundColor: "#00a85d",
                          },
                          "&.Mui-disabled": {
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "rgba(255, 255, 255, 0.3)",
                          }
                        }}
                      >
                        {actionLoading ? <CircularProgress size={20} color="inherit" /> : "ซื้อ"}
                      </Button>
                    </Stack>
                  </form>

                  {/* Sell Form (ขาย) */}
                  <form onSubmit={submitSell}>
                    <Stack spacing={1.25}>
                      <Stack spacing={0.8} sx={{ mb: 0.5 }}>
                        <Box
                          onClick={() => handleSellPercent(100)}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            "&:hover": { opacity: 0.8 }
                          }}
                        >
                          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", fontWeight: 500 }}>คงเหลือ</Typography>
                          <Typography sx={{ fontSize: "0.85rem", color: "#00c16a", fontWeight: 500, textDecoration: "underline" }}>
                            {baseAssetBalance.toLocaleString(undefined, { minimumFractionDigits: 8, maximumFractionDigits: 8 })} {baseAsset}
                          </Typography>
                        </Box>
                      </Stack>

                      <CustomInput
                        label="จำนวนที่ต้องขาย"
                        value={sellAmount}
                        onChange={setSellAmount}
                        unit={baseAsset}
                        isBuy={false}
                        placeholder="0.00000000"
                      />

                      <PercentageButtons onPercentClick={handleSellPercent} isBuy={false} />

                      {tradeType === "limit" ? (
                        <CustomInput
                          label={`ราคาต่อ ${baseAsset}`}
                          value={sellPrice}
                          onChange={setSellPrice}
                          unit="THB"
                          isBuy={false}
                          placeholder="0.00"
                        />
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                            borderRadius: "9px",
                            backgroundColor: "rgba(255, 255, 255, 0.01)",
                            p: "11px 14px",
                            opacity: 0.6
                          }}
                        >
                          <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontWeight: 500 }}>
                            ราคาต่อ {baseAsset}
                          </Typography>
                          <Typography sx={{ fontSize: "0.95rem", fontWeight: 500, color: "text.secondary", pr: "35px" }}>
                            ราคาตลาด (Market)
                          </Typography>
                        </Box>
                      )}

                      <CustomInput
                        label="THB จำนวนที่จะได้รับ"
                        value={sellReceiveThb}
                        onChange={() => { }}
                        unit="THB"
                        isBuy={false}
                        disabled={true}
                        placeholder="0.00"
                      />

                      <Button
                        fullWidth
                        type="submit"
                        disabled={actionLoading}
                        variant="contained"
                        sx={{
                          py: 1.5,
                          fontSize: "1rem",
                          fontWeight: 600,
                          backgroundColor: "#ef5b63",
                          color: "#ffffff",
                          borderRadius: "9px",
                          textTransform: "none",
                          "&:hover": {
                            backgroundColor: "#dc4854",
                          },
                          "&.Mui-disabled": {
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "rgba(255, 255, 255, 0.3)",
                          }
                        }}
                      >
                        {actionLoading ? <CircularProgress size={20} color="inherit" /> : "ขาย"}
                      </Button>
                    </Stack>
                  </form>

                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Box>
        {/* Right Column (Balances & Tickers) */}
        <Box>
          <Stack spacing={1.5}>

            {/* Balances Card */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                    ยอดเงินคงเหลือ (Balances)
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={hideDustBalances}
                          onChange={(e) => setHideDustBalances(e.target.checked)}
                          sx={{ p: 0.25, color: "text.secondary", "&.Mui-checked": { color: "primary.main" } }}
                        />
                      }
                      label={<Typography sx={{ fontSize: "0.74rem", color: "text.secondary", whiteSpace: "nowrap" }}>ซ่อน &lt; 1 บาท</Typography>}
                      sx={{ m: 0, gap: 0.4, "& .MuiFormControlLabel-label": { lineHeight: 1 } }}
                    />
                    <Wallet size={18} style={{ color: "#00c16a" }} />
                  </Stack>
                </Box>

                {balances.length === 0 ? (
                  <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", py: 2, textAlign: "center" }}>
                    กำลังดึงข้อมูลยอดเงินคงเหลือ...
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                      <Paper elevation={0} sx={{ p: 1.6, borderRadius: "12px", backgroundColor: "rgba(0, 193, 106, 0.035)", border: "1px solid rgba(0, 193, 106, 0.16)" }}>
                        <Typography sx={{ fontSize: "0.76rem", color: "primary.main", fontWeight: 600, letterSpacing: "0.05em" }}>
                          THB พร้อมใช้
                        </Typography>
                        <Typography sx={{ fontSize: "1.08rem", fontWeight: 600, color: "text.primary", fontFamily: "monospace", mt: 0.45 }}>
                          {thbBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Paper>

                      <Paper elevation={0} sx={{ p: 1.6, borderRadius: "12px", backgroundColor: "rgba(255, 255, 255, 0.015)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", fontWeight: 600, letterSpacing: "0.05em" }}>
                          {baseAsset} พร้อมใช้
                        </Typography>
                        <Typography sx={{ fontSize: "1.08rem", fontWeight: 600, color: "text.primary", fontFamily: "monospace", mt: 0.45 }}>
                          {baseAssetBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </Typography>
                      </Paper>
                    </Box>

                    <Box sx={{ display: "grid", gap: 0.65, maxHeight: 260, overflowY: "auto", pr: 0.5 }}>
                      {visibleBalances.map((item) => {
                        const isPrimary = item.asset === "THB" || item.asset === baseAsset;
                        const decimals = item.asset === "THB" ? 2 : 8;
                        const totalValueThb = getEstimatedThbValue(item.asset, item.total, tickers);

                        return (
                          <Box
                            key={item.asset}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "64px minmax(0, 1fr) minmax(72px, auto)",
                              gap: 1,
                              alignItems: "center",
                              px: 1.2,
                              py: 0.9,
                              borderRadius: "10px",
                              backgroundColor: isPrimary ? "rgba(255, 255, 255, 0.025)" : "rgba(255, 255, 255, 0.012)",
                              border: "1px solid rgba(255, 255, 255, 0.045)",
                            }}
                          >
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.25 }}>
                              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: isPrimary ? "text.primary" : "text.secondary" }}>
                                {item.asset}
                              </Typography>
                              {item.locked_by_bot !== undefined && item.locked_by_bot > 0 && (
                                <Chip
                                  label="BOT"
                                  size="small"
                                  sx={{
                                    height: "13px",
                                    fontSize: "7.5px",
                                    fontWeight: 700,
                                    backgroundColor: "rgba(0, 193, 106, 0.08)",
                                    color: "#00c16a",
                                    border: "1px solid rgba(0, 193, 106, 0.15)",
                                    borderRadius: "3px",
                                    "& .MuiChip-label": { px: 0.4 }
                                  }}
                                />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: "text.primary", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.total.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                              </Typography>
                              {((item.locked_by_bot !== undefined && item.locked_by_bot > 0) || item.used > 0) && (
                                <Stack spacing={0.2} sx={{ mt: 0.4 }}>
                                  <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 500, display: "flex", alignItems: "center", gap: 0.5 }}>
                                    • พร้อมใช้: {(item.free_for_manual !== undefined ? item.free_for_manual : item.free).toLocaleString(undefined, { maximumFractionDigits: decimals })}
                                  </Typography>
                                  {item.locked_by_bot !== undefined && item.locked_by_bot > 0 && (
                                    <Typography sx={{ fontSize: "0.72rem", color: "#00c16a", fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5 }}>
                                      • บอทล็อก: {item.locked_by_bot.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                                    </Typography>
                                  )}
                                  {item.used > 0 && (
                                    <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontWeight: 500, display: "flex", alignItems: "center", gap: 0.5 }}>
                                      • ในออเดอร์: {item.used.toLocaleString(undefined, { maximumFractionDigits: decimals })}
                                    </Typography>
                                  )}
                                </Stack>
                              )}
                            </Box>
                            <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", textAlign: "right", fontFamily: "monospace" }}>
                              ≈ {totalValueThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>

            <LiveMarketTabs
              filteredMarketTickers={filteredMarketTickers}
              marketPage={marketPage}
              marketSearch={marketSearch}
              setMarketPage={setMarketPage}
              setMarketSearch={setMarketSearch}
              setTradeAmount={setTradeAmount}
              setTradeSymbol={setTradeSymbol}
              sortedTickers={sortedTickers}
              tradeSymbol={tradeSymbol}
              wsConnected={wsConnected}
            />
          </Stack>
        </Box>
      </Box>

      {/* Open Orders & Trade History Section */}
      <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>

        {/* Open Orders Card */}
        <Card sx={{ background: "rgba(8, 12, 20, 0.72)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "20px" }}>
          <Box sx={{ p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "text.primary", fontFamily: "Outfit, sans-serif" }}>
              ⁙ คำสั่งที่เปิดอยู่ (Open Orders)
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={filterCurrentSymbol}
                  onChange={(e) => setFilterCurrentSymbol(e.target.checked)}
                  sx={{
                    color: "rgba(255, 255, 255, 0.3)",
                    "&.Mui-checked": {
                      color: "primary.main",
                    }
                  }}
                />
              }
              label={<Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>แสดง {tradeSymbol}</Typography>}
            />
          </Box>
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: 350, minHeight: 200 }}>
              <Table size="small" stickyHeader sx={{ "& .MuiTableCell-stickyHeader": { backgroundColor: "#0d1321" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>รายการ</TableCell>
                    <TableCell>ผู้ส่ง</TableCell>
                    <TableCell>ประเภท</TableCell>
                    <TableCell align="right">ราคา</TableCell>
                    <TableCell align="right">ปริมาณ</TableCell>
                    <TableCell align="center">เงื่อนไข</TableCell>
                    <TableCell align="right">เวลาทำรายการ</TableCell>
                    <TableCell align="center">ยกเลิก</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedOpenOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: "text.secondary", fontSize: "0.85rem" }}>
                        ไม่มีคำสั่งซื้อขายค้างอยู่
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedOpenOrders.map((o) => {
                      const isBuy = o.side === "buy";
                      const rateVal = parseFloat(o.rat || o.rate || 0);
                      const amtVal = parseFloat(o.amt || o.amount || 0);
                      const cryptoQty = isBuy ? (rateVal > 0 ? amtVal / rateVal : 0) : amtVal;
                      const baseCoin = o.symbol ? o.symbol.split("/")[0] : "COIN";

                      return (
                        <TableRow key={o.id} sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.02)" } }}>
                          <TableCell sx={{ color: isBuy ? "#00c16a" : "#ef5b63", fontWeight: 600 }}>
                            {o.side?.toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={o.source === "bot" ? "BOT" : "MANUAL"}
                              sx={{
                                fontSize: "8px",
                                height: "16px",
                                fontWeight: 700,
                                backgroundColor: o.source === "bot" ? "rgba(0, 193, 106, 0.12)" : "rgba(59, 130, 246, 0.12)",
                                color: o.source === "bot" ? "primary.main" : "#60a5fa",
                                border: o.source === "bot" ? "1px solid rgba(0, 193, 106, 0.2)" : "1px solid rgba(59, 130, 246, 0.2)",
                                borderRadius: "4px"
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                            {o.typ || o.type}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                            {rateVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                            {cryptoQty.toFixed(8)} {baseCoin}
                          </TableCell>
                          <TableCell align="center" sx={{ color: "text.secondary" }}>-</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
                            {formatTimestamp(o.ts)}
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={cancellingId === o.id}
                              onClick={() => handleCancelOrder(o.id, o.symbol, o.side)}
                              sx={{
                                fontSize: "0.75rem",
                                color: "#ef5b63",
                                borderColor: "rgba(239, 91, 99, 0.3)",
                                py: 0.2,
                                px: 1,
                                borderRadius: "6px",
                                textTransform: "none",
                                minWidth: "58px",
                                height: "24px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                "&.Mui-disabled": {
                                  borderColor: "rgba(239, 91, 99, 0.15)",
                                  color: "rgba(239, 91, 99, 0.45)"
                                },
                                "&:hover": {
                                  backgroundColor: "rgba(239, 91, 99, 0.08)",
                                  borderColor: "#ef5b63"
                                }
                              }}
                            >
                              {cancellingId === o.id ? (
                                <CircularProgress size={14} sx={{ color: "#ef5b63" }} />
                              ) : (
                                "ยกเลิก"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Trade History Card */}
        <Card sx={{ background: "rgba(8, 12, 20, 0.72)", backdropFilter: "blur(24px)", border: "1px solid rgba(255, 255, 255, 0.04)", borderRadius: "20px" }}>
          <Box sx={{ p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "text.primary", fontFamily: "Outfit, sans-serif" }}>
              ⁙ ประวัติการเทรด (Trade History)
            </Typography>
          </Box>
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ maxHeight: 350, minHeight: 200 }}>
              <Table size="small" stickyHeader sx={{ "& .MuiTableCell-stickyHeader": { backgroundColor: "#0d1321" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>รายการ</TableCell>
                    <TableCell>ผู้ส่ง</TableCell>
                    <TableCell>ประเภท</TableCell>
                    <TableCell align="right">ราคา</TableCell>
                    <TableCell align="right">ปริมาณ</TableCell>
                    <TableCell align="center">เงื่อนไข</TableCell>
                    <TableCell align="right">วันที่เปิดรายการ</TableCell>
                    <TableCell align="right">วันสิ้นสุดรายการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Box sx={{ py: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                          <FileText size={36} style={{ color: "rgba(255, 255, 255, 0.15)" }} />
                          <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "text.secondary" }}>
                            ไม่มีประวัติการเทรด
                          </Typography>
                          <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", opacity: 0.7 }}>
                            เริ่มเทรดด้วยเงินเริ่มต้นเพียง 10 บาท
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedHistory.map((h, index) => {
                      const isBuy = h.side === "buy";
                      const rateVal = parseFloat(h.rate || h.rat || 0);
                      const amtVal = parseFloat(h.amount || h.amt || 0);
                      const cryptoQty = isBuy ? (rateVal > 0 ? amtVal / rateVal : 0) : amtVal;
                      const baseCoin = h.symbol ? h.symbol.split("/")[0] : "COIN";

                      return (
                        <TableRow key={h.order_id || index} sx={{ "&:hover": { backgroundColor: "rgba(255,255,255,0.02)" } }}>
                          <TableCell sx={{ color: isBuy ? "#00c16a" : "#ef5b63", fontWeight: 600 }}>
                            {h.side?.toUpperCase()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={h.source === "bot" ? "BOT" : "MANUAL"}
                              sx={{
                                fontSize: "8px",
                                height: "16px",
                                fontWeight: 700,
                                backgroundColor: h.source === "bot" ? "rgba(0, 193, 106, 0.12)" : "rgba(59, 130, 246, 0.12)",
                                color: h.source === "bot" ? "primary.main" : "#60a5fa",
                                border: h.source === "bot" ? "1px solid rgba(0, 193, 106, 0.2)" : "1px solid rgba(59, 130, 246, 0.2)",
                                borderRadius: "4px"
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                            {h.type || h.typ}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                            {rateVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} THB
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontWeight: 500 }}>
                            {cryptoQty.toFixed(8)} {baseCoin}
                          </TableCell>
                          <TableCell align="center" sx={{ color: "text.secondary" }}>-</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
                            {formatTimestamp(h.ts)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", color: "text.secondary", fontFamily: "monospace" }}>
                            {formatTimestamp(h.order_closed_at || h.ts)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

      </Box>
    </>
  );
}
