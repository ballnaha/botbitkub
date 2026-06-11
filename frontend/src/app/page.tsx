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
  Plus,
  Sliders,
} from "lucide-react";
import { BotTradeView } from "./components/BotTradeView";
import { LogsView } from "./components/LogsView";
import { ManualTradeView } from "./components/ManualTradeView";
import { SettingsView } from "./components/SettingsView";
import { Footer } from "./components/Footer";
import { useToast } from "./components/Toast";
import { useBitkubWebSocket } from "./hooks/useBitkubWebSocket";

interface BalanceItem {
  asset: string;
  free: number;
  used: number;
  total: number;
  locked_by_bot?: number;
  free_for_manual?: number;
}

interface TickerData {
  last: number;
  bid?: number;
  ask?: number;
  high: number;
  low: number;
  percentage: number;
  quoteVolume: number;
}

type DashboardView = "bot" | "manual" | "settings";

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
  mode?: string;
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
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary" }}>{suffix}</Typography>
              </InputAdornment>
            ) : undefined,
            inputProps: {
              step,
              min,
              style: { textAlign: "center", fontFamily: "monospace", fontWeight: 600, padding: "9px 4px" }
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
    max_budget_thb: 5000,
    trade_direction: "long",
    leverage: 1,
    symbols: [] as string[],
    timeframe: "15",
    strategy: "multi_indicator"
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

  const botLockedThb = useMemo(() => {
    return balances.reduce((sum, item) => {
      const lockedAmt = item.locked_by_bot ?? 0;
      if (lockedAmt <= 0) return sum;

      if (item.asset === "THB") return sum + lockedAmt;

      const ticker = tickers[`${item.asset}/THB`];
      const price = ticker?.bid || ticker?.last || 0;
      const value = lockedAmt * price;

      const flooredValue = Math.floor(Math.max(0, value) * 100) / 100;
      return sum + flooredValue;
    }, 0);
  }, [balances, tickers]);

  const totalThb = useMemo(() => {
    return balances.reduce((sum, item) => {
      if (item.asset === "THB") return sum + item.total;

      const ticker = tickers[`${item.asset}/THB`];
      const price = ticker?.bid || ticker?.last || 0;
      const value = item.total * price;

      const flooredValue = Math.floor(Math.max(0, value) * 100) / 100;
      return sum + flooredValue;
    }, 0);
  }, [balances, tickers]);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [botLogs, setBotLogs] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<DashboardView>("bot");
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const tradeSymbolOptions = useMemo(() => {
    const symbols = Array.from(new Set(Object.keys(tickers)));
    return symbols.length > 0 ? symbols.sort() : ["BTC/THB", "ETH/THB", "KUB/THB", "XRP/THB", "USDT/THB"];
  }, [Object.keys(tickers).join(",")]);
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
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const botConfigDirtyRef = useRef(false);
  const latestBotConfigRef = useRef(botConfig);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveVersionRef = useRef(0);

  const updateBotConfigDraft = useCallback((patch: Partial<typeof botConfig>) => {
    botConfigDirtyRef.current = true;
    setBotConfigDirty(true);
    setSettingsSaveState("idle");
    setBotConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    latestBotConfigRef.current = botConfig;
  }, [botConfig]);

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
          return {
            ...prev,
            is_running: nextStatus.is_running,
            timeframe: nextStatus.timeframe,
          };
        }

        return {
          ...nextStatus,
          dry_run: data.dry_run !== false,
          stake_amount_thb: data.stake_amount_thb ?? 100,
          stop_loss_pct: data.stop_loss_pct ?? -5,
          take_profit_pct: data.take_profit_pct ?? 10,
          max_open_trades: data.max_open_trades ?? 3,
          max_budget_thb: data.max_budget_thb ?? 5000.0,
          trade_direction: data.trade_direction || "long",
          leverage: data.leverage ?? 1,
          strategy: data.strategy || "multi_indicator",
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

  const refreshBalancesAfterTrade = () => {
    fetchBalances();
    window.setTimeout(fetchBalances, 1200);
    window.setTimeout(fetchBalances, 3500);
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
        buy_price: item.buy_price !== undefined ? Number(item.buy_price) : undefined,
        price: Number(item.price || item.sell_price || 0),
        total: Number(item.total || (item.amount * (item.price || item.sell_price)) || 0),
        pnl_thb: item.pnl_thb !== undefined ? Number(item.pnl_thb) : null,
        pnl_percent: item.pnl_percent !== undefined ? Number(item.pnl_percent) : null,
        reason: item.reason || "",
        mode: item.mode
      }));
      setHistory(parsed.reverse());
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

  const handleSaveBotSettings = async (configOverride?: typeof botConfig, options?: { silent?: boolean }) => {
    const configToSave = configOverride || latestBotConfigRef.current;
    const silent = options?.silent ?? false;
    setDataLoading(true);
    if (silent) setSettingsSaveState("saving");
    try {
      const res = await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dry_run: configToSave.dry_run,
          stake_amount_thb: Number(configToSave.stake_amount_thb),
          stop_loss_pct: Number(configToSave.stop_loss_pct),
          take_profit_pct: Number(configToSave.take_profit_pct),
          max_open_trades: Number(configToSave.max_open_trades),
          max_budget_thb: Number(configToSave.max_budget_thb),
          symbols: configToSave.symbols,
          strategy: configToSave.strategy,
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
            max_budget_thb: data.config.max_budget_thb ?? prev.max_budget_thb,
            trade_direction: data.config.trade_direction || prev.trade_direction,
            leverage: data.config.leverage ?? prev.leverage,
            symbols: data.config.symbols || prev.symbols,
            timeframe: data.config.timeframe || prev.timeframe,
            strategy: data.config.strategy || prev.strategy,
          }));
        }

        // Immediately refresh positions and history for the newly updated mode
        await Promise.allSettled([
          fetchBalances(),
          fetchBotPositions(),
          fetchBotHistory()
        ]);

        if (silent) {
          setSettingsSaveState("saved");
        } else {
          addDevLog("บันทึกการตั้งค่าบอทสำเร็จ", "success");
          addToast({ type: "success", title: "บันทึกการตั้งค่าสำเร็จ", message: "อัปเดตพารามิเตอร์บอทเรียบร้อยแล้ว" });
        }
      }
    } catch (err) {
      setSettingsSaveState("error");
      addDevLog("บันทึกการตั้งค่าบอทขัดข้อง", "error");
      if (!silent) {
        addToast({ type: "error", title: "บันทึกล้มเหลว", message: "ไม่สามารถบันทึกการตั้งค่าบอทได้" });
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!botConfigDirtyRef.current || initialLoading) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    const saveVersion = autoSaveVersionRef.current + 1;
    autoSaveVersionRef.current = saveVersion;
    setSettingsSaveState("idle");

    autoSaveTimerRef.current = setTimeout(() => {
      const configSnapshot = latestBotConfigRef.current;
      handleSaveBotSettings(configSnapshot, { silent: true }).then(() => {
        if (autoSaveVersionRef.current === saveVersion) {
          window.setTimeout(() => {
            if (autoSaveVersionRef.current === saveVersion) {
              setSettingsSaveState("idle");
            }
          }, 1800);
        }
      });
    }, 650);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    botConfig.dry_run,
    botConfig.stake_amount_thb,
    botConfig.stop_loss_pct,
    botConfig.take_profit_pct,
    botConfig.max_open_trades,
    botConfig.max_budget_thb,
    botConfig.strategy,
    botConfig.symbols,
    initialLoading,
  ]);

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
        refreshBalancesAfterTrade();
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
              filter: "drop-shadow(0 0 12px rgba(0, 193, 106, 0.3))",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "primary.main",
              filter: "drop-shadow(0 0 9px rgba(0, 193, 106, 0.4))",
            }}
          >
            <Zap size={24} />
          </Box>
        </Box>

        <Box sx={{ textAlign: "center" }}>
          <Typography
            sx={{
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "text.primary",
              letterSpacing: "0.05em",
            }}
          >
            กำลังโหลดแดชบอร์ด
          </Typography>
          <Typography
            sx={{
              fontSize: "0.8rem",
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
        pt: { xs: 0, sm: 2 },
        pb: { xs: "88px", sm: 2 },
        px: { xs: 0, sm: 1.5, md: 2 },
        overflowX: "hidden",
        minHeight: "100vh",
        animation: "dashboard-fade-in 0.5s ease-out",
        "@keyframes dashboard-fade-in": {
          "0%": { opacity: 0, transform: "translateY(9px)" },
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

      {/* Mobile Bottom Navigation Bar (Rendered before content in DOM) */}
      <Paper
        elevation={10}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: { xs: "flex", md: "none" },
          justifyContent: "space-around",
          alignItems: "center",
          p: 1.25,
          pb: "calc(env(safe-area-inset-bottom) + 10px)",
          background: "rgba(13, 19, 33, 0.88)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.5)",
        }}
      >
        {[
          { id: "bot", label: "Bot Trade", icon: <Bot size={20} /> },
          { id: "manual", label: "Manual Trade", icon: <Send size={20} /> },
          { id: "settings", label: "Settings", icon: <Sliders size={20} /> },
        ].map((item) => {
          const isActive = activeView === item.id;
          return (
            <Button
              key={item.id}
              onClick={() => setActiveView(item.id as DashboardView)}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                minWidth: 72,
                py: 0.6,
                px: 1,
                borderRadius: "12px",
                color: isActive ? "primary.main" : "text.secondary",
                backgroundColor: isActive ? "rgba(0, 193, 106, 0.05)" : "transparent",
                textTransform: "none",
                fontSize: "0.72rem",
                fontWeight: isActive ? 600 : 500,
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: isActive ? "rgba(0, 193, 106, 0.08)" : "rgba(255, 255, 255, 0.02)",
                }
              }}
            >
              <Box sx={{
                color: isActive ? "primary.main" : "text.secondary",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.2s ease",
                transform: isActive ? "scale(1.1)" : "scale(1)"
              }}>
                {item.icon}
              </Box>
              <Typography sx={{ fontSize: "9.5px", fontWeight: isActive ? 600 : 500, lineHeight: 1, letterSpacing: "0.02em" }}>
                {item.label}
              </Typography>
            </Button>
          );
        })}
      </Paper>

      <Box sx={{ width: "100%", maxWidth: "none", mx: 0, display: "flex", flexDirection: "column", gap: { xs: 1, sm: 1.25 }, px: { xs: 1, sm: 0 } }}>

        {/* Header / Navbar — Mobile-optimized sticky header */}
        <Paper
          elevation={0}
          sx={{
            position: { xs: "sticky", sm: "relative" },
            top: { xs: 0, sm: "auto" },
            zIndex: 100,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            p: { xs: 1.25, sm: 1.75 },
            px: { xs: 1.5, sm: 2 },
            gap: { xs: 0.75, sm: 1.25 },
            borderRadius: { xs: "0 0 16px 16px", sm: "20px" },
            background: "rgba(13, 19, 33, 0.78)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderTop: { xs: "none", sm: "1px solid rgba(255, 255, 255, 0.04)" },
          }}
        >
          {/* Left: Logo + Branding */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 }, minWidth: 0, flex: "0 1 auto" }}>
            <Box
              sx={{
                p: { xs: 0.8, sm: 1.2 },
                backgroundColor: "rgba(0, 193, 106, 0.08)",
                color: "primary.main",
                borderRadius: { xs: "11px", sm: "14px" },
                filter: "drop-shadow(0 0 11px rgba(0, 193, 106, 0.2))",
                display: "flex",
                flexShrink: 0
              }}
            >
              <Zap size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontFamily: "Outfit, sans-serif",
                  background: "linear-gradient(90deg, #fff 0%, #e2e8f0 70%, #00c16a 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  lineHeight: 1.2,
                  fontSize: { xs: "1rem", sm: "1.28rem" },
                  whiteSpace: "nowrap"
                }}
              >
                Bitkub API Hub
              </Typography>
              <Typography sx={{ fontSize: { xs: "9px", sm: "11px" }, color: "text.secondary", fontWeight: 600, letterSpacing: "0.1em", mt: 0.3, fontFamily: "monospace", display: { xs: "none", sm: "block" } }}>
                DEVELOPER TRADING TERMINAL
              </Typography>
            </Box>
          </Box>

          {/* Center: Navigation Links (Desktop only) */}
          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.75 }}>
            {[
              { id: "bot", label: "Bot Trade", icon: <Bot size={14} /> },
              { id: "manual", label: "Manual Trade", icon: <Send size={14} /> },
              { id: "settings", label: "Settings", icon: <Sliders size={14} /> },
            ].map((item) => {
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  onClick={() => setActiveView(item.id as DashboardView)}
                  startIcon={item.icon}
                  sx={{
                    fontSize: "13.5px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "primary.main" : "text.secondary",
                    px: 2,
                    py: 0.8,
                    borderRadius: "11px",
                    backgroundColor: isActive ? "rgba(0, 193, 106, 0.05)" : "transparent",
                    border: isActive ? "1px solid rgba(0, 193, 106, 0.1)" : "1px solid transparent",
                    transition: "all 0.2s ease",
                    textTransform: "none",
                    "&:hover": {
                      color: "primary.main",
                      backgroundColor: "rgba(0, 193, 106, 0.04)",
                    }
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          {/* Right: Status chips + Logout — compact on mobile */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 1.5 }, flexShrink: 0 }}>
            {/* Connection dot indicator (mobile only) */}
            <Box sx={{ display: { xs: "flex", sm: "none" }, alignItems: "center" }}>
              <Box sx={{
                width: 9, height: 9, borderRadius: "50%",
                backgroundColor: connectionStatus === "connected" ? "#00c16a" : "#ef5b63",
                boxShadow: connectionStatus === "connected" ? "0 0 6px rgba(0, 193, 106, 0.5)" : "0 0 6px rgba(239, 91, 99, 0.5)",
                flexShrink: 0
              }} />
            </Box>

            {/* Desktop-only chips */}
            <Chip
              icon={<User size={13} style={{ color: "#00c16a" }} />}
              label={username}
              variant="outlined"
              sx={{
                fontSize: "12px",
                fontWeight: 500,
                borderColor: "rgba(255, 255, 255, 0.06)",
                backgroundColor: "rgba(255, 255, 255, 0.015)",
                color: "text.primary",
                display: { xs: "none", sm: "inline-flex" },
                height: 28
              }}
            />

            {connectionStatus === "connected" ? (
              <Chip
                icon={<Link size={13} style={{ color: "#00c16a" }} />}
                label="API: CONNECTED"
                variant="outlined"
                sx={{
                  fontSize: "12px",
                  fontWeight: 600,
                  borderColor: "rgba(0, 193, 106, 0.2)",
                  backgroundColor: "rgba(0, 193, 106, 0.05)",
                  color: "primary.main",
                  display: { xs: "none", sm: "inline-flex" },
                  height: 28
                }}
              />
            ) : (
              <Tooltip title={connectionMsg || "Bitkub API Connection disconnected"}>
                <Chip
                  icon={<Link size={13} style={{ color: "#ef5b63" }} />}
                  label="API: DISCONNECTED"
                  variant="outlined"
                  sx={{
                    fontSize: "12px",
                    fontWeight: 600,
                    borderColor: "rgba(239, 91, 99, 0.2)",
                    backgroundColor: "rgba(239, 91, 99, 0.05)",
                    color: "error.main",
                    display: { xs: "none", sm: "inline-flex" },
                    height: 28,
                    cursor: "help"
                  }}
                />
              </Tooltip>
            )}

            <Tooltip title="System Monitor">
              <IconButton
                onClick={() => setMonitorOpen(true)}
                size="small"
                sx={{
                  color: "text.secondary",
                  border: "1px solid rgba(255,255,255,0.06)",
                  backgroundColor: "rgba(255,255,255,0.015)",
                  width: 32,
                  height: 32,
                  "&:hover": {
                    color: "primary.main",
                    backgroundColor: "rgba(0, 193, 106, 0.05)",
                    borderColor: "rgba(0, 193, 106, 0.16)",
                  },
                }}
              >
                <Terminal size={16} />
              </IconButton>
            </Tooltip>

            {/* Logout: icon-only on mobile, full button on desktop */}
            <IconButton
              onClick={handleLogout}
              size="small"
              sx={{
                display: { xs: "flex", sm: "none" },
                color: "error.main",
                border: "1px solid rgba(239, 91, 99, 0.15)",
                backgroundColor: "rgba(239, 91, 99, 0.03)",
                borderRadius: "11px",
                width: 34,
                height: 34,
                "&:hover": {
                  backgroundColor: "rgba(239, 91, 99, 0.1)",
                }
              }}
            >
              <LogOut size={15} />
            </IconButton>
            <Button
              onClick={handleLogout}
              variant="outlined"
              startIcon={<LogOut size={14} />}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                fontSize: "12px",
                fontWeight: 500,
                color: "error.main",
                borderColor: "rgba(239, 91, 99, 0.15)",
                backgroundColor: "rgba(239, 91, 99, 0.03)",
                borderRadius: "12px",
                px: 2,
                py: 0.8
              }}
            >
              ออกจากระบบ
            </Button>
          </Box>
        </Paper>

        {/* KPI Metrics Box Layout */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              md: "repeat(5, 1fr)"
            },
            gap: { xs: 0.75, sm: 1 }
          }}
        >
          {/* Card 0: Total Assets Valuation */}
          <Box sx={{ gridColumn: { xs: "span 2", md: "span 1" } }}>
            <Card
              sx={{
                background: "radial-gradient(circle at 50% 35%, rgba(0, 193, 106, 0.07) 0%, transparent 60%), radial-gradient(rgba(255, 255, 255, 0.012) 1px, transparent 0), rgba(8, 12, 20, 0.72)",
                backgroundSize: "100% 100%, 14px 14px, 100% 100%",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(0, 193, 106, 0.18)",
                borderRadius: "16px",
                boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.15)",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "primary.main",
                  boxShadow: "0 8px 30px 0 rgba(0, 193, 106, 0.12)"
                }
              }}
            >
              <CardContent sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: { xs: "center", sm: "space-between" }, alignItems: "center", gap: { xs: 1.5, sm: 2 }, p: { xs: 2.5, sm: 1.6 }, "&:last-child": { pb: { xs: 2.5, sm: 1.6 } } }}>
                <Box sx={{ order: { xs: 2, sm: 1 }, display: "flex", flexDirection: "column", alignItems: { xs: "center", sm: "flex-start" } }}>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    มูลค่าทั้งหมด
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 0.75, mt: 0.5 }}>
                    <Typography variant="h5" sx={{ fontSize: { xs: "1.42rem", sm: "1.32rem" }, fontWeight: 700, color: "text.primary", fontFamily: "monospace", textShadow: "0 0 12px rgba(255, 255, 255, 0.15)" }}>
                      {totalThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: "0.78rem", color: "text.secondary", fontWeight: 500 }}>
                      THB โดยประมาณ
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ order: { xs: 1, sm: 2 }, p: 1.5, borderRadius: "12px", backgroundColor: "rgba(255, 255, 255, 0.03)", color: "text.secondary", display: "flex", filter: { xs: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.05))", sm: "none" } }}>
                  <Inbox size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 1: Available Cash */}
          <Box>
            <Card
              sx={{
                background: "rgba(8, 12, 20, 0.72)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "16px",
                boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.15)",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "rgba(0, 193, 106, 0.25)",
                  boxShadow: "0 6px 25px 0 rgba(0, 193, 106, 0.08)"
                }
              }}
            >
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: { xs: 1.25, sm: 1.6 }, "&:last-child": { pb: { xs: 1.25, sm: 1.6 } } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    เงินสด THB พร้อมใช้
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 0.5 }}>
                    <Typography variant="h5" sx={{ fontSize: { xs: "1.12rem", sm: "1.32rem" }, fontWeight: 600, color: "primary.main", fontFamily: "monospace", textShadow: "0 0 11px rgba(0, 193, 106, 0.2)" }}>
                      {cashThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: "0.74rem", color: "text.secondary", fontWeight: 500 }}>
                      THB
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(0, 193, 106, 0.08)", color: "primary.main", display: "flex" }}>
                  <Wallet size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 2: Bot Managed Value */}
          <Box>
            <Card
              sx={{
                background: "rgba(8, 12, 20, 0.72)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "16px",
                boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.15)",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "rgba(0, 193, 106, 0.25)",
                  boxShadow: "0 6px 25px 0 rgba(0, 193, 106, 0.08)"
                }
              }}
            >
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: { xs: 1.25, sm: 1.6 }, "&:last-child": { pb: { xs: 1.25, sm: 1.6 } } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.8, display: "block" }}>
                    มูลค่าบอทดูแลอยู่
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 0.5 }}>
                    <Typography variant="h5" sx={{ fontSize: { xs: "1.12rem", sm: "1.32rem" }, fontWeight: 600, color: "primary.main", fontFamily: "monospace", textShadow: "0 0 11px rgba(0, 193, 106, 0.2)" }}>
                      {botLockedThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: "0.74rem", color: "text.secondary", fontWeight: 500 }}>
                      THB โดยประมาณ
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(0, 193, 106, 0.08)", color: "primary.main", display: "flex" }}>
                  <TrendingUp size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 3: Auto Bot Run State */}
          <Box>
            <Card sx={{
              background: "rgba(8, 12, 20, 0.72)",
              backdropFilter: "blur(24px)",
              borderRadius: "16px",
              boxShadow: botConfig.is_running
                ? "0 4px 20px rgba(0, 193, 106, 0.05)"
                : "0 4px 20px rgba(0, 0, 0, 0.15)",
              border: botConfig.is_running
                ? "1px solid rgba(0, 193, 106, 0.25)"
                : "1px solid rgba(255, 255, 255, 0.04)",
              transition: "all 0.3s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: botConfig.is_running
                  ? "rgba(0, 193, 106, 0.4)"
                  : "rgba(255, 255, 255, 0.08)",
                boxShadow: botConfig.is_running
                  ? "0 6px 25px rgba(0, 193, 106, 0.12)"
                  : "0 6px 25px rgba(0, 0, 0, 0.25)"
              }
            }}>
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: { xs: 1.25, sm: 1.6 }, "&:last-child": { pb: { xs: 1.25, sm: 1.6 } } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.8, display: "block" }}>
                    สถานะบอทอัตโนมัติ
                  </Typography>
                  {botConfig.is_running ? (
                    <Chip
                      size="small"
                      label={botConfig.dry_run ? "RUNNING (DRY)" : "RUNNING (LIVE)"}
                      sx={{
                        fontSize: "11px",
                        height: "22px",
                        fontWeight: 600,
                        backgroundColor: "rgba(0, 193, 106, 0.12)",
                        color: "#00c16a",
                        border: "1px solid rgba(0, 193, 106, 0.2)"
                      }}
                    />
                  ) : (
                    <Chip
                      size="small"
                      label={botConfig.dry_run ? "STOPPED (DRY)" : "STOPPED (LIVE)"}
                      sx={{
                        fontSize: "11px",
                        height: "22px",
                        fontWeight: 600,
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        color: "text.secondary",
                        border: "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    />
                  )}
                </Box>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "12px",
                    backgroundColor: botConfig.is_running ? "rgba(0, 193, 106, 0.08)" : "rgba(255, 255, 255, 0.03)",
                    color: botConfig.is_running ? "#00c16a" : "text.secondary",
                    display: "flex",
                    transition: "all 0.3s ease"
                  }}
                >
                  <Bot size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Card 4: Positions Held */}
          <Box>
            <Card
              sx={{
                background: "rgba(8, 12, 20, 0.72)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "16px",
                boxShadow: "0 4px 20px 0 rgba(0, 0, 0, 0.15)",
                transition: "all 0.3s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "rgba(129, 140, 248, 0.25)",
                  boxShadow: "0 6px 25px 0 rgba(129, 140, 248, 0.08)"
                }
              }}
            >
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: { xs: 1.25, sm: 1.6 }, "&:last-child": { pb: { xs: 1.25, sm: 1.6 } } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    เหรียญที่ถืออยู่
                  </Typography>
                  <Typography variant="h5" sx={{ fontSize: { xs: "1.12rem", sm: "1.32rem" }, fontWeight: 600, mt: 0.5, color: "#818cf8", fontFamily: "monospace", textShadow: "0 0 11px rgba(129, 140, 248, 0.2)" }}>
                    {positions.length} เหรียญ
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: "12px", backgroundColor: "rgba(129, 140, 248, 0.08)", color: "#818cf8", display: "flex" }}>
                  <Inbox size={20} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {activeView === "bot" && (
          <BotTradeView
            botConfig={botConfig}
            positions={positions}
            history={history}
            handleBotToggle={handleBotToggle}
            handleSaveBotSettings={handleSaveBotSettings}
            handleOpenConfirmPanic={handleOpenConfirmPanic}
            updateBotConfigDraft={updateBotConfigDraft}
            setActiveView={setActiveView}
            dataLoading={dataLoading}
          />
        )}

        {activeView === "manual" && (
          <ManualTradeView
            actionLoading={actionLoading}
            balances={balances}
            calculatePercentage={calculatePercentage}
            filterTradeSymbolOptions={filterTradeSymbolOptions}
            filteredMarketTickers={filteredMarketTickers}
            handleOpenConfirmManual={handleOpenConfirmManual}
            marketPage={marketPage}
            marketSearch={marketSearch}
            setMarketPage={setMarketPage}
            setMarketSearch={setMarketSearch}
            setTradeAmount={setTradeAmount}
            setTradePrice={setTradePrice}
            setTradeSide={setTradeSide}
            setTradeSymbol={setTradeSymbol}
            setTradeType={setTradeType}
            sortedTickers={sortedTickers}
            tickers={tickers}
            tradeAmount={tradeAmount}
            tradePrice={tradePrice}
            tradeSide={tradeSide}
            tradeSymbol={tradeSymbol}
            tradeSymbolOptions={tradeSymbolOptions}
            tradeType={tradeType}
            wsConnected={wsConnected}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            botConfig={botConfig}
            updateBotConfigDraft={updateBotConfigDraft}
            actionLoading={dataLoading}
            autoSaveState={settingsSaveState}
            allSymbols={tradeSymbolOptions}
          />
        )}

        {/* Footer */}
        <Footer
          wsConnected={wsConnected}
          backendConnected={connectionStatus === "connected"}
          activeView={activeView}
          setActiveView={setActiveView}
        />

      </Box>

      <Dialog
        open={monitorOpen}
        onClose={() => setMonitorOpen(false)}
        fullWidth
        maxWidth="xl"
        sx={{
          "& .MuiDialog-paper": {
            background: "rgba(8, 12, 20, 0.96)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "16px",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.55)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, color: "text.primary", fontFamily: "Outfit, sans-serif", fontWeight: 700 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Terminal size={18} style={{ color: "#00c16a" }} />
            System Monitor
          </Box>
          <IconButton
            onClick={() => setMonitorOpen(false)}
            size="small"
            sx={{
              color: "text.secondary",
              width: 32,
              height: 32,
              borderRadius: "50%",
              transition: "all 0.2s ease",
              "&:hover": {
                color: "text.primary",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
              },
            }}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0, pb: 2 }}>
          <LogsView botLogs={botLogs} botLogsRef={botLogsRef} clearDevLogs={clearDevLogs} devLogs={devLogs} devLogsRef={devLogsRef} />
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------
          Confirmation Dialog Modals (Material UI)
         ---------------------------------------------------- */}

      {/* 1. Manual Trade Confirmation */}
      <Dialog
        open={confirmManualOpen}
        onClose={() => setConfirmManualOpen(false)}
      >
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: "1.1rem" }} className="text-sky-400 flex items-center gap-2">
          <Info size={20} /> ยืนยันการส่งคำสั่งเทรด
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary", fontSize: "0.95rem", mt: 1, lineHeight: 1.6 }}>
            คุณต้องการส่งคำสั่ง <strong>{tradeSide.toUpperCase()} {tradeSymbol}</strong>
            ประเภท <strong>{tradeType.toUpperCase()}</strong> จำนวน <strong>{tradeAmount} {tradeSide === "buy" ? "THB" : (tradeSymbol ? tradeSymbol.split("/")[0] : "")}</strong>
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
              fontSize: "0.85rem"
            }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleExecuteManualTrade}
            autoFocus
            variant="contained"
            sx={{
              color: "#17201a",
              backgroundColor: "primary.main",
              borderRadius: "12px",
              px: 3,
              fontWeight: 600,
              fontSize: "0.85rem"
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
            borderColor: "rgba(239, 91, 99, 0.2)"
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: "Outfit, sans-serif", fontWeight: 600, fontSize: "1.1rem" }} className="text-rose-400 flex items-center gap-2">
          <Info size={20} style={{ color: "#ef5b63" }} /> ยืนยันการทำ Panic Sell
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary", fontSize: "0.95rem", mt: 1, lineHeight: 1.6 }}>
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
              fontSize: "0.85rem"
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
              fontWeight: 600,
              fontSize: "0.85rem"
            }}
          >
            ยืนยัน Panic Sell
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
