"use client";

import React, { useState, useEffect, useRef, useCallback, useDeferredValue, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
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
import { Footer } from "./components/Footer";
import { useToast } from "./components/Toast";
import { useBitkubWebSocket } from "./hooks/useBitkubWebSocket";
import type { BotConfig } from "./components/dashboardTypes";

const BotTradeView = dynamic(() => import("./components/BotTradeView").then((mod) => mod.BotTradeView));
const LogsView = dynamic(() => import("./components/LogsView").then((mod) => mod.LogsView));
const ManualTradeView = dynamic(() => import("./components/ManualTradeView").then((mod) => mod.ManualTradeView));
const SettingsView = dynamic(() => import("./components/SettingsView").then((mod) => mod.SettingsView));
const WalletView = dynamic(() => import("./components/WalletView").then((mod) => mod.WalletView));

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

type DashboardView = "bot" | "manual" | "wallet" | "settings";
type PreloadableComponent = { preload?: () => void };

const DEFAULT_TRADE_SYMBOL_OPTIONS = ["BTC/THB", "ETH/THB", "KUB/THB", "XRP/THB", "USDT/THB"];
const DASHBOARD_ROUTES: Record<DashboardView, string> = {
  bot: "/bot",
  manual: "/manual",
  wallet: "/wallet",
  settings: "/settings",
};

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

interface AiWatchlistItem {
  id: number;
  symbol: string;
  mode: string;
  decision: string;
  score: number;
  confidence: number;
  reason: string;
  replace_candidate?: string;
  last_price: number;
  status: string;
  created_at: string;
  updated_at: string;
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

function getDashboardView(pathname: string | null): DashboardView {
  if (pathname?.startsWith("/manual")) return "manual";
  if (pathname?.startsWith("/wallet")) return "wallet";
  if (pathname?.startsWith("/settings")) return "settings";
  return "bot";
}

export default function DashboardPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const routeView = useMemo(() => getDashboardView(pathname), [pathname]);
  const [optimisticView, setOptimisticView] = useState<DashboardView>(routeView);

  // ----------------------------------------------------
  // States
  // ----------------------------------------------------
  const [username, setUsername] = useState("Loading...");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected");
  const [connectionMsg, setConnectionMsg] = useState("");
  const [botConfig, setBotConfig] = useState<BotConfig>({
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
    market_universe_mode: "fixed",
    top_gainers_limit: 20,
    timeframe: "15",
    strategy: "multi_indicator",
    ai_enabled: false,
    ai_provider: "gemini",
    ai_model: "gemini-3.5-flash",
    ai_min_score: 65,
    ai_min_confidence: 0.55,
    ai_timeout_seconds: 8,
    trailing_stop_enabled: true,
    trailing_activation_pct: 3,
    trailing_stop_pct: 2,
    cooldown_enabled: true,
    cooldown_minutes: 30,
    cooldown_after_loss_only: true,
    regime_filter_enabled: true,
    regime_action: "block",
    regime_reduce_factor: 0.5,
  });
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const tickersRef = useRef<Record<string, TickerData>>({});
  const [tradeSymbolOptions, setTradeSymbolOptions] = useState<string[]>(DEFAULT_TRADE_SYMBOL_OPTIONS);
  const activeView = optimisticView;
  const setActiveView = useCallback((nextView: DashboardView) => {
    if (nextView === activeView) return;
    setOptimisticView(nextView);
    React.startTransition(() => {
      router.push(DASHBOARD_ROUTES[nextView]);
    });
  }, [activeView, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOptimisticView(routeView);
    }, 0);
    return () => clearTimeout(timer);
  }, [routeView]);

  useEffect(() => {
    Object.values(DASHBOARD_ROUTES).forEach((route) => {
      router.prefetch(route);
    });

    const preloadViews = () => {
      [BotTradeView, ManualTradeView, WalletView, SettingsView, LogsView].forEach((Component) => {
        (Component as unknown as PreloadableComponent).preload?.();
      });
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadViews, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = setTimeout(preloadViews, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  // Manual Trade Form States
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeType, setTradeType] = useState<"market" | "limit">("market");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const selectedStreamSymbols = useMemo(() => {
    if (activeView === "settings" || activeView === "wallet") return [];

    return Array.from(new Set([
      ...(activeView === "manual" && tradeSymbol ? [tradeSymbol] : []),
      ...(activeView === "bot" ? positions.map((pos) => pos.symbol).filter(Boolean) : []),
    ]));
  }, [activeView, positions, tradeSymbol]);
  const realtimeRequired = activeView === "manual" || (activeView === "bot" && selectedStreamSymbols.length > 0);

  // WebSocket for real-time ticker prices
  const handleTickerUpdate = useCallback((newTickers: Record<string, TickerData>) => {
    const nextTickers = { ...tickersRef.current, ...newTickers };
    tickersRef.current = nextTickers;

    const nextSymbols = Object.keys(nextTickers).sort();
    if (nextSymbols.length > 0) {
      setTradeSymbolOptions((prev) => {
        if (prev.length === nextSymbols.length && prev.every((symbol, index) => symbol === nextSymbols[index])) {
          return prev;
        }
        return nextSymbols;
      });
    }

    React.startTransition(() => {
      setTickers(nextTickers);
    });
  }, []);
  const { isConnected: wsConnected } = useBitkubWebSocket(handleTickerUpdate, selectedStreamSymbols, {
    enabled: activeView !== "settings" && activeView !== "wallet",
    includeBaseSymbols: activeView === "manual",
  });
  const deferredTickers = useDeferredValue(tickers);
  const sortedTickers = useMemo(() => {
    if (activeView !== "manual") return [];
    return Object.entries(deferredTickers).sort((a, b) => (b[1].quoteVolume ?? 0) - (a[1].quoteVolume ?? 0));
  }, [activeView, deferredTickers]);
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

  const investedThb = useMemo(() => {
    return balances.reduce((sum, item) => {
      if (item.asset === "THB") return sum;

      const ticker = tickers[`${item.asset}/THB`];
      const price = ticker?.last || ticker?.bid || 0;
      const value = item.total * price;

      const flooredValue = Math.floor(Math.max(0, value) * 100) / 100;
      return sum + flooredValue;
    }, 0);
  }, [balances, tickers]);

  const totalThb = useMemo(() => {
    return balances.reduce((sum, item) => {
      if (item.asset === "THB") return sum + item.total;

      const ticker = tickers[`${item.asset}/THB`];
      const price = ticker?.last || ticker?.bid || 0;
      const value = item.total * price;

      const flooredValue = Math.floor(Math.max(0, value) * 100) / 100;
      return sum + flooredValue;
    }, 0);
  }, [balances, tickers]);
  const livePositions = useMemo(() => {
    return positions.map((pos) => {
      const ticker = tickers[pos.symbol];
      const currentPrice = Number(ticker?.last || ticker?.bid || pos.current_price || 0);
      const buyPrice = Number(pos.buy_price || pos.entry_price || 0);
      const amount = Number(pos.amount || 0);
      const buyValue = amount * buyPrice;

      if (currentPrice <= 0 || buyPrice <= 0 || amount <= 0 || buyValue <= 0) {
        return pos;
      }

      const pnlThb = (amount * currentPrice * 0.9975) - buyValue;
      const pnlPct = (pnlThb / buyValue) * 100;

      return {
        ...pos,
        current_price: currentPrice,
        pnl_thb: pnlThb,
        pnl_pct: pnlPct,
        pnl_percent: pnlPct,
      };
    });
  }, [positions, tickers]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [aiWatchlist, setAiWatchlist] = useState<AiWatchlistItem[]>([]);
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [botLogs, setBotLogs] = useState<string[]>([]);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
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
  const hasCompletedInitialLoadRef = useRef(false);
  const [, setBotConfigDirty] = useState(false);
  const [settingsSaveState, setSettingsSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const botConfigDirtyRef = useRef(false);
  const latestBotConfigRef = useRef(botConfig);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveVersionRef = useRef(0);
  const saveRequestSeqRef = useRef(0);

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

    const entry = `<div class="developer-log-entry"><span class="developer-log-time text-slate-500">[${ts}]</span> <span class="developer-log-message ${styleClass}">${msg}</span></div>`;
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
          timeframe: data.timeframe || "15",
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
          market_universe_mode: data.market_universe_mode === "top_gainers" ? "top_gainers" : "fixed",
          top_gainers_limit: data.top_gainers_limit ?? 20,
          strategy: data.strategy || "multi_indicator",
          ai_enabled: data.ai_enabled === true,
          ai_provider: data.ai_provider || "gemini",
          ai_model: data.ai_model || "gemini-3.5-flash",
          ai_min_score: data.ai_min_score ?? 65,
          ai_min_confidence: data.ai_min_confidence ?? 0.55,
          ai_timeout_seconds: data.ai_timeout_seconds ?? 8,
          trailing_stop_enabled: data.trailing_stop_enabled ?? true,
          trailing_activation_pct: data.trailing_activation_pct ?? 3,
          trailing_stop_pct: data.trailing_stop_pct ?? 2,
          cooldown_enabled: data.cooldown_enabled ?? true,
          cooldown_minutes: data.cooldown_minutes ?? 30,
          cooldown_after_loss_only: data.cooldown_after_loss_only ?? true,
          regime_filter_enabled: data.regime_filter_enabled ?? true,
          regime_action: data.regime_action || "block",
          regime_reduce_factor: data.regime_reduce_factor ?? 0.5,
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
          const nextTickers = data.tickers || {};
          tickersRef.current = nextTickers;
          const nextSymbols = Object.keys(nextTickers).sort();
          if (nextSymbols.length > 0) {
            setTradeSymbolOptions(nextSymbols);
          }
          return nextTickers;
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

  const fetchAiWatchlist = async () => {
    try {
      const res = await fetch("/api/bot/ai-watchlist");
      if (handleApiError(res)) return;
      const data = await res.json();
      const parsed: AiWatchlistItem[] = (data || []).map((item: any) => ({
        id: Number(item.id || 0),
        symbol: item.symbol || "",
        mode: item.mode || "",
        decision: item.decision || "watch",
        score: Number(item.score || 0),
        confidence: Number(item.confidence || 0),
        reason: item.reason || "",
        replace_candidate: item.replace_candidate || "",
        last_price: Number(item.last_price || 0),
        status: item.status || "active",
        created_at: item.created_at || "",
        updated_at: item.updated_at || "",
      }));
      setAiWatchlist(parsed);
    } catch (err) {
      addDevLog("ดึง AI watchlist ของบอทล้มเหลว", "error");
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
    let isCancelled = false;

    const loadInitialData = async () => {
      const initialRequests: Promise<void>[] = [
        fetchUserProfile(),
        fetchConnectionStatus(),
        fetchBotConfig(),
        fetchBalances(),
      ];

      if (activeView === "bot") {
        initialRequests.push(fetchBotPositions(), fetchBotHistory(), fetchAiWatchlist(), fetchBotLogs());
      }

      if (activeView === "manual" || activeView === "wallet" || activeView === "settings") {
        initialRequests.push(fetchTickers());
      }

      await Promise.allSettled(initialRequests);
      if (isCancelled) return;

      if (!hasCompletedInitialLoadRef.current) {
        hasCompletedInitialLoadRef.current = true;
        addDevLog("แผงควบคุมแดชบอร์ด Next.js เริ่มต้นทำงานสำเร็จ", "success");
        setInitialLoading(false);
      }
    };

    loadInitialData();

    const intervals: ReturnType<typeof setInterval>[] = [];

    if (activeView === "bot") {
      intervals.push(setInterval(fetchBotLogs, 4000));
      intervals.push(setInterval(() => {
        fetchBotPositions();
        fetchBotConfig();
        fetchAiWatchlist();
      }, 5000));
      intervals.push(setInterval(() => {
        fetchConnectionStatus();
        fetchBotHistory();
      }, 10000));
      intervals.push(setInterval(fetchBalances, 15000));
    } else if (activeView === "manual") {
      intervals.push(setInterval(fetchConnectionStatus, 10000));
      intervals.push(setInterval(fetchBalances, 15000));
    } else if (activeView === "wallet") {
      intervals.push(setInterval(fetchConnectionStatus, 10000));
      intervals.push(setInterval(fetchBalances, 15000));
      intervals.push(setInterval(fetchTickers, 15000));
    } else {
      intervals.push(setInterval(() => {
        fetchConnectionStatus();
        fetchBotConfig();
      }, 15000));
    }

    return () => {
      isCancelled = true;
      intervals.forEach(clearInterval);
    };
  }, [activeView]);

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
    const saveSeq = saveRequestSeqRef.current + 1;
    saveRequestSeqRef.current = saveSeq;
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
          market_universe_mode: configToSave.market_universe_mode || "fixed",
          top_gainers_limit: Number(configToSave.top_gainers_limit ?? 20),
          strategy: configToSave.strategy,
          ai_enabled: configToSave.ai_enabled,
          ai_provider: configToSave.ai_provider,
          ai_model: configToSave.ai_model,
          ai_min_score: Number(configToSave.ai_min_score),
          ai_min_confidence: Number(configToSave.ai_min_confidence),
          ai_timeout_seconds: Number(configToSave.ai_timeout_seconds),
          trailing_stop_enabled: configToSave.trailing_stop_enabled ?? true,
          trailing_activation_pct: Number(configToSave.trailing_activation_pct ?? 3),
          trailing_stop_pct: Number(configToSave.trailing_stop_pct ?? 2),
          cooldown_enabled: configToSave.cooldown_enabled ?? true,
          cooldown_minutes: Number(configToSave.cooldown_minutes ?? 30),
          cooldown_after_loss_only: configToSave.cooldown_after_loss_only ?? true,
          regime_filter_enabled: configToSave.regime_filter_enabled ?? true,
          regime_action: configToSave.regime_action || "block",
          regime_reduce_factor: Number(configToSave.regime_reduce_factor ?? 0.5),
        }),
      });
      if (handleApiError(res)) return;
      const data = await res.json();
      const isLatestSave = saveRequestSeqRef.current === saveSeq;
      if (data.status === "success") {
        if (!isLatestSave) return;

        const latestConfig = latestBotConfigRef.current;
        const savedStillMatchesLatest =
          configToSave.dry_run === latestConfig.dry_run &&
          Number(configToSave.stake_amount_thb) === Number(latestConfig.stake_amount_thb) &&
          Number(configToSave.stop_loss_pct) === Number(latestConfig.stop_loss_pct) &&
          Number(configToSave.take_profit_pct) === Number(latestConfig.take_profit_pct) &&
          Number(configToSave.max_open_trades) === Number(latestConfig.max_open_trades) &&
          Number(configToSave.max_budget_thb) === Number(latestConfig.max_budget_thb) &&
          configToSave.strategy === latestConfig.strategy &&
          configToSave.ai_enabled === latestConfig.ai_enabled &&
          configToSave.ai_provider === latestConfig.ai_provider &&
          configToSave.ai_model === latestConfig.ai_model &&
          Number(configToSave.ai_min_score) === Number(latestConfig.ai_min_score) &&
          Number(configToSave.ai_min_confidence) === Number(latestConfig.ai_min_confidence) &&
          Number(configToSave.ai_timeout_seconds) === Number(latestConfig.ai_timeout_seconds) &&
          (configToSave.trailing_stop_enabled ?? true) === (latestConfig.trailing_stop_enabled ?? true) &&
          Number(configToSave.trailing_activation_pct ?? 3) === Number(latestConfig.trailing_activation_pct ?? 3) &&
          Number(configToSave.trailing_stop_pct ?? 2) === Number(latestConfig.trailing_stop_pct ?? 2) &&
          (configToSave.cooldown_enabled ?? true) === (latestConfig.cooldown_enabled ?? true) &&
          Number(configToSave.cooldown_minutes ?? 30) === Number(latestConfig.cooldown_minutes ?? 30) &&
          (configToSave.cooldown_after_loss_only ?? true) === (latestConfig.cooldown_after_loss_only ?? true) &&
          (configToSave.regime_filter_enabled ?? true) === (latestConfig.regime_filter_enabled ?? true) &&
          (configToSave.regime_action || "block") === (latestConfig.regime_action || "block") &&
          Number(configToSave.regime_reduce_factor ?? 0.5) === Number(latestConfig.regime_reduce_factor ?? 0.5) &&
          (configToSave.market_universe_mode || "fixed") === (latestConfig.market_universe_mode || "fixed") &&
          Number(configToSave.top_gainers_limit ?? 20) === Number(latestConfig.top_gainers_limit ?? 20) &&
          JSON.stringify(configToSave.symbols || []) === JSON.stringify(latestConfig.symbols || []);

        if (savedStillMatchesLatest) {
          botConfigDirtyRef.current = false;
          setBotConfigDirty(false);
        }

        if (data.config && savedStillMatchesLatest) {
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
            market_universe_mode: data.config.market_universe_mode === "top_gainers" ? "top_gainers" : "fixed",
            top_gainers_limit: data.config.top_gainers_limit ?? prev.top_gainers_limit,
            timeframe: data.config.timeframe || prev.timeframe,
            strategy: data.config.strategy || prev.strategy,
            ai_enabled: data.config.ai_enabled === true,
            ai_provider: data.config.ai_provider || prev.ai_provider,
            ai_model: data.config.ai_model || prev.ai_model,
            ai_min_score: data.config.ai_min_score ?? prev.ai_min_score,
            ai_min_confidence: data.config.ai_min_confidence ?? prev.ai_min_confidence,
            ai_timeout_seconds: data.config.ai_timeout_seconds ?? prev.ai_timeout_seconds,
            trailing_stop_enabled: data.config.trailing_stop_enabled ?? prev.trailing_stop_enabled,
            trailing_activation_pct: data.config.trailing_activation_pct ?? prev.trailing_activation_pct,
            trailing_stop_pct: data.config.trailing_stop_pct ?? prev.trailing_stop_pct,
            cooldown_enabled: data.config.cooldown_enabled ?? prev.cooldown_enabled,
            cooldown_minutes: data.config.cooldown_minutes ?? prev.cooldown_minutes,
            cooldown_after_loss_only: data.config.cooldown_after_loss_only ?? prev.cooldown_after_loss_only,
            regime_filter_enabled: data.config.regime_filter_enabled ?? prev.regime_filter_enabled,
            regime_action: data.config.regime_action || prev.regime_action,
            regime_reduce_factor: data.config.regime_reduce_factor ?? prev.regime_reduce_factor,
          }));
        }

        if (activeView === "bot") {
          await Promise.allSettled([
            fetchBalances(),
            fetchBotPositions(),
            fetchBotHistory(),
            fetchAiWatchlist(),
          ]);
        }

        if (silent && savedStillMatchesLatest) {
          setSettingsSaveState("saved");
        } else if (!silent) {
          addDevLog("บันทึกการตั้งค่าบอทสำเร็จ", "success");
          addToast({ type: "success", title: "บันทึกการตั้งค่าสำเร็จ", message: "อัปเดตพารามิเตอร์บอทเรียบร้อยแล้ว" });
        }
      }
    } catch (err) {
      if (saveRequestSeqRef.current !== saveSeq) return;
      setSettingsSaveState("error");
      addDevLog("บันทึกการตั้งค่าบอทขัดข้อง", "error");
      if (!silent) {
        addToast({ type: "error", title: "บันทึกล้มเหลว", message: "ไม่สามารถบันทึกการตั้งค่าบอทได้" });
      }
    } finally {
      if (saveRequestSeqRef.current === saveSeq) {
        setDataLoading(false);
      }
    }
  };

  // Auto-save bot config (tabs 0-3) with debounce
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
    botConfig.market_universe_mode,
    botConfig.top_gainers_limit,
    botConfig.ai_enabled,
    botConfig.ai_provider,
    botConfig.ai_model,
    botConfig.ai_min_score,
    botConfig.ai_min_confidence,
    botConfig.ai_timeout_seconds,
    botConfig.trailing_stop_enabled,
    botConfig.trailing_activation_pct,
    botConfig.trailing_stop_pct,
    botConfig.cooldown_enabled,
    botConfig.cooldown_minutes,
    botConfig.cooldown_after_loss_only,
    botConfig.regime_filter_enabled,
    botConfig.regime_action,
    botConfig.regime_reduce_factor,
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
        fetchAiWatchlist();
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
  const pageMeta = {
    bot: {
      title: "Bot Trade",
      description: "Automated portfolio execution",
      icon: <Bot size={15} />,
    },
    manual: {
      title: "Manual Trade",
      description: "Realtime market order desk",
      icon: <Send size={15} />,
    },
    wallet: {
      title: "My Wallet",
      description: "Portfolio balance and asset allocation",
      icon: <Wallet size={15} />,
    },
    settings: {
      title: "Settings",
      description: "Risk controls and API preferences",
      icon: <Sliders size={15} />,
    },
  }[activeView];
  const navigationItems = [
    { id: "bot", label: "Bot Trade", icon: <Bot size={15} /> },
    { id: "manual", label: "Manual Trade", icon: <Send size={15} /> },
    { id: "wallet", label: "My Wallet", icon: <Wallet size={15} /> },
    { id: "settings", label: "Settings", icon: <Sliders size={15} /> },
  ] as const;

  return (
    <Box
      sx={{
        width: "100%",
        pt: { xs: 0, sm: 2 },
        pb: { xs: "88px", sm: 2 },
        px: { xs: 0, sm: 1.5, md: 2 },
        overflowX: "hidden",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
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
        {navigationItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <Button
              key={item.id}
              onClick={() => setActiveView(item.id)}
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

      <Box sx={{ width: "100%", maxWidth: "none", mx: 0, display: "flex", flexDirection: "column", flex: 1, gap: { xs: 1, sm: 1.25 }, px: { xs: 1, sm: 0 } }}>

        {/* Header / Navbar */}
        <Paper
          elevation={0}
          sx={{
            position: { xs: "sticky", sm: "relative" },
            top: { xs: 0, sm: "auto" },
            zIndex: 100,
            display: "flex",
            flexDirection: { xs: "row", md: "row" },
            justifyContent: "space-between",
            alignItems: "center",
            minHeight: { xs: 64, md: 72 },
            p: { xs: 1, sm: 1.25 },
            px: { xs: 1.25, sm: 1.5 },
            gap: { xs: 1, sm: 1.5 },
            borderRadius: { xs: "0 0 14px 14px", sm: "14px" },
            background: "rgba(8, 12, 20, 0.86)",
            backdropFilter: "blur(22px)",
            border: "1px solid rgba(148, 163, 184, 0.12)",
            borderTop: { xs: "none", sm: "1px solid rgba(148, 163, 184, 0.12)" },
            boxShadow: "0 10px 34px rgba(0, 0, 0, 0.24)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.25 }, minWidth: 0, flex: "1 1 260px" }}>
            <Box
              sx={{
                width: { xs: 38, sm: 42 },
                height: { xs: 38, sm: 42 },
                backgroundColor: "rgba(0, 193, 106, 0.1)",
                color: "primary.main",
                borderRadius: "12px",
                border: "1px solid rgba(0, 193, 106, 0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Zap size={18} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontFamily: "Outfit, sans-serif",
                  color: "text.primary",
                  lineHeight: 1.2,
                  fontSize: { xs: "0.98rem", sm: "1.18rem" },
                  whiteSpace: "nowrap",
                }}
              >
                Bitkub API Hub
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.35, minWidth: 0 }}>
                <Box sx={{ color: "text.secondary", display: { xs: "none", sm: "flex" }, flexShrink: 0 }}>
                  {pageMeta.icon}
                </Box>
                <Typography sx={{ fontSize: { xs: "0.72rem", sm: "0.78rem" }, color: "text.secondary", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <Box component="span" sx={{ color: "text.primary", display: { xs: "inline", sm: "none" } }}>
                    {pageMeta.title}
                  </Box>
                  <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                    {pageMeta.description}
                  </Box>
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 0.4,
              p: 0.45,
              borderRadius: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.035)",
              border: "1px solid rgba(255, 255, 255, 0.055)",
              flexShrink: 0,
            }}
          >
            {navigationItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  startIcon={item.icon}
                  sx={{
                    height: 36,
                    fontSize: "13px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#08110d" : "text.secondary",
                    px: 1.65,
                    borderRadius: "9px",
                    backgroundColor: isActive ? "primary.main" : "transparent",
                    border: "1px solid transparent",
                    boxShadow: isActive ? "0 7px 18px rgba(0, 193, 106, 0.18)" : "none",
                    transition: "all 0.2s ease",
                    textTransform: "none",
                    "& .MuiButton-startIcon": {
                      color: isActive ? "#08110d" : "text.secondary",
                      mr: 0.8,
                    },
                    "&:hover": {
                      color: isActive ? "#08110d" : "text.primary",
                      backgroundColor: isActive ? "primary.main" : "rgba(255, 255, 255, 0.055)",
                    }
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flex: "1 1 260px", minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                height: 40,
                p: 0.35,
                gap: 0.35,
                borderRadius: "13px",
                backgroundColor: "rgba(255, 255, 255, 0.035)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
                maxWidth: "100%",
              }}
            >
              <Tooltip title={connectionStatus === "connected" ? "Bitkub API connected" : connectionMsg || "Bitkub API disconnected"}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    height: 32,
                    px: { xs: 0.85, sm: 1 },
                    borderRadius: "10px",
                    backgroundColor: connectionStatus === "connected" ? "rgba(0, 193, 106, 0.08)" : "rgba(239, 91, 99, 0.07)",
                    border: `1px solid ${connectionStatus === "connected" ? "rgba(0, 193, 106, 0.16)" : "rgba(239, 91, 99, 0.16)"}`,
                    flexShrink: 0,
                  }}
                >
                  <Box sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: connectionStatus === "connected" ? "#00c16a" : "#ef5b63",
                    boxShadow: connectionStatus === "connected" ? "0 0 8px rgba(0, 193, 106, 0.7)" : "0 0 8px rgba(239, 91, 99, 0.55)",
                    flexShrink: 0,
                  }} />
                  <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.7rem", fontWeight: 800, color: connectionStatus === "connected" ? "primary.main" : "error.main", whiteSpace: "nowrap", lineHeight: 1 }}>
                    {connectionStatus === "connected" ? "API Online" : "API Offline"}
                  </Typography>
                </Box>
              </Tooltip>

              <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" }, borderColor: "rgba(255,255,255,0.08)", my: 0.75 }} />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 0.45, sm: 0.75 },
                  height: 32,
                  px: { xs: 0.35, sm: 0.85 },
                  borderRadius: "10px",
                  minWidth: 0,
                  maxWidth: { xs: 86, sm: 120, lg: 150 },
                }}
              >
                <Box sx={{ width: { xs: 20, sm: 22 }, height: { xs: 20, sm: 22 }, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: "rgba(0, 193, 106, 0.1)", color: "primary.main", flexShrink: 0 }}>
                  <User size={12} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.68rem", color: "text.secondary", lineHeight: 1, fontWeight: 600 }}>
                    Account
                  </Typography>
                  <Typography sx={{ fontSize: { xs: "0.72rem", sm: "0.76rem" }, color: "text.primary", lineHeight: 1.25, fontWeight: 700, maxWidth: { xs: 52, sm: 92 }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {username}
                  </Typography>
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ display: { xs: "block" }, borderColor: "rgba(255,255,255,0.08)", my: 0.75 }} />

              <Tooltip title="System Monitor">
                <IconButton
                  onClick={() => setMonitorOpen(true)}
                  size="small"
                  sx={{
                    color: "text.secondary",
                    width: 32,
                    height: 32,
                    borderRadius: "10px",
                    "&:hover": {
                      color: "primary.main",
                      backgroundColor: "rgba(0, 193, 106, 0.08)",
                    },
                  }}
                >
                  <Terminal size={16} />
                </IconButton>
              </Tooltip>

              <Tooltip title="ออกจากระบบ">
                <IconButton
                  onClick={handleLogout}
                  size="small"
                  sx={{
                    color: "error.main",
                    width: 32,
                    height: 32,
                    borderRadius: "10px",
                    "&:hover": {
                      backgroundColor: "rgba(239, 91, 99, 0.1)",
                    }
                  }}
                >
                  <LogOut size={15} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Paper>

        {/* KPI Metrics Box Layout */}
        {activeView !== "settings" && activeView !== "wallet" && (
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
                      {investedThb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        )}

        {activeView === "bot" && (
          <BotTradeView
            botConfig={botConfig}
            positions={livePositions}
            history={history}
            aiWatchlist={aiWatchlist}
            handleBotToggle={handleBotToggle}
            handleOpenConfirmPanic={handleOpenConfirmPanic}
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
            tickers={tickers}
            onSaveConfig={() => {
              const configSnapshot = latestBotConfigRef.current;
              handleSaveBotSettings(configSnapshot, { silent: true }).then(() => {
                window.setTimeout(() => {
                  setSettingsSaveState("idle");
                }, 2000);
              });
            }}
          />
        )}

        {activeView === "wallet" && (
          <WalletView
            dashboardInvestedThb={investedThb}
            dashboardTotalThb={totalThb}
            setActiveView={setActiveView}
          />
        )}

        {/* Footer */}
        <Footer
          wsConnected={wsConnected}
          backendConnected={connectionStatus === "connected"}
          activeView={activeView}
          wsRequired={realtimeRequired}
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
