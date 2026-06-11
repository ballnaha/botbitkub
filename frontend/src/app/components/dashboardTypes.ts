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
};

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  risk_level: string;
  buy_logic: string;
  sell_logic: string;
}
