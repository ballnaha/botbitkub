export interface BalanceItem {
  asset: string;
  free: number;
  used: number;
  total: number;
  locked_by_bot?: number;
  free_for_manual?: number;
}

export interface TickerData {
  last: number;
  bid?: number;
  ask?: number;
  high: number;
  low: number;
  percentage: number;
  quoteVolume: number;
}

export interface PositionItem {
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

export interface HistoryItem {
  timestamp: string;
  symbol: string;
  side: string;
  amount: number;
  buy_price?: number;
  price: number;
  total: number;
  pnl_thb: number | null;
  pnl_percent: number | null;
  reason: string;
  mode?: string;
  source?: string;
}

export interface AiWatchlistItem {
  id: number;
  symbol: string;
  mode: string;
  decision: "buy" | "watch" | "skip" | string;
  score: number;
  confidence: number;
  reason: string;
  replace_candidate?: string;
  last_price: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export type BotConfig = {
  is_running: boolean;
  dry_run: boolean;
  stake_amount_thb: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_open_trades: number;
  max_budget_thb: number;
  trade_direction: string;
  leverage: number;
  symbols: string[];
  timeframe: string;
  strategy: string;
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  ai_min_score: number;
  ai_min_confidence: number;
  ai_timeout_seconds: number;
  // Auto risk modules
  trailing_stop_enabled?: boolean;
  trailing_activation_pct?: number;
  trailing_stop_pct?: number;
  cooldown_enabled?: boolean;
  cooldown_minutes?: number;
  cooldown_after_loss_only?: boolean;
  regime_filter_enabled?: boolean;
  regime_action?: string;
  regime_reduce_factor?: number;
};

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  risk_level: string;
  market_condition?: string;
  ai_min_score?: number;
  ai_min_confidence?: number;
  buy_logic: string;
  sell_logic: string;
}
