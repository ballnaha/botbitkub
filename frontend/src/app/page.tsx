"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Autocomplete,
  Button,
  TextField,
  Typography,
  Select,
  MenuItem,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  IconButton,
  Card,
  CardContent,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Chip,
  Stack,
  Tooltip,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  Zap,
  User,
  Cpu,
  LogOut,
  Wallet,
  Link,
  Bot,
  TrendingUp,
  History,
  Terminal,
  Trash2,
  Send,
  Info,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus
} from "lucide-react";
import { useToast } from "./components/Toast";
import { useBitkubWebSocket } from "./hooks/useBitkubWebSocket";

interface BalanceItem {
  asset: string;
  free: number;
  used: number;
  total: number;
}

interface TickerData {
  last: number;
  high: number;
  low: number;
  percentage: number;
  quoteVolume: number;
}

const MARKET_ROWS_PER_PAGE = 50;

interface PositionItem {
  symbol: string;
  side: string;
  amount: number;
  buy_price: number;
  entry_price?: number;
  current_price: number;
  pnl_thb: number;
  pnl_pct: number;
  pnl_percent?: number;
  buy_time?: string;
  entry_time?: string;
  trade_direction?: string;
  leverage?: number;
  margin_mode?: string;
}

interface HistoryItem {
  timestamp: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
  total: number;
  pnl_thb: number | null;
  pnl_percent: number | null;
  reason: string;
}

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
        sx={{ borderRadius: 0, color: "text.secondary", "&:hover": { color: "error.main", backgroundColor: "rgba(244, 63, 94, 0.08)" } }}
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
        sx={{ borderRadius: 0, color: "text.secondary", "&:hover": { color: "primary.main", backgroundColor: "rgba(16, 185, 129, 0.08)" } }}
      >
        <Plus size={15} />
      </IconButton>
    </Box>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // ----------------------------------------------------
  // States
  // ----------------------------------------------------
  const [username, setUsername] = useState("Loading...");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected");
  const [connectionMsg, setConnectionMsg] = useState("");
  const [botConfig, setBotConfig] = useState({
    is_running: false,
    dry_run: true,
    stake_amount_thb: 100,
    stop_loss_pct: -5,
    take_profit_pct: 10,
    max_open_trades: 3,
    trade_direction: "long",
    leverage: 1,
    symbols: [] as string[],
    timeframe: "15"
  });
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});

  // Manual Trade Form States
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeType, setTradeType] = useState<"market" | "limit">("market");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const selectedStreamSymbols = useMemo(() => {
    return tradeSymbol ? [tradeSymbol] : [];
  }, [tradeSymbol]);

  // WebSocket for real-time ticker prices
  const handleTickerUpdate = useCallback((newTickers: Record<string, TickerData>) => {
    setTickers(newTickers);
  }, []);
  const { isConnected: wsConnected } = useBitkubWebSocket(handleTickerUpdate, selectedStreamSymbols);
  const sortedTickers = useMemo(() => {
    return Object.entries(tickers).sort((a, b) => (b[1].quoteVolume ?? 0) - (a[1].quoteVolume ?? 0));
  }, [tickers]);
  const activeTickers = useMemo(() => {
    return sortedTickers.filter(([, data]) => data.last > 0 && data.quoteVolume > 0);
  }, [sortedTickers]);
  const [marketSearch, setMarketSearch] = useState("");
  const [marketPage, setMarketPage] = useState(0);
  const filteredMarketTickers = useMemo(() => {
    const query = marketSearch.trim().toUpperCase();
    if (!query) return activeTickers;

    return activeTickers.filter(([symbol]) => symbol.toUpperCase().includes(query));
  }, [activeTickers, marketSearch]);
  const marketPageCount = Math.max(1, Math.ceil(filteredMarketTickers.length / MARKET_ROWS_PER_PAGE));
  const visibleMarketTickers = useMemo(() => {
    const start = marketPage * MARKET_ROWS_PER_PAGE;
    return filteredMarketTickers.slice(start, start + MARKET_ROWS_PER_PAGE);
  }, [filteredMarketTickers, marketPage]);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [botLogs, setBotLogs] = useState<string[]>([]);

  const tradeSymbolOptions = useMemo(() => {
    const symbols = Array.from(new Set(sortedTickers.map(([symbol]) => symbol)));
    return symbols.length > 0 ? symbols : ["BTC/THB", "ETH/THB", "KUB/THB", "XRP/THB", "USDT/THB"];
  }, [sortedTickers]);
  const filterTradeSymbolOptions = useCallback((options: string[], state: { inputValue: string }) => {
    const query = state.inputValue.trim().toUpperCase();
    if (!query) return [];

    return options
      .filter((symbol) => symbol.toUpperCase().includes(query))
      .slice(0, 30);
  }, []);

  // Dialog Modals States
  const [confirmManualOpen, setConfirmManualOpen] = useState(false);
  const [confirmPanicOpen, setConfirmPanicOpen] = useState(false);
  const [panicTargetSymbol, setPanicTargetSymbol] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [, setBotConfigDirty] = useState(false);
  const botConfigDirtyRef = useRef(false);

  const updateBotConfigDraft = useCallback((patch: Partial<typeof botConfig>) => {
    botConfigDirtyRef.current = true;
    setBotConfigDirty(true);
    setBotConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // Terminal box scroll refs
  const devLogsRef = useRef<HTMLDivElement>(null);
  const botLogsRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------
  // Logging Helper
  // ----------------------------------------------------
  const addDevLog = (msg: string, type: "info" | "success" | "error" = "info") => {
    const ts = new Date().toLocaleTimeString();
    let styleClass = "text-sky-400";
    if (type === "success") styleClass = "text-emerald-400";
    if (type === "error") styleClass = "text-rose-400";
    
    const entry = `<span class="text-slate-500">[${ts}]</span> <span class="${styleClass}">${msg}</span>`;
    setDevLogs((prev) => {
      const updated = [...prev, entry];
      return updated.slice(-50); // Keep last 50
    });
  };

  const clearDevLogs = () => {
    setDevLogs([]);
    addDevLog("เคลียร์บันทึก Developer Logs แล้ว", "info");
  };

  // Auto scroll terminals
  useEffect(() => {
    if (devLogsRef.current) {
      devLogsRef.current.scrollTop = devLogsRef.current.scrollHeight;
    }
  }, [devLogs]);

  useEffect(() => {
    if (botLogsRef.current) {
      botLogsRef.current.scrollTop = botLogsRef.current.scrollHeight;
    }
  }, [botLogs]);

  useEffect(() => {
    setMarketPage((page) => Math.min(page, marketPageCount - 1));
  }, [marketPageCount]);

  // ----------------------------------------------------
  // Core API Fetch Functions (Client-side Polling)
  // ----------------------------------------------------
  const handleApiError = (res: Response) => {
    if (res.status === 401) {
      router.push("/login");
      return true;
    }
    return false;
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch("/api/user");
      if (handleApiError(res)) return;
      const data = await res.json();
      setUsername(data.username || "Admin");
    } catch (err) {
      addDevLog("ไม่สามารถดึงข้อมูลโปรไฟล์ผู้ใช้งานได้", "error");
    }
  };

  const fetchConnectionStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (handleApiError(res)) return;
      const data = await res.json();
      setConnectionStatus(data.status === "connected" ? "connected" : "disconnected");
      setConnectionMsg(data.message || "");
    } catch (err) {
      setConnectionStatus("disconnected");
      setConnectionMsg("Failed to reach FastAPI backend.");
    }
  };

  const fetchBotConfig = async () => {
    try {
      const res = await fetch("/api/bot/status");
      if (handleApiError(res)) return;
      const data = await res.json();
      setBotConfig((prev) => {
        const nextStatus = {
          is_running: !!data.is_running,
          symbols: data.symbols || [],
          timeframe: data.timeframe || "15"
        };

        if (botConfigDirtyRef.current) {
          return { ...prev, ...nextStatus };
        }

        return {
          ...nextStatus,
          dry_run: data.dry_run !== false,
          stake_amount_thb: data.stake_amount_thb ?? 100,
          stop_loss_pct: data.stop_loss_pct ?? -5,
          take_profit_pct: data.take_profit_pct ?? 10,
          max_open_trades: data.max_open_trades ?? 3,
          trade_direction: data.trade_direction || "long",
          leverage: data.leverage ?? 1,
        };
      });
    } catch (err) {
      addDevLog("ไม่สามารถดึงข้อมูลคอนฟิกของบอทได้", "error");
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await fetch("/api/balance");
      if (handleApiError(res)) return;
      const data = await res.json();
      if (data.status === "success") {
        setBalances(data.balances || []);
      }
    } catch (err) {
      addDevLog("ดึงข้อมูลบาลานซ์กระเป๋าเงินล้มเหลว", "error");
    }
  };

  const fetchTickers = async () => {
    // Fallback: only used for initial load if WebSocket hasn't connected yet
    try {
      const res = await fetch("/api/tickers");
      if (handleApiError(res)) return;
      const data = await res.json();
      if (data.status === "success") {
        setTickers((prev) => {
          // Don't overwrite if WebSocket has already populated data
          if (Object.keys(prev).length > 0) return prev;
          return data.tickers || {};
        });
      }
    } catch (err) {
      // Quiet fail — WebSocket will take over
    }
  };

  const fetchBotPositions = async () => {
    try {
      const res = await fetch("/api/bot/positions");
      if (handleApiError(res)) return;
      const data = await res.json();
      // Parse active positions
      const parsed: PositionItem[] = (data || []).map((pos: any) => ({
        symbol: pos.symbol,
        side: pos.side || "BUY",
        amount: Number(pos.amount || 0),
        buy_price: Number(pos.buy_price || pos.entry_price || 0),
        current_price: Number(pos.current_price || 0),
        pnl_thb: Number(pos.pnl_thb || 0),
        pnl_pct: Number(pos.pnl_percent || pos.pnl_pct || 0),
        buy_time: pos.buy_time || pos.entry_time || "",
        trade_direction: pos.trade_direction || "long",
        leverage: Number(pos.leverage || 1),
        margin_mode: pos.margin_mode || "spot"
      }));
      setPositions(parsed);
    } catch (err) {
      addDevLog("ดึงตำแหน่งถือครองของบอทล้มเหลว", "error");
    }
  };

  const fetchBotHistory = async () => {
    try {
      const res = await fetch("/api/bot/history");
      if (handleApiError(res)) return;
      const data = await res.json();
      const parsed: HistoryItem[] = (data || []).map((item: any) => ({
        timestamp: item.timestamp || item.sell_time || "",
        symbol: item.symbol,
        side: item.side || "SELL",
        amount: Number(item.amount || 0),
        price: Number(item.price || item.sell_price || 0),
        total: Number(item.total || (item.amount * (item.price || item.sell_price)) || 0),
        pnl_thb: item.pnl_thb !== undefined ? Number(item.pnl_thb) : null,
        pnl_percent: item.pnl_percent !== undefined ? Number(item.pnl_percent) : null,
        reason: item.reason || ""
      }));
      setHistory(parsed.reverse().slice(0, 10)); // Shows last 10 completed trades
    } catch (err) {
      addDevLog("ดึงประวัติการเทรดของบอทล้มเหลว", "error");
    }
  };

  const fetchBotLogs = async () => {
    try {
      const res = await fetch("/api/bot/logs");
      if (handleApiError(res)) return;
      const data = await res.json();
      const rawLogs: string[] = data || [];
      
      const parsed = rawLogs.map((log) => {
        let styleClass = "text-slate-300";
        if (log.includes("[SUCCESS]") || log.includes("สำเร็จ")) styleClass = "text-emerald-400 font-bold";
        else if (log.includes("[ERROR]") || log.includes("ล้มเหลว") || log.toLowerCase().includes("failed")) styleClass = "text-rose-400 font-bold";
        else if (log.includes("[INFO]")) styleClass = "text-sky-300";
        
        return `<div class="log-entry py-0.5 ${styleClass}">${log}</div>`;
      });
      setBotLogs(parsed);
    } catch (err) {
      // Quiet fail
    }
  };

  // ----------------------------------------------------
  // Initial Load and Polling Hook
  // ----------------------------------------------------
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.allSettled([
        fetchUserProfile(),
        fetchConnectionStatus(),
        fetchBotConfig(),
        fetchBalances(),
        fetchTickers(),
        fetchBotPositions(),
        fetchBotHistory(),
        fetchBotLogs(),
      ]);
      addDevLog("แผงควบคุมแดชบอร์ด Next.js เริ่มต้นทำงานสำเร็จ", "success");
      setInitialLoading(false);
    };

    loadInitialData();

    // Dynamic Interval Polling (no more ticker polling — handled by WebSocket)
    const intervalLogs = setInterval(fetchBotLogs, 4000);
    const intervalStatus = setInterval(() => {
      fetchBotPositions();
      fetchBotConfig();
    }, 5000);
    const intervalConnHist = setInterval(() => {
      fetchConnectionStatus();
      fetchBotHistory();
    }, 10000);
    const intervalBalances = setInterval(fetchBalances, 15000);

    return () => {
      clearInterval(intervalLogs);
      clearInterval(intervalStatus);
      clearInterval(intervalConnHist);
      clearInterval(intervalBalances);
    };
  }, []);

  // ----------------------------------------------------
  // User Event Handlers
  // ----------------------------------------------------
  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) {
        addToast({ type: "info", title: "ออกจากระบบสำเร็จ", message: "กำลังนำทางกลับหน้า Login..." });
        router.push("/login");
      }
    } catch (err) {
      addDevLog("ออกจากระบบไม่สำเร็จ", "error");
      addToast({ type: "error", title: "ออกจากระบบไม่สำเร็จ", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    }
  };

  const handleBotToggle = async () => {
    try {
      const res = await fetch("/api/bot/toggle", { method: "POST" });
      if (handleApiError(res)) return;
      const data = await res.json();
      if (data.status === "success") {
        setBotConfig((prev) => ({ ...prev, is_running: !!data.is_running }));
        addDevLog(
          `สลับสถานะบอท: ${data.is_running ? "🟢 กำลังทำงาน (Active)" : "🔴 หยุดทำงาน (Inactive)"}`,
          data.is_running ? "success" : "error"
        );
        addToast({
          type: data.is_running ? "success" : "warning",
          title: data.is_running ? "บอทเริ่มทำงานแล้ว" : "บอทหยุดทำงานแล้ว",
          message: data.is_running ? "ระบบกำลังวิเคราะห์ตลาดอัตโนมัติ" : "บอทหยุดทำงานแล้ว รอคำสั่งจากคุณ",
        });
      }
    } catch (err) {
      addDevLog("สลับสถานะบอทขัดข้อง", "error");
      addToast({ type: "error", title: "สลับสถานะบอทล้มเหลว", message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    }
  };

  const handleSaveBotSettings = async () => {
    try {
      const res = await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry_run: botConfig.dry_run,
          stake_amount_thb: Number(botConfig.stake_amount_thb),
          stop_loss_pct: Number(botConfig.stop_loss_pct),
          take_profit_pct: Number(botConfig.take_profit_pct),
          max_open_trades: Number(botConfig.max_open_trades),
        }),
      });
      if (handleApiError(res)) return;
      const data = await res.json();
      if (data.status === "success") {
        botConfigDirtyRef.current = false;
        setBotConfigDirty(false);
        if (data.config) {
          setBotConfig((prev) => ({
            ...prev,
            dry_run: data.config.dry_run !== false,
            stake_amount_thb: data.config.stake_amount_thb ?? prev.stake_amount_thb,
            stop_loss_pct: data.config.stop_loss_pct ?? prev.stop_loss_pct,
            take_profit_pct: data.config.take_profit_pct ?? prev.take_profit_pct,
            max_open_trades: data.config.max_open_trades ?? prev.max_open_trades,
            trade_direction: data.config.trade_direction || prev.trade_direction,
            leverage: data.config.leverage ?? prev.leverage,
            symbols: data.config.symbols || prev.symbols,
            timeframe: data.config.timeframe || prev.timeframe,
          }));
        }
        addDevLog("บันทึกการตั้งค่าบอทสำเร็จ", "success");
        addToast({ type: "success", title: "บันทึกการตั้งค่าสำเร็จ", message: "อัปเดตพารามิเตอร์บอทเรียบร้อยแล้ว" });
      }
    } catch (err) {
      addDevLog("บันทึกการตั้งค่าบอทขัดข้อง", "error");
      addToast({ type: "error", title: "บันทึกล้มเหลว", message: "ไม่สามารถบันทึกการตั้งค่าบอทได้" });
    }
  };

  // ----------------------------------------------------
  // Percentage Stakes Helper Functions
  // ----------------------------------------------------
  const calculatePercentage = (percent: number) => {
    if (!tradeSymbol) {
      addDevLog("กรุณาเลือกคู่เหรียญก่อนคำนวณจำนวน", "error");
      return;
    }

    const baseAsset = tradeSymbol.split("/")[0]; // e.g. BTC
    
    // Find THB Balance
    const thbItem = balances.find((b) => b.asset === "THB");
    const thbFree = thbItem ? thbItem.free : 0;
    
    // Find Crypto Balance
    const cryptoItem = balances.find((b) => b.asset === baseAsset);
    const cryptoFree = cryptoItem ? cryptoItem.free : 0;

    if (tradeSide === "buy") {
      if (tradeType === "market") {
        // Buy Market: Spend percent% of cash THB
        let thbToSpend = thbFree * (percent / 100);
        thbToSpend = Math.floor(thbToSpend * 100) / 100; // 2 decimal
        
        if (thbToSpend > 0) {
          setTradeAmount(thbToSpend.toString());
        } else {
          setTradeAmount("");
          addDevLog("ยอดบาลานซ์ THB ไม่เพียงพอสำหรับเปอร์เซ็นต์ที่เลือก", "error");
        }
      } else {
        // Buy Limit: Price is required
        const price = parseFloat(tradePrice);
        if (!price || price <= 0) {
          addDevLog("กรุณาระบุราคารับซื้อเพื่อคำนวณจำนวนเหรียญ", "error");
          return;
        }
        let thbToSpend = thbFree * (percent / 100);
        let coinQty = thbToSpend / price;
        coinQty = Math.floor(coinQty * 1000000) / 1000000; // 6 decimals
        
        if (coinQty > 0) {
          setTradeAmount(coinQty.toString());
        } else {
          setTradeAmount("");
          addDevLog("ยอดบาลานซ์ THB ไม่เพียงพอสำหรับเปอร์เซ็นต์ที่เลือก", "error");
        }
      }
    } else {
      // Sell (Limit or Market): Sell percent% of cryptos
      let coinsToSell = cryptoFree * (percent / 100);
      coinsToSell = Math.floor(coinsToSell * 1000000) / 1000000; // 6 decimals
      
      if (coinsToSell > 0) {
        setTradeAmount(coinsToSell.toString());
      } else {
        setTradeAmount("");
        addDevLog(`ยอดบาลานซ์ ${baseAsset} ไม่เพียงพอสำหรับเปอร์เซ็นต์ที่เลือก`, "error");
      }
    }
  };

  // ----------------------------------------------------
  // Trade Operations Submission
  // ----------------------------------------------------
  const handleOpenConfirmManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeSymbol) {
      addDevLog("กรุณาเลือกคู่เหรียญก่อนส่งคำสั่ง", "error");
      return;
    }
    if (!tradeAmount || Number(tradeAmount) <= 0) {
      addDevLog("กรุณาระบุจำนวนสำหรับส่งคำสั่ง", "error");
      return;
    }
    if (tradeType === "limit" && (!tradePrice || Number(tradePrice) <= 0)) {
      addDevLog("กรุณาระบุราคาสำหรับ Limit Order", "error");
      return;
    }
    setConfirmManualOpen(true);
  };

  const handleExecuteManualTrade = async () => {
    setConfirmManualOpen(false);
    setActionLoading(true);

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tradeSymbol,
          side: tradeSide,
          order_type: tradeType,
          amount: Number(tradeAmount),
          price: tradeType === "limit" ? Number(tradePrice) : undefined,
        }),
      });

      if (handleApiError(res)) return;
      const data = await res.json();

      if (res.ok && data.status === "success") {
        addDevLog(
          `ส่งคำสั่งซื้อขายสำเร็จ: ${tradeSide.toUpperCase()} ${tradeSymbol} จำนวน ${tradeAmount} [${tradeType.toUpperCase()}]`,
          "success"
        );
        addToast({
          type: "success",
          title: `${tradeSide === "buy" ? "ซื้อ" : "ขาย"}สำเร็จ`,
          message: `${tradeSide.toUpperCase()} ${tradeSymbol} จำนวน ${tradeAmount} [${tradeType.toUpperCase()}]`,
          duration: 5000,
        });
        // Reset state
        setTradeAmount("");
        setTradePrice("");
        fetchBalances();
      } else {
        addDevLog(`คำสั่งซื้อขายล้มเหลว: ${data.detail || "Unknown error"}`, "error");
        addToast({ type: "error", title: "คำสั่งเทรดล้มเหลว", message: data.detail || "Unknown error" });
      }
    } catch (err) {
      addDevLog("เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายสำหรับส่งคำสั่งเทรด", "error");
      addToast({ type: "error", title: "เชื่อมต่อเครือข่ายล้มเหลว", message: "ไม่สามารถส่งคำสั่งเทรดได้" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenConfirmPanic = (symbol: string) => {
    setPanicTargetSymbol(symbol);
    setConfirmPanicOpen(true);
  };

  const handleExecutePanicSell = async () => {
    setConfirmPanicOpen(false);
    setActionLoading(true);

    try {
      const res = await fetch("/api/bot/panic-sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: panicTargetSymbol }),
      });

      if (handleApiError(res)) return;
      const data = await res.json();

      if (res.ok && data.status === "success") {
        addDevLog(`บอททำ Panic Sell สำเร็จ: ขาย ${panicTargetSymbol} เข้าตลาดทันที`, "success");
        addToast({ type: "success", title: "Panic Sell สำเร็จ", message: `ขาย ${panicTargetSymbol} เข้าตลาดทันทีเรียบร้อย`, duration: 5000 });
        fetchBotPositions();
        fetchBotHistory();
        fetchBalances();
      } else {
        addDevLog(`Panic Sell ล้มเหลว: ${data.detail || "Unknown error"}`, "error");
        addToast({ type: "error", title: "Panic Sell ล้มเหลว", message: data.detail || "Unknown error" });
      }
    } catch (err) {
      addDevLog("เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายสำหรับ Panic Sell", "error");
      addToast({ type: "error", title: "Panic Sell ล้มเหลว", message: "ไม่สามารถเชื่อมต่อเครือข่ายได้" });
    } finally {
      setActionLoading(false);
    }
  };

  const cashThb = balances.find((b) => b.asset === "THB")?.free || 0;

  // ─── Loading Screen ─────────────────────────────────
  if (initialLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        }}
      >
        {/* Glowing background */}
        <Box sx={{ position: "fixed", inset: 0, backdropFilter: "blur(120px)", zIndex: -1, pointerEvents: "none" }} />
        <Box sx={{ position: "fixed", borderRadius: "50%", filter: "blur(130px)", zIndex: -2, opacity: 0.08, width: 600, height: 600, backgroundColor: "primary.main", bottom: "-10%", left: "-10%", pointerEvents: "none" }} />

        {/* Spinner */}
        <Box
          sx={{
            position: "relative",
            width: 64,
            height: 64,
            animation: "loading-pulse 2s ease-in-out infinite",
            "@keyframes loading-pulse": {
              "0%, 100%": { transform: "scale(1)" },
              "50%": { transform: "scale(1.08)" },
            },
          }}
        >
          <CircularProgress
            size={64}
            thickness={2}
            sx={{
              color: "primary.main",
              filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.3))",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "primary.main",
              filter: "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))",
            }}
          >
            <Zap size={24} />
          </Box>
        </Box>

        <Box sx={{ textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "text.primary",
              letterSpacing: "0.05em",
            }}
          >
            กำลังโหลดแดชบอร์ด
          </Typography>
          <Typography
            sx={{
              fontSize: "0.7rem",
              color: "text.secondary",
              mt: 0.5,
            }}
          >
            กรุณารอสักครู่...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        py: 4,
        px: { xs: 2, sm: 3, md: 4 },
        overflowX: "hidden",
        minHeight: "100vh",
        animation: "dashboard-fade-in 0.5s ease-out",
        "@keyframes dashboard-fade-in": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      {/* Background glass blur effect */}
      <Box sx={{ position: "fixed", inset: 0, backdropFilter: "blur(120px)", zIndex: -1, pointerEvents: "none" }} />
      
      {/* Glowing background bubbles */}
      <Box 
        sx={{ 
          position: "fixed", 
          borderRadius: "50%", 
          filter: "blur(130px)", 
          zIndex: -2, 
          opacity: 0.08, 
          width: 600, 
          height: 600, 
          backgroundColor: "primary.main", 
          bottom: "-10%", 
          left: "-10%", 
          pointerEvents: "none" 
        }} 
      />

      <Box sx={{ maxWidth: 1440, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        
        {/* Header / Navbar */}
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: "center",
            p: 2.5,
            px: 3,
            gap: 2,
            borderRadius: "20px",
            background: "rgba(13, 19, 33, 0.45)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: { xs: "100%", sm: "auto" } }}>
            <Box 
              sx={{ 
                p: 1.2, 
                backgroundColor: "rgba(16, 185, 129, 0.08)", 
                color: "primary.main", 
                borderRadius: "14px",
                filter: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.2))",
                display: "flex"
              }}
            >
              <Zap size={20} />
            </Box>
            <Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 800, 
                  fontFamily: "Outfit, sans-serif",
                  background: "linear-gradient(90deg, #fff 0%, #e2e8f0 70%, #10b981 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  lineHeight: 1.2
                }}
              >
                Bitkub API Hub
              </Typography>
              <Typography sx={{ fontSize: "9px", color: "text.secondary", fontWeight: 800, letterSpacing: "0.1em", mt: 0.5, fontFamily: "monospace" }}>
                DEVELOPER TRADING TERMINAL
              </Typography>
            </Box>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: "flex-end", alignItems: "center" }}>
            {/* User Info */}
            <Chip 
              icon={<User size={14} style={{ color: "#10b981" }} />} 
              label={`User: ${username}`}
              variant="outlined"
              sx={{ 
                fontSize: "11px", 
                fontWeight: 700, 
                borderColor: "rgba(255, 255, 255, 0.06)", 
                backgroundColor: "rgba(255, 255, 255, 0.015)",
                color: "text.primary"
              }} 
            />

            {/* System Status */}
            <Chip 
              icon={<Cpu size={14} style={{ color: "#3b82f6" }} />} 
              label="SYS: OK"
              variant="outlined"
              sx={{ 
                fontSize: "11px", 
                fontWeight: 700, 
                borderColor: "rgba(255, 255, 255, 0.06)", 
                backgroundColor: "rgba(255, 255, 255, 0.015)",
                color: "text.primary"
              }} 
            />

            {/* Logout Button */}
            <Button
              onClick={handleLogout}
              variant="outlined"
              startIcon={<LogOut size={14} />}
              sx={{
                fontSize: "11px",
                fontWeight: 700,
                color: "error.main",
                borderColor: "rgba(244, 63, 94, 0.15)",
                backgroundColor: "rgba(244, 63, 94, 0.03)",
                borderRadius: "12px",
                px: 2,
                py: 0.8,
                "&:hover": {
                  borderColor: "error.main",
                  backgroundColor: "rgba(244, 63, 94, 0.12)"
                }
              }}
            >
              ออกจากระบบ
            </Button>
          </Stack>
        </Paper>

        {/* KPI Metrics Box Layout */}
        <Box 
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)"
            },
            gap: 2
          }}
        >
          {/* Card 1: Available Cash */}
          <Box>
            <Card>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    เงินสด THB พร้อมใช้
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "primary.main", fontFamily: "monospace", textShadow: "0 0 10px rgba(16, 185, 129, 0.2)" }}>
                    {cashThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(16, 185, 129, 0.08)", color: "primary.main", display: "flex" }}>
                  <Wallet size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 2: API Connection */}
          <Box>
            <Card>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.8, display: "block" }}>
                    Bitkub API Connection
                  </Typography>
                  {connectionStatus === "connected" ? (
                    <Chip 
                      size="small"
                      label="Connected" 
                      color="success" 
                      variant="outlined" 
                      sx={{ fontSize: "10px", height: "22px", backgroundColor: "rgba(16, 185, 129, 0.08)" }} 
                    />
                  ) : (
                    <Tooltip title={connectionMsg}>
                      <Chip 
                        size="small"
                        label="Disconnected" 
                        color="error" 
                        variant="outlined" 
                        sx={{ fontSize: "10px", height: "22px", backgroundColor: "rgba(244, 63, 94, 0.08)", cursor: "help" }} 
                      />
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(255, 255, 255, 0.03)", color: "text.secondary", display: "flex" }}>
                  <Link size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 3: Auto Bot Run State */}
          <Box>
            <Card>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.8, display: "block" }}>
                    สถานะบอทอัตโนมัติ
                  </Typography>
                  {botConfig.is_running ? (
                    <Chip 
                      size="small"
                      label={botConfig.dry_run ? "RUNNING (DRY)" : "RUNNING (LIVE)"} 
                      color="success" 
                      sx={{ fontSize: "10px", height: "22px", fontWeight: 800 }} 
                    />
                  ) : (
                    <Chip 
                      size="small"
                      label={botConfig.dry_run ? "STOPPED (DRY)" : "STOPPED (LIVE)"} 
                      color="error" 
                      sx={{ fontSize: "10px", height: "22px", fontWeight: 800 }} 
                    />
                  )}
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(59, 130, 246, 0.08)", color: "secondary.main", display: "flex" }}>
                  <Bot size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 4: Positions Held */}
          <Box>
            <Card>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    ตำแหน่งที่ถือครอง
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "#818cf8", fontFamily: "monospace", textShadow: "0 0 10px rgba(129, 140, 248, 0.2)" }}>
                    {positions.length} Positions
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(129, 140, 248, 0.08)", color: "#818cf8", display: "flex" }}>
                  <Inbox size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Dashboard Workspace Box Layout */}
        <Box 
          sx={{ 
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "7fr 5fr"
            },
            gap: 3,
            alignItems: "start"
          }}
        >
          
          {/* Left Controls Column */}
          <Box>
            <Stack spacing={3}>
              
              {/* Auto Bot Settings Form */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <Bot size={18} style={{ color: "#10b981" }} />
                      <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                        บอทเทรดอัตโนมัติ (Auto Bot Settings)
                      </Typography>
                    </Stack>
                    <Switch
                      checked={botConfig.is_running}
                      onChange={handleBotToggle}
                      color="primary"
                    />
                  </Box>

                  <Stack spacing={3}>
                    <Box>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                        โหมดทดสอบสัญญาณ (Dry-Run Mode)
                      </Typography>
                      <Select
                        fullWidth
                        value={botConfig.dry_run}
                        onChange={(e) => updateBotConfigDraft({ dry_run: e.target.value === "true" || e.target.value === true })}
                        size="small"
                      >
                        <MenuItem value="true">Dry-Run (ระบบจำลอง - บันทึกในประวัติเท่านั้น)</MenuItem>
                        <MenuItem value="false" sx={{ color: "error.main", fontWeight: 700 }}>LIVE Trade (เทรดจริง - ส่งคำสั่งเข้าตลาด Bitkub)</MenuItem>
                      </Select>
                    </Box>

                    <Box 
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "repeat(2, 1fr)",
                          md: "repeat(4, 1fr)"
                        },
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
                          step={1}
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
                          min={0}
                          suffix="%"
                          onChange={(value) => updateBotConfigDraft({ take_profit_pct: value })}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip size="small" label="LONG" color="success" variant="outlined" sx={{ fontWeight: 800, fontSize: "10px" }} />
                      <Chip size="small" label="SPOT" variant="outlined" sx={{ fontWeight: 800, fontSize: "10px", borderColor: "rgba(255,255,255,0.12)" }} />
                      <Chip size="small" label="1x" variant="outlined" sx={{ fontWeight: 800, fontSize: "10px", borderColor: "rgba(255,255,255,0.12)" }} />
                      <Typography sx={{ alignSelf: "center", fontSize: "0.7rem", color: "text.secondary" }}>
                        Short/leverage require futures or margin API. Bitkub spot runs long-only.
                      </Typography>
                    </Box>

                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleSaveBotSettings}
                      sx={{
                        py: 1.2,
                        fontSize: "0.75rem",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        backgroundColor: "rgba(255, 255, 255, 0.01)",
                        color: "text.primary",
                        "&:hover": {
                          borderColor: "primary.main",
                          backgroundColor: "rgba(16, 185, 129, 0.05)"
                        }
                      }}
                    >
                      บันทึกการตั้งค่าบอท
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              {/* Manual Trading Form */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2 }}>
                    <Send size={18} style={{ color: "#10b981" }} />
                    <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                      ส่งคำสั่งเทรดเอง (Manual Trade)
                    </Typography>
                  </Box>

                  <form onSubmit={handleOpenConfirmManual}>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                          เลือกคู่เหรียญ
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
                          noOptionsText="Type to search"
                          onChange={(_, value) => {
                            setTradeSymbol(value ?? "");
                            setTradeAmount("");
                          }}
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Search symbol" />
                          )}
                          renderOption={(props, sym) => {
                            const data = tickers[sym];
                            const { key, ...optionProps } = props;

                            return (
                              <Box key={sym} component="li" {...optionProps} sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                                <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>{sym}</Typography>
                                <Typography sx={{ fontSize: "0.7rem", color: (data?.percentage ?? 0) >= 0 ? "primary.main" : "error.main", fontFamily: "monospace", ml: 2 }}>
                                  {data && data.last > 0 ? data.last.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                                </Typography>
                              </Box>
                            );
                          }}
                          slotProps={{ paper: { sx: { maxHeight: 300 } } }}
                        />
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
                            ประเภทคำสั่ง
                          </Typography>
                          <Select
                            fullWidth
                            value={tradeType}
                            onChange={(e) => {
                              setTradeType(e.target.value as "market" | "limit");
                              setTradeAmount("");
                            }}
                            size="small"
                          >
                            <MenuItem value="market">Market</MenuItem>
                            <MenuItem value="limit">Limit</MenuItem>
                          </Select>
                        </Box>

                        <Box>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                            ธุรกรรม (ธุรกรรม)
                          </Typography>
                          <Select
                            fullWidth
                            value={tradeSide}
                            onChange={(e) => {
                              setTradeSide(e.target.value as "buy" | "sell");
                              setTradeAmount("");
                            }}
                            size="small"
                            sx={{
                              color: tradeSide === "buy" ? "primary.main" : "error.main",
                              fontWeight: 700
                            }}
                          >
                            <MenuItem value="buy" sx={{ color: "primary.main", fontWeight: 700 }}>ซื้อ (Buy)</MenuItem>
                            <MenuItem value="sell" sx={{ color: "error.main", fontWeight: 700 }}>ขาย (Sell)</MenuItem>
                          </Select>
                        </Box>
                      </Box>

                      <Box sx={{ width: "100%" }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                          {tradeSide === "buy" && tradeType === "market"
                            ? "จำนวนเงินที่ซื้อ (บาท THB)"
                            : `จำนวนเหรียญที่ต้องการ${tradeSide === "buy" ? "ซื้อ" : "ขาย"}`}
                        </Typography>
                        
                        <TextField
                          fullWidth
                          placeholder={tradeSide === "buy" && tradeType === "market" ? "เช่น 50" : "เช่น 0.001"}
                          value={tradeAmount}
                          onChange={(e) => setTradeAmount(e.target.value)}
                          required
                          size="small"
                          slotProps={{
                            input: {
                              style: { fontFamily: "monospace", fontWeight: 600 },
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                                    {tradeSide === "buy" && tradeType === "market" ? "THB" : (tradeSymbol ? tradeSymbol.split("/")[0] : "COIN")}
                                  </Typography>
                                </InputAdornment>
                              )
                            }
                          }}
                        />

                        {/* Percentage shortcuts — Segmented Control */}
                        <Box
                          sx={{
                            mt: 2,
                            p: 0.5,
                            borderRadius: "10px",
                            backgroundColor: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.04)",
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "4px",
                          }}
                        >
                          {[25, 50, 75, 100].map((pct) => (
                            <Button
                              key={pct}
                              onClick={() => calculatePercentage(pct)}
                              size="small"
                              variant="text"
                              sx={{
                                py: 1,
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                fontFamily: "monospace",
                                color: "text.secondary",
                                borderRadius: "8px",
                                minWidth: 0,
                                position: "relative",
                                overflow: "hidden",
                                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                "&::before": {
                                  content: '""',
                                  position: "absolute",
                                  inset: 0,
                                  borderRadius: "inherit",
                                  opacity: 0,
                                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(20, 184, 166, 0.08))",
                                  transition: "opacity 0.25s ease",
                                },
                                "&:hover": {
                                  color: "primary.main",
                                  backgroundColor: "transparent",
                                  "&::before": {
                                    opacity: 1,
                                  },
                                },
                                "&:active": {
                                  transform: "scale(0.95)",
                                  color: "#fff",
                                  "&::before": {
                                    opacity: 1,
                                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(20, 184, 166, 0.15))",
                                  },
                                },
                              }}
                            >
                              {pct}%
                            </Button>
                          ))}
                        </Box>

                        <Typography sx={{ fontSize: "10px", color: "text.secondary", mt: 1.5, lineHeight: 1.5 }}>
                          {tradeSide === "buy" && tradeType === "market"
                            ? "* สำหรับการซื้อแบบ Market จะระบุเป็นจำนวนเงินบาท (THB)"
                            : `* การ${tradeSide === "buy" ? "ซื้อ" : "ขาย"}แบบ ${tradeType.toUpperCase()} จะระบุจำนวนเป็นปริมาณเหรียญ`}
                        </Typography>
                      </Box>

                      {/* Conditional Limit Price Field */}
                      {tradeType === "limit" && (
                        <Box sx={{ width: "100%" }}>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                            ราคารับซื้อ/ขาย (ต่อ 1 เหรียญ)
                          </Typography>
                          <TextField
                            fullWidth
                            placeholder="ระบุราคาต่อ 1 เหรียญ"
                            value={tradePrice}
                            onChange={(e) => setTradePrice(e.target.value)}
                            required
                            size="small"
                            slotProps={{
                              input: {
                                style: { fontFamily: "monospace", fontWeight: 600 }
                              }
                            }}
                          />
                        </Box>
                      )}

                      {/* Submit Trade Button */}
                      <Button
                        fullWidth
                        type="submit"
                        disabled={actionLoading}
                        variant="contained"
                        sx={{
                          py: 1.6,
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          background: "linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #059669 100%)",
                          color: "#080b11",
                          boxShadow: "0 4px 15px rgba(16, 185, 129, 0.15)",
                          "&:hover": {
                            background: "linear-gradient(90deg, #34d399 0%, #2dd4bf 50%, #059669 100%)",
                            boxShadow: "0 6px 20px rgba(16, 185, 129, 0.25)"
                          },
                          "&.Mui-disabled": {
                            background: "rgba(255, 255, 255, 0.05)",
                            color: "rgba(255, 255, 255, 0.3)",
                          }
                        }}
                      >
                        {actionLoading ? <CircularProgress size={20} color="inherit" /> : "ส่งคำสั่งเทรดทันที"}
                      </Button>
                    </Stack>
                  </form>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Right Column (Balances & Tickers) */}
          <Box>
            <Stack spacing={3}>
              
              {/* Balances Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                      ยอดเงินคงเหลือ (Balances)
                    </Typography>
                    <Wallet size={18} style={{ color: "#10b981" }} />
                  </Box>

                  <Box 
                    sx={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", 
                      gap: 1.5 
                    }}
                  >
                    {balances.length === 0 ? (
                      <Typography sx={{ color: "text.secondary", fontSize: "0.75rem", py: 2, gridColumn: "1 / -1", textAlign: "center" }}>
                        กำลังดึงข้อมูลยอดเงินคงเหลือ...
                      </Typography>
                    ) : (
                      balances.map((item) => {
                        const isThb = item.asset === "THB";
                        return (
                          <Paper 
                            key={item.asset} 
                            elevation={0}
                            sx={{
                              p: 1.8,
                              borderRadius: "12px",
                              backgroundColor: isThb ? "rgba(16, 185, 129, 0.03)" : "rgba(255, 255, 255, 0.01)",
                              border: isThb ? "1px solid rgba(16, 185, 129, 0.15)" : "1px solid rgba(255, 255, 255, 0.04)",
                              "&:hover": {
                                backgroundColor: isThb ? "rgba(16, 185, 129, 0.06)" : "rgba(255, 255, 255, 0.025)"
                              }
                            }}
                          >
                            <Typography sx={{ fontSize: "10px", fontWeight: 800, color: isThb ? "primary.main" : "text.secondary", letterSpacing: "0.05em" }}>
                              {item.asset}
                            </Typography>
                            <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "text.primary", fontFamily: "monospace", mt: 0.5 }}>
                              {isThb 
                                ? item.free.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                : item.free.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </Typography>
                            
                            <Stack spacing={0.2} sx={{ mt: 1.5, pt: 1, borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 700, color: "text.secondary" }}>
                                <span>LOCKED</span>
                                <span>{item.used.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                              </Box>
                              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 700, color: "text.secondary" }}>
                                <span>TOTAL</span>
                                <span>{item.total.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                              </Box>
                            </Stack>
                          </Paper>
                        );
                      })
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Live Tickers Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                        ราคาตลาดเรียลไทม์
                      </Typography>
                      <Chip
                        size="small"
                        label={wsConnected ? "LIVE" : "OFFLINE"}
                        sx={{
                          height: 20,
                          fontSize: "9px",
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          backgroundColor: wsConnected ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
                          color: wsConnected ? "#10b981" : "#f43f5e",
                          border: wsConnected ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(244, 63, 94, 0.2)",
                          animation: wsConnected ? "live-pulse 2s ease-in-out infinite" : "none",
                          "@keyframes live-pulse": {
                            "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" },
                            "50%": { boxShadow: "0 0 8px 0 rgba(16, 185, 129, 0.2)" },
                          },
                        }}
                      />
                    </Box>
                    <TrendingUp size={18} style={{ color: "#3b82f6" }} />
                  </Box>

                  <TextField
                    fullWidth
                    size="small"
                    value={marketSearch}
                    onChange={(e) => {
                      setMarketSearch(e.target.value);
                      setMarketPage(0);
                    }}
                    placeholder="Search market"
                    sx={{ mb: 2 }}
                  />

                  <TableContainer sx={{ maxHeight: 420, overflowY: "auto" }}>
                    <Table size="small" stickyHeader sx={{ "& .MuiTableCell-stickyHeader": { backgroundColor: "#0d1321" } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ pl: 0 }}>คู่เหรียญ</TableCell>
                          <TableCell align="right">ล่าสุด</TableCell>
                          <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Vol 24h</TableCell>
                          <TableCell align="right" sx={{ pr: 0 }}>เปลี่ยนแปลง</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedTickers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.75rem" }}>
                              กำลังโหลดข้อมูลราคาคู่เหรียญ...
                            </TableCell>
                          </TableRow>
                        ) : visibleMarketTickers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "0.75rem" }}>
                              No market pairs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleMarketTickers.map(([symbol, data]) => {
                              const isPos = data.percentage > 0;
                              const pctColor = isPos ? "primary.main" : (data.percentage < 0 ? "error.main" : "text.secondary");
                              
                              return (
                                <TableRow key={symbol}>
                                  <TableCell sx={{ pl: 0, fontWeight: 700, fontSize: "0.75rem" }}>{symbol}</TableCell>
                                  <TableCell align="right" sx={{ color: "primary.main", fontWeight: 800, fontFamily: "monospace", fontSize: "0.75rem" }}>
                                    {data.last.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.7rem", display: { xs: "none", sm: "table-cell" } }}>
                                    {data.quoteVolume > 1000000
                                      ? `${(data.quoteVolume / 1000000).toFixed(1)}M`
                                      : data.quoteVolume > 1000
                                        ? `${(data.quoteVolume / 1000).toFixed(1)}K`
                                        : data.quoteVolume.toFixed(0)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ pr: 0, color: pctColor, fontWeight: 800, fontFamily: "monospace", fontSize: "0.75rem" }}>
                                    {isPos ? "+" : ""}{data.percentage.toFixed(2)}%
                                  </TableCell>
                                </TableRow>
                              );
                            })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {filteredMarketTickers.length > MARKET_ROWS_PER_PAGE && (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mt: 2 }}>
                      <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", fontFamily: "monospace" }}>
                        {marketPage * MARKET_ROWS_PER_PAGE + 1}-{Math.min((marketPage + 1) * MARKET_ROWS_PER_PAGE, filteredMarketTickers.length)} / {filteredMarketTickers.length}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Previous page">
                          <span>
                            <IconButton
                              size="small"
                              disabled={marketPage === 0}
                              onClick={() => setMarketPage((page) => Math.max(0, page - 1))}
                            >
                              <ChevronLeft size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Typography sx={{ minWidth: 52, textAlign: "center", alignSelf: "center", fontSize: "0.7rem", color: "text.secondary", fontFamily: "monospace" }}>
                          {marketPage + 1}/{marketPageCount}
                        </Typography>
                        <Tooltip title="Next page">
                          <span>
                            <IconButton
                              size="small"
                              disabled={marketPage >= marketPageCount - 1}
                              onClick={() => setMarketPage((page) => Math.min(marketPageCount - 1, page + 1))}
                            >
                              <ChevronRight size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>

        {/* Active Positions Table Card */}
        <Card>
          <CardContent sx={{ p: 3 }}>
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
                      <TableCell align="right">ราคาตลาด</TableCell>
                      <TableCell align="right">กำไร / ขาดทุน (PnL)</TableCell>
                      <TableCell align="right" sx={{ display: { xs: "none", md: "table-cell" } }}>เวลาที่ซื้อ</TableCell>
                      <TableCell align="center" sx={{ pr: 0 }}>จัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {positions.map((pos) => {
                      const isProfit = pos.pnl_thb > 0;
                      const pnlColor = isProfit ? "primary.main" : (pos.pnl_thb < 0 ? "error.main" : "text.secondary");
                      
                      return (
                        <TableRow key={pos.symbol}>
                          <TableCell sx={{ pl: 0, fontWeight: 700, fontSize: "0.75rem" }}>{pos.symbol}</TableCell>
                          <TableCell align="center">
                            <Chip size="small" label={`${(pos.trade_direction || "long").toUpperCase()} ${pos.leverage || 1}x`} variant="outlined" sx={{ fontSize: "9px", height: "18px", borderColor: "rgba(16,185,129,0.35)", color: "primary.main", fontWeight: 700 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.primary" }}>
                            {pos.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                            {pos.buy_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                            {pos.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                              variant="contained"
                              size="small"
                              sx={{
                                fontSize: "9px",
                                fontWeight: 800,
                                py: 0.5,
                                px: 1.5,
                                borderRadius: "8px",
                                backgroundColor: "error.main",
                                color: "white",
                                "&:hover": {
                                  backgroundColor: "error.dark",
                                  boxShadow: "0 0 12px rgba(244, 63, 94, 0.3)"
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
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2, mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "text.primary" }}>
                ประวัติการทำรายการเสร็จสิ้น (Trade History)
              </Typography>
              <History size={18} style={{ color: "#10b981" }} />
            </Box>

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
                      <TableCell align="right">ราคาเทรด</TableCell>
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
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>{item.symbol}</TableCell>
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

        {/* Terminals Console Grid using Box Layout */}
        <Box 
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, 1fr)"
            },
            gap: 3
          }}
        >
          {/* Developer Logs */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                overflow: "hidden",
                background: "rgba(8, 11, 17, 0.85)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 10px 30px rgba(0, 0, 0, 0.5)"
              }}
            >
              <Box sx={{ px: 2.5, py: 1.5, background: "rgba(13, 17, 28, 0.9)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row" spacing={1} sx={{ userSelect: "none" }}>
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#f43f5e", width: "9px", height: "9px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#eab308", width: "9px", height: "9px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#10b981", width: "9px", height: "9px" }} />
                </Stack>
                <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "text.secondary", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                  DEVELOPER SYSTEM LOGS
                </Typography>
                <IconButton 
                  onClick={clearDevLogs} 
                  size="small"
                  sx={{ color: "text.secondary", p: 0.5, "&:hover": { color: "text.primary" } }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </Box>
              <Box 
                ref={devLogsRef}
                sx={{
                  height: 208,
                  overflowY: "auto",
                  p: 2,
                  fontFamily: "monospace",
                  fontSize: "11px",
                  lineHeight: 1.6,
                  color: "text.primary",
                  backgroundColor: "rgba(8, 11, 17, 0.95)",
                }}
                dangerouslySetInnerHTML={{ __html: devLogs.join("") }}
              />
            </Paper>
          </Box>

          {/* Bot Activity Logs */}
          <Box>
            <Paper
              elevation={0}
              sx={{
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                overflow: "hidden",
                background: "rgba(8, 11, 17, 0.85)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 10px 30px rgba(0, 0, 0, 0.5)"
              }}
            >
              <Box sx={{ px: 2.5, py: 1.5, background: "rgba(13, 17, 28, 0.9)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row" spacing={1} sx={{ userSelect: "none" }}>
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#f43f5e", width: "9px", height: "9px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#eab308", width: "9px", height: "9px" }} />
                  <Box sx={{ w: 9, h: 9, borderRadius: "50%", background: "#10b981", width: "9px", height: "9px" }} />
                </Stack>
                <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "text.secondary", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                  BOT TRADING & ACTIVITY LOGS
                </Typography>
                <Terminal size={14} style={{ color: "#3b82f6" }} />
              </Box>
              <Box 
                ref={botLogsRef}
                sx={{
                  height: 208,
                  overflowY: "auto",
                  p: 2,
                  fontFamily: "monospace",
                  fontSize: "11px",
                  lineHeight: 1.6,
                  color: "text.primary",
                  backgroundColor: "rgba(8, 11, 17, 0.95)",
                }}
                dangerouslySetInnerHTML={{ __html: botLogs.join("") }}
              />
            </Paper>
          </Box>
        </Box>

      </Box>

      {/* ----------------------------------------------------
          Confirmation Dialog Modals (Material UI)
         ---------------------------------------------------- */}
      
      {/* 1. Manual Trade Confirmation */}
      <Dialog
        open={confirmManualOpen}
        onClose={() => setConfirmManualOpen(false)}
      >
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: "1.1rem" }} className="text-sky-400 flex items-center gap-2">
          <Info size={20} /> ยืนยันการส่งคำสั่งเทรด
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary", fontSize: "0.85rem", mt: 1, lineHeight: 1.6 }}>
            คุณต้องการส่งคำสั่ง <strong>{tradeSide.toUpperCase()} {tradeSymbol}</strong> 
            ประเภท <strong>{tradeType.toUpperCase()}</strong> จำนวน <strong>{tradeAmount}</strong>
            {tradeType === "limit" ? <> ที่ราคา <strong>{tradePrice} THB</strong></> : " ด้วยราคาตลาด"} จริงหรือไม่?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ gap: 1.5, px: 3, pb: 2.5 }}>
          <Button 
            onClick={() => setConfirmManualOpen(false)}
            variant="outlined"
            sx={{
              color: "text.secondary",
              borderColor: "rgba(255,255,255,0.06)",
              backgroundColor: "rgba(255,255,255,0.01)",
              borderRadius: "12px",
              px: 3,
              fontSize: "0.75rem",
              "&:hover": { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.04)" }
            }}
          >
            ยกเลิก
          </Button>
          <Button 
            onClick={handleExecuteManualTrade}
            autoFocus
            variant="contained"
            sx={{
              color: "#080b11",
              backgroundColor: "primary.main",
              borderRadius: "12px",
              px: 3,
              fontWeight: 800,
              fontSize: "0.75rem",
              "&:hover": { backgroundColor: "primary.dark", boxShadow: "0 0 15px rgba(16,185,129,0.3)" }
            }}
          >
            ยืนยันส่งคำสั่ง
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2. Panic Sell Confirmation */}
      <Dialog
        open={confirmPanicOpen}
        onClose={() => setConfirmPanicOpen(false)}
        sx={{
          "& .MuiDialog-paper": {
            borderColor: "rgba(244,63,94,0.2)"
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 800, fontSize: "1.1rem" }} className="text-rose-400 flex items-center gap-2">
          <Info size={20} style={{ color: "#f43f5e" }} /> ยืนยันการทำ Panic Sell
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary", fontSize: "0.85rem", mt: 1, lineHeight: 1.6 }}>
            คุณแน่ใจหรือไม่ที่จะเปิดคำสั่ง <strong>Panic Sell (ขายด่วน) สำหรับ {panicTargetSymbol}</strong>?
            บอทจะส่งคำสั่งขายเหรียญนี้เข้าตลาดทั้งหมดทันทีในราคากระดานปัจจุบัน
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ gap: 1.5, px: 3, pb: 2.5 }}>
          <Button 
            onClick={() => setConfirmPanicOpen(false)}
            variant="outlined"
            sx={{
              color: "text.secondary",
              borderColor: "rgba(255,255,255,0.06)",
              backgroundColor: "rgba(255,255,255,0.01)",
              borderRadius: "12px",
              px: 3,
              fontSize: "0.75rem",
              "&:hover": { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.04)" }
            }}
          >
            ยกเลิก
          </Button>
          <Button 
            onClick={handleExecutePanicSell}
            autoFocus
            variant="contained"
            sx={{
              color: "white",
              backgroundColor: "error.main",
              borderRadius: "12px",
              px: 3,
              fontWeight: 800,
              fontSize: "0.75rem",
              "&:hover": { backgroundColor: "error.dark", boxShadow: "0 0 15px rgba(225,29,72,0.3)" }
            }}
          >
            ยืนยัน Panic Sell
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
