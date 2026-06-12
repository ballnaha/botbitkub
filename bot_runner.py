import os
import time
import json
import hmac
import hashlib
import threading
import sqlite3
import math
import requests
import pandas as pd
import numpy as np
from datetime import datetime
import importlib
import strategy
from dotenv import load_dotenv
from ai_analyzer import GeminiTradeAnalyzer

# Load env variables for API calls
load_dotenv()

bitkub_http = requests.Session()
bitkub_http.trust_env = False
bitkub_http.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
})

# ข้อมูลการตั้งค่าบอทเริ่มต้น
BOT_CONFIG_FILE = "bot_config.json"
POSITIONS_FILE = "active_positions.json"
HISTORY_FILE = "trade_history.json"

DEFAULT_CONFIG = {
    "is_running": False,
    "dry_run": True,
    "stake_amount_thb": 100.0,
    "stop_loss_pct": -5.0,
    "take_profit_pct": 10.0,
    "max_open_trades": 3,
    "max_budget_thb": 5000.0,
    "trade_direction": "long",
    "leverage": 1,
    "ai_enabled": False,
    "ai_provider": "gemini",
    "ai_model": "gemini-3.5-flash",
    "ai_min_score": 65,
    "ai_min_confidence": 0.55,
    "ai_timeout_seconds": 8,
    "min_sell_value_thb": 10.0,
    "symbols": [
        "BTC/THB", "ETH/THB", "SOL/THB", "NEAR/THB", "XRP/THB",
        "DOGE/THB", "ADA/THB", "SUI/THB", "OP/THB", "XLM/THB",
        "BNB/THB", "WLD/THB", "KUB/THB", "ONDO/THB", "GALA/THB",
        "CRV/THB", "HBAR/THB", "BCH/THB"
    ],
    "timeframe": "15"  # 15 นาที
}

class BotRunner:
    def __init__(self):
        self.db_path = "bot_data.db"
        self.config = self.load_json(BOT_CONFIG_FILE, DEFAULT_CONFIG)
        self.config = {**DEFAULT_CONFIG, **self.config}
        self.positions = {}
        self.ai_watchlist = {}
        self.ai_analyzer = GeminiTradeAnalyzer()
        self.last_trade_error = ""
        self.last_wallet_reconcile_at = 0
        self.logs = []
        self.symbol_metadata = {}
        self.thread = None
        self.stop_event = threading.Event()
        
        # Initialize Database and Load Positions
        self.init_db()
        self.load_positions_from_db()
        
        # เพิ่ม Log เริ่มต้น
        self.add_log("Bot system initialized with SQLite database.")
        
        # Fetch symbol metadata for decimal precision
        self.fetch_symbol_metadata()
        
        # ถ้าเปิดไว้ในคอนฟิก ให้รันเมื่อเริ่มโปรแกรม
        if self.config.get("is_running", False):
            self.start()

    def fetch_symbol_metadata(self):
        try:
            r = bitkub_http.get("https://api.bitkub.com/api/v3/market/symbols", timeout=8)
            if r.status_code == 200:
                data = r.json()
                if data.get("error") == 0 or data.get("error") == "0":
                    results = data.get("result", [])
                    for item in results:
                        base = item.get("base_asset", "").upper()
                        quote = item.get("quote_asset", "").upper()
                        std_symbol = f"{base}/{quote}"
                        self.symbol_metadata[std_symbol] = {
                            "symbol": item.get("symbol", f"{base}_{quote}"),
                            "quantity_scale": max(int(item.get("quantity_scale", 8)), int(item.get("base_asset_scale", 8))),
                            "price_scale": int(item.get("price_scale", 2)),
                            "min_quote_size": float(item.get("min_quote_size", 10.0))
                        }
                    self.add_log(f"Successfully loaded metadata for {len(self.symbol_metadata)} symbols from Bitkub.")
                    return
            self.add_log("Failed to fetch symbols metadata from Bitkub V3 API. Using default scales.")
        except Exception as e:
            self.add_log(f"Error fetching symbols metadata: {str(e)}")

    def get_symbol_scales(self, symbol):
        # Default scales
        default = {"quantity_scale": 8, "price_scale": 2, "min_quote_size": 10.0}
        
        if not self.symbol_metadata:
            self.fetch_symbol_metadata()
            
        std_symbol = symbol.upper()
        return self.symbol_metadata.get(std_symbol, default)

    def get_active_strategy(self):
        strategy_name = self.config.get("strategy", "multi_indicator")
        try:
            return importlib.import_module(f"strategies.{strategy_name}")
        except Exception as e:
            self.add_log(f"Failed to load strategy '{strategy_name}': {e}. Using default.")
            return strategy

    def init_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create positions table with mode column
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS positions (
                    symbol TEXT,
                    mode TEXT DEFAULT 'Dry-Run',
                    buy_price REAL,
                    buy_time TEXT,
                    amount REAL,
                    current_price REAL,
                    pnl_percent REAL,
                    pnl_thb REAL,
                    trade_direction TEXT,
                    leverage INTEGER,
                    margin_mode TEXT,
                    PRIMARY KEY (symbol, mode)
                )
            """)
            
            # Check if the table 'positions' already has the 'mode' column (schema migration)
            cursor.execute("PRAGMA table_info(positions)")
            cols = [col[1] for col in cursor.fetchall()]
            if cols and "mode" not in cols:
                cursor.execute("ALTER TABLE positions RENAME TO positions_old")
                cursor.execute("""
                    CREATE TABLE positions (
                        symbol TEXT,
                        mode TEXT DEFAULT 'Dry-Run',
                        buy_price REAL,
                        buy_time TEXT,
                        amount REAL,
                        current_price REAL,
                        pnl_percent REAL,
                        pnl_thb REAL,
                        trade_direction TEXT,
                        leverage INTEGER,
                        margin_mode TEXT,
                        PRIMARY KEY (symbol, mode)
                    )
                """)
                cursor.execute("""
                    INSERT INTO positions (
                        symbol, mode, buy_price, buy_time, amount, current_price,
                        pnl_percent, pnl_thb, trade_direction, leverage, margin_mode
                    ) SELECT 
                        symbol, 'Dry-Run', buy_price, buy_time, amount, current_price,
                        pnl_percent, pnl_thb, trade_direction, leverage, margin_mode
                    FROM positions_old
                """)
                cursor.execute("DROP TABLE positions_old")
                conn.commit()
            
            # Add order_id to positions table if it doesn't exist
            cursor.execute("PRAGMA table_info(positions)")
            cols = [col[1] for col in cursor.fetchall()]
            if "order_id" not in cols:
                cursor.execute("ALTER TABLE positions ADD COLUMN order_id TEXT")
                conn.commit()
            
            # Create trade_history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trade_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT,
                    buy_time TEXT,
                    sell_time TEXT,
                    buy_price REAL,
                    sell_price REAL,
                    amount REAL,
                    pnl_percent REAL,
                    pnl_thb REAL,
                    reason TEXT,
                    mode TEXT,
                    trade_direction TEXT,
                    leverage INTEGER,
                    margin_mode TEXT
                )
            """)
            conn.commit()

            # Add buy_order_id and sell_order_id to trade_history table if they don't exist
            cursor.execute("PRAGMA table_info(trade_history)")
            cols = [col[1] for col in cursor.fetchall()]
            if "buy_order_id" not in cols:
                cursor.execute("ALTER TABLE trade_history ADD COLUMN buy_order_id TEXT")
                conn.commit()
            if "sell_order_id" not in cols:
                cursor.execute("ALTER TABLE trade_history ADD COLUMN sell_order_id TEXT")
                conn.commit()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_watchlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    mode TEXT DEFAULT 'Dry-Run',
                    decision TEXT,
                    score INTEGER,
                    confidence REAL,
                    reason TEXT,
                    replace_candidate TEXT,
                    last_price REAL,
                    status TEXT DEFAULT 'active',
                    created_at TEXT,
                    updated_at TEXT
                )
            """)
            conn.commit()
            cursor.execute("PRAGMA table_info(ai_watchlist)")
            cols = [col[1] for col in cursor.fetchall()]
            for col_name, col_type in [
                ("mode", "TEXT DEFAULT 'Dry-Run'"),
                ("replace_candidate", "TEXT"),
                ("last_price", "REAL"),
                ("status", "TEXT DEFAULT 'active'"),
                ("updated_at", "TEXT"),
            ]:
                if col_name not in cols:
                    cursor.execute(f"ALTER TABLE ai_watchlist ADD COLUMN {col_name} {col_type}")
                    conn.commit()
            
            # Legacy JSON migration
            # 1. Migrate positions
            if os.path.exists(POSITIONS_FILE):
                try:
                    legacy_positions = self.load_json(POSITIONS_FILE, {})
                    for symbol, pos in legacy_positions.items():
                        cursor.execute("""
                            INSERT OR REPLACE INTO positions (
                                symbol, mode, buy_price, buy_time, amount, current_price,
                                pnl_percent, pnl_thb, trade_direction, leverage, margin_mode
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            symbol,
                            "Dry-Run",
                            float(pos.get("buy_price", 0.0)),
                            pos.get("buy_time", ""),
                            float(pos.get("amount", 0.0)),
                            float(pos.get("current_price", 0.0)),
                            float(pos.get("pnl_percent", 0.0)),
                            float(pos.get("pnl_thb", 0.0)),
                            pos.get("trade_direction", "long"),
                            int(pos.get("leverage", 1)),
                            pos.get("margin_mode", "spot")
                        ))
                    conn.commit()
                    os.rename(POSITIONS_FILE, POSITIONS_FILE + ".bak")
                    self.add_log("Migrated active positions from JSON to SQLite successfully.")
                except Exception as e:
                    self.add_log(f"Error migrating active positions JSON: {str(e)}")
            
            # 2. Migrate trade history
            if os.path.exists(HISTORY_FILE):
                try:
                    legacy_history = self.load_json(HISTORY_FILE, [])
                    for h in legacy_history:
                        cursor.execute("""
                            INSERT INTO trade_history (
                                symbol, buy_time, sell_time, buy_price, sell_price,
                                amount, pnl_percent, pnl_thb, reason, mode,
                                trade_direction, leverage, margin_mode
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            h.get("symbol"),
                            h.get("buy_time"),
                            h.get("sell_time"),
                            float(h.get("buy_price", 0.0)),
                            float(h.get("sell_price", 0.0)),
                            float(h.get("amount", 0.0)),
                            float(h.get("pnl_percent", 0.0)) if h.get("pnl_percent") is not None else 0.0,
                            float(h.get("pnl_thb", 0.0)) if h.get("pnl_thb") is not None else 0.0,
                            h.get("reason"),
                            h.get("mode", "Dry-Run"),
                            h.get("trade_direction", "long"),
                            int(h.get("leverage", 1)),
                            h.get("margin_mode", "spot")
                        ))
                    conn.commit()
                    os.rename(HISTORY_FILE, HISTORY_FILE + ".bak")
                    self.add_log("Migrated trade history from JSON to SQLite successfully.")
                except Exception as e:
                    self.add_log(f"Error migrating trade history JSON: {str(e)}")
                    
            conn.close()
        except Exception as e:
            self.add_log(f"Error initializing database: {str(e)}")

    def load_positions_from_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            cursor.execute("SELECT * FROM positions WHERE mode = ?", (mode,))
            rows = cursor.fetchall()
            self.positions = {}
            for row in rows:
                symbol = row["symbol"]
                self.positions[symbol] = {
                    "symbol": symbol,
                    "mode": row["mode"] if "mode" in row.keys() else mode,
                    "buy_price": row["buy_price"],
                    "buy_time": row["buy_time"],
                    "amount": row["amount"],
                    "current_price": row["current_price"],
                    "pnl_percent": row["pnl_percent"],
                    "pnl_thb": row["pnl_thb"],
                    "trade_direction": row["trade_direction"],
                    "leverage": row["leverage"],
                    "margin_mode": row["margin_mode"],
                    "order_id": row["order_id"] if "order_id" in row.keys() else ""
                }
            conn.close()
        except Exception as e:
            self.add_log(f"Error loading positions from DB: {str(e)}")
            self.positions = {}

    def save_position_db(self, symbol, pos):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            cursor.execute("""
                INSERT OR REPLACE INTO positions (
                    symbol, mode, buy_price, buy_time, amount, current_price,
                    pnl_percent, pnl_thb, trade_direction, leverage, margin_mode, order_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                symbol,
                pos.get("mode", mode),
                pos["buy_price"],
                pos["buy_time"],
                pos["amount"],
                pos["current_price"],
                pos["pnl_percent"],
                pos["pnl_thb"],
                pos.get("trade_direction", "long"),
                pos.get("leverage", 1),
                pos.get("margin_mode", "spot"),
                pos.get("order_id", "")
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            self.add_log(f"Error saving position {symbol} to DB: {str(e)}")

    def delete_position_db(self, symbol):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            cursor.execute("DELETE FROM positions WHERE symbol = ? AND mode = ?", (symbol, mode))
            conn.commit()
            conn.close()
        except Exception as e:
            self.add_log(f"Error deleting position {symbol} from DB: {str(e)}")

    def sync_positions_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            cursor.execute("DELETE FROM positions WHERE mode = ?", (mode,))
            for symbol, pos in list(self.positions.items()):
                cursor.execute("""
                    INSERT OR REPLACE INTO positions (
                        symbol, mode, buy_price, buy_time, amount, current_price,
                        pnl_percent, pnl_thb, trade_direction, leverage, margin_mode, order_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    symbol,
                    pos.get("mode", mode),
                    pos["buy_price"],
                    pos["buy_time"],
                    pos["amount"],
                    pos["current_price"],
                    pos["pnl_percent"],
                    pos["pnl_thb"],
                    pos.get("trade_direction", "long"),
                    pos.get("leverage", 1),
                    pos.get("margin_mode", "spot"),
                    pos.get("order_id", "")
                ))
            conn.commit()
            conn.close()
        except Exception as e:
            self.add_log(f"Error syncing positions to DB: {str(e)}")

    def save_history_db(self, h):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO trade_history (
                    symbol, buy_time, sell_time, buy_price, sell_price,
                    amount, pnl_percent, pnl_thb, reason, mode,
                    trade_direction, leverage, margin_mode, buy_order_id, sell_order_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                h["symbol"],
                h["buy_time"],
                h["sell_time"],
                h["buy_price"],
                h["sell_price"],
                h["amount"],
                h["pnl_percent"],
                h["pnl_thb"],
                h["reason"],
                h.get("mode", "Dry-Run"),
                h.get("trade_direction", "long"),
                h.get("leverage", 1),
                h.get("margin_mode", "spot"),
                h.get("buy_order_id", ""),
                h.get("sell_order_id", "")
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            self.add_log(f"Error saving history to DB: {str(e)}")

    def save_ai_watchlist_db(self, symbol, ai_result, last_price, status="active"):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                INSERT INTO ai_watchlist (
                    symbol, mode, decision, score, confidence, reason,
                    replace_candidate, last_price, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                symbol,
                mode,
                ai_result.get("decision", "watch"),
                int(ai_result.get("score", 0)),
                float(ai_result.get("confidence", 0.0)),
                ai_result.get("reason", ""),
                ai_result.get("replace_candidate", ""),
                float(last_price or 0.0),
                status,
                now,
                now,
            ))
            conn.commit()
            conn.close()
        except Exception as e:
            self.add_log(f"Error saving AI watchlist for {symbol}: {str(e)}")

    def get_ai_watchlist(self, limit=50):
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            cursor.execute("""
                SELECT id, symbol, mode, decision, score, confidence, reason,
                       replace_candidate, last_price, status, created_at, updated_at
                FROM ai_watchlist
                WHERE mode = ?
                ORDER BY id DESC
                LIMIT ?
            """, (mode, int(limit)))
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows]
        except Exception as e:
            self.add_log(f"Error loading AI watchlist: {str(e)}")
            return []

    def update_latest_ai_watchlist_status(self, symbol, status):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            mode = "Dry-Run" if self.config.get("dry_run", True) else "LIVE"
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                UPDATE ai_watchlist
                SET status = ?, updated_at = ?
                WHERE id = (
                    SELECT id FROM ai_watchlist
                    WHERE symbol = ? AND mode = ?
                    ORDER BY id DESC
                    LIMIT 1
                )
            """, (status, now, symbol, mode))
            conn.commit()
            conn.close()
        except Exception as e:
            self.add_log(f"Error updating AI watchlist status for {symbol}: {str(e)}")

    def get_history(self):
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trade_history ORDER BY id ASC")
            rows = cursor.fetchall()
            history_list = []
            for row in rows:
                history_list.append({
                    "timestamp": row["sell_time"],
                    "symbol": row["symbol"],
                    "side": "SELL",
                    "amount": row["amount"],
                    "buy_price": row["buy_price"],
                    "price": row["sell_price"],
                    "total": row["amount"] * row["sell_price"],
                    "pnl_thb": row["pnl_thb"],
                    "pnl_percent": row["pnl_percent"],
                    "reason": row["reason"],
                    "buy_time": row["buy_time"],
                    "mode": row["mode"]
                })
            conn.close()
            return history_list
        except Exception as e:
            self.add_log(f"Error querying history from DB: {str(e)}")
            return []

    def load_json(self, filepath, default_val):
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                self.add_log(f"Error loading {filepath}: {str(e)}")
        return default_val

    def save_json(self, filepath, data):
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
        except Exception as e:
            self.add_log(f"Error saving {filepath}: {str(e)}")

    def add_log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        try:
            print(log_entry)
        except UnicodeEncodeError:
            try:
                # Safe print fallback replacing non-encodable characters
                print(log_entry.encode('ascii', errors='replace').decode('ascii'))
            except Exception:
                pass
        self.logs.append(log_entry)
        # จำกัดจำนวน log สูงสุด 200 รายการ
        if len(self.logs) > 200:
            self.logs.pop(0)

    def start(self):
        if self.thread and self.thread.is_alive():
            self.add_log("Bot is already running.")
            return
        
        self.config["is_running"] = True
        self.save_json(BOT_CONFIG_FILE, self.config)
        
        self.stop_event.clear()
        self.thread = threading.Thread(target=self.bot_loop, daemon=True)
        self.thread.start()
        self.add_log(f"Bot STARTED. Mode: {'Dry-Run (Simulated)' if self.config['dry_run'] else 'LIVE (Real trading)'}")

    def stop(self):
        self.config["is_running"] = False
        self.save_json(BOT_CONFIG_FILE, self.config)
        
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)
        self.add_log("Bot STOPPED.")

    # ดึงประวัติกราฟ TradingView จาก Bitkub
    def fetch_ohlcv(self, symbol, timeframe="15", limit=100):
        # แปลงชื่อคู่เหรียญเป็นแบบ Bitkub เช่น BTC/THB -> BTC_THB
        parts = symbol.upper().split('/')
        if len(parts) == 2:
            bitkub_symbol = f"{parts[0]}_{parts[1]}"
        else:
            bitkub_symbol = symbol
            
        url = "https://api.bitkub.com/tradingview/history"
        
        # กำหนดช่วงเวลา (ย้อนหลัง limit * resolution นาที)
        resolution_mins = int(timeframe) if timeframe.isdigit() else 15
        now_ts = int(time.time())
        from_ts = now_ts - (limit * resolution_mins * 60)
        
        params = {
            "symbol": bitkub_symbol,
            "resolution": timeframe,
            "from": from_ts,
            "to": now_ts
        }
        
        for attempt in range(3):
            try:
                r = bitkub_http.get(url, params=params, timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    if data.get("s") == "ok":
                        df = pd.DataFrame({
                            "timestamp": data.get("t"),
                            "open": data.get("o"),
                            "high": data.get("h"),
                            "low": data.get("l"),
                            "close": data.get("c"),
                            "volume": data.get("v")
                        })
                        # แปลงค่าตัวเลขเป็น float
                        for col in ["open", "high", "low", "close", "volume"]:
                            df[col] = df[col].astype(float)
                        return df
                self.add_log(f"Failed to fetch candles for {symbol} (Attempt {attempt+1}/3). Code: {r.status_code}")
            except Exception as e:
                self.add_log(f"Error fetching candles for {symbol} (Attempt {attempt+1}/3): {str(e)}")
            if attempt < 2:
                time.sleep(1.5)
        return pd.DataFrame()

    # ลูปหลักทำงานทุกๆ 60 วินาที
    def bot_loop(self):
        while not self.stop_event.is_set():
            try:
                self.add_log("--- Starting market scan loop ---")
                
                # โหลดกลยุทธ์ที่ใช้อยู่ขณะนี้
                active_strat = self.get_active_strategy()
                
                # อัปเดตราคาล่าสุดสำหรับคำนวณ PnL
                self.update_active_positions_pnl()
                
                # วนลูปเช็คสัญญาณแต่ละคู่เหรียญ
                for symbol in self.config.get("symbols", []):
                    if self.stop_event.is_set():
                        break
                        
                    # 1. ดึงกราฟเทคนิคและคำนวณอินดิเคเตอร์
                    df = self.fetch_ohlcv(symbol, self.config["timeframe"])
                    if df.empty or len(df) < 30:
                        continue
                        
                    df = active_strat.populate_indicators(df)
                    
                    # 2. เช็คการออกหรือปิด Position ที่มีอยู่ก่อน
                    if symbol in self.positions:
                        self.check_and_execute_sell(symbol, df, active_strat)
                    else:
                        # 3. เช็คการเข้าซื้อใหม่
                        self.check_and_execute_buy(symbol, df, active_strat)
                        
                    time.sleep(1)  # ป้องกันโดน Rate Limit
                    
                self.add_log("--- Loop scan finished ---")
            except Exception as e:
                self.add_log(f"Error in bot loop: {str(e)}")
                
            # รอ 60 วินาที (เช็คสัญญาณทุกๆ 1 นาที)
            self.stop_event.wait(60)

    def check_and_execute_buy(self, symbol, df, active_strat):
        max_open_trades = int(self.config.get("max_open_trades", 3))
        max_budget = float(self.config.get("max_budget_thb", 5000.0))
        stake = float(self.config.get("stake_amount_thb", 100.0))

        if active_strat.check_buy_signal(df):
            last_price = float(df.iloc[-1]["close"])
            
            self.add_log(f"🟢 [BUY SIGNAL] {symbol} at {last_price:,.2f} THB")

            if len(self.positions) >= max_open_trades:
                self.add_log(f"Max open trades reached ({max_open_trades}). Skip AI review and buy for {symbol}.")
                return

            # Calculate current budget in use by active positions
            current_used_budget = 0.0
            for pos in self.positions.values():
                current_used_budget += float(pos.get("amount", 0.0)) * float(pos.get("buy_price", 0.0))
                
            # Check if adding this trade would exceed the budget
            if current_used_budget + stake > max_budget:
                self.add_log(f"Allocated budget limit reached (Used: {current_used_budget:,.2f} THB + Stake: {stake:,.2f} THB > Max: {max_budget:,.2f} THB). Skip AI review and buy for {symbol}.")
                return

            if not self.config["dry_run"]:
                try:
                    available_thb = self.get_live_available_balance("THB")
                except Exception as e:
                    self.add_log(f"Unable to verify live THB balance before AI review for {symbol}: {str(e)}. Skip buy.")
                    return

                if available_thb < stake:
                    self.add_log(f"Insufficient live THB balance before AI review for {symbol}. Available: {available_thb:,.2f} THB, Required: {stake:,.2f} THB. Skip AI review and buy.")
                    return

            ai_result = self.evaluate_ai_buy_signal(symbol, df, last_price)
            if self.config.get("ai_enabled", False) and not ai_result:
                self.add_log(f"🤖 [AI Gate] Skip buy for {symbol}: AI review unavailable.")
                return

            if ai_result and not self.is_ai_buy_allowed(symbol, ai_result):
                return
            
            if self.config["dry_run"]:
                # ทำรายการซื้อจำลอง
                crypto_amount = (stake * 0.9975) / last_price  # หักค่าธรรมเนียมประมาณ 0.25%
                
                self.positions[symbol] = {
                    "symbol": symbol,
                    "mode": "Dry-Run",
                    "buy_price": last_price,
                    "buy_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "amount": crypto_amount,
                    "current_price": last_price,
                    "pnl_percent": 0.0,
                    "pnl_thb": 0.0,
                    "trade_direction": "long",
                    "leverage": 1,
                    "margin_mode": "spot"
                }
                self.sync_positions_db()
                self.update_latest_ai_watchlist_status(symbol, "used")
                self.add_log(f"📥 [Dry-Run Buy] Bought {crypto_amount:.6f} {symbol.split('/')[0]} (Spent {stake} THB)")
            else:
                # ส่งคำสั่งซื้อจริงผ่าน API (ใช้ฟังก์ชันจาก backend.py หรือสร้างโมดูลส่งตรง)
                try:
                    order = self.place_real_market_order("buy", symbol, stake)
                    if order:
                        # บันทึกสถานะส่งคำสั่งซื้อจริงสำเร็จ
                        filled_price = float(order.get("rat", 0.0))
                        if filled_price <= 0.0:
                            filled_price = last_price
                            
                        filled_amt = float(order.get("rec", 0.0))
                        if filled_amt <= 0.0:
                            # Estimate based on stake and filled_price (minus Bitkub's fee of 0.25%)
                            filled_amt = (stake * 0.9975) / filled_price
                        
                        self.positions[symbol] = {
                            "symbol": symbol,
                            "mode": "LIVE",
                            "buy_price": filled_price,
                            "buy_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "amount": filled_amt,
                            "current_price": last_price,
                            "pnl_percent": 0.0,
                            "pnl_thb": 0.0,
                            "order_id": order.get("id"),
                            "trade_direction": "long",
                            "leverage": 1,
                            "margin_mode": "spot"
                        }
                        self.sync_positions_db()
                        self.update_latest_ai_watchlist_status(symbol, "used")
                        self.add_log(f"📥 [LIVE Buy] Order matched: {filled_amt:.6f} at {filled_price:,.2f} THB")
                except Exception as e:
                    self.add_log(f"❌ [LIVE Buy Failed] {symbol}: {str(e)}")

    def evaluate_ai_buy_signal(self, symbol, df, last_price):
        if not self.config.get("ai_enabled", False):
            return None

        if not self.ai_analyzer.is_configured(self.config):
            provider = self.config.get("ai_provider", "gemini").upper()
            self.add_log(f"🤖 [AI Review] {provider}_API_KEY is not configured. Skip buy for {symbol}.")
            return None

        try:
            market_snapshot = self.build_market_snapshot(df, last_price)
            positions_snapshot = self.build_positions_snapshot()
            result = self.ai_analyzer.analyze_buy_signal(
                symbol=symbol,
                market_snapshot=market_snapshot,
                positions_snapshot=positions_snapshot,
                config=self.config,
            )
            self.ai_watchlist[symbol] = result
            status = "active" if result.get("decision") in ("buy", "watch") else "skipped"
            self.save_ai_watchlist_db(symbol, result, last_price, status=status)
            replace_text = f" | replace: {result['replace_candidate']}" if result.get("replace_candidate") else ""
            self.add_log(
                f"🤖 [AI Review] {symbol}: {result['decision'].upper()} "
                f"score={result['score']} confidence={result['confidence']:.2f}{replace_text} | {result['reason']}"
            )
            return result
        except Exception as e:
            self.add_log(f"🤖 [AI Review Failed] {symbol}: {str(e)}. Skip buy.")
            return None

    def is_ai_buy_allowed(self, symbol, ai_result):
        min_score = int(self.config.get("ai_min_score", 65))
        min_confidence = float(self.config.get("ai_min_confidence", 0.55))
        if ai_result.get("decision") != "buy":
            self.add_log(f"🤖 [AI Gate] Skip buy for {symbol}: AI decision is {ai_result.get('decision')}.")
            return False
        if int(ai_result.get("score", 0)) < min_score:
            self.add_log(f"🤖 [AI Gate] Skip buy for {symbol}: score below threshold ({ai_result.get('score')} < {min_score}).")
            return False
        if float(ai_result.get("confidence", 0.0)) < min_confidence:
            self.add_log(f"🤖 [AI Gate] Skip buy for {symbol}: confidence below threshold ({ai_result.get('confidence'):.2f} < {min_confidence:.2f}).")
            return False
        return True

    def build_market_snapshot(self, df, last_price):
        last = df.iloc[-1]
        previous = df.iloc[-2] if len(df) >= 2 else last
        recent = df.tail(20)
        volume_avg = float(recent["volume"].mean()) if "volume" in recent else 0.0
        price_change_pct = ((float(last["close"]) - float(previous["close"])) / float(previous["close"]) * 100) if float(previous["close"]) else 0.0
        snapshot = {
            "last_price": float(last_price),
            "price_change_last_candle_pct": round(price_change_pct, 4),
            "volume": float(last.get("volume", 0.0)),
            "volume_avg_20": round(volume_avg, 4),
        }
        for key in ["rsi", "macd", "macd_signal", "ema_fast", "ema_slow", "bb_upper", "bb_middle", "bb_lower"]:
            if key in df.columns:
                try:
                    snapshot[key] = float(last[key])
                except Exception:
                    pass
        return snapshot

    def build_positions_snapshot(self):
        snapshot = {}
        for symbol, pos in self.positions.items():
            snapshot[symbol] = {
                "buy_price": float(pos.get("buy_price", 0.0)),
                "current_price": float(pos.get("current_price", 0.0)),
                "pnl_percent": float(pos.get("pnl_percent", 0.0)),
                "pnl_thb": float(pos.get("pnl_thb", 0.0)),
                "buy_time": pos.get("buy_time", ""),
            }
        return snapshot

    def check_and_execute_sell(self, symbol, df, active_strat):
        position = self.positions[symbol]
        last_price = float(df.iloc[-1]["close"])
        buy_price = position["buy_price"]
        
        # คำนวณ PnL ณ ปัจจุบัน
        pnl_pct = ((last_price - buy_price) / buy_price) * 100
        
        # 1. เช็คสัญญาณขายของกลยุทธ์
        sell_signal = active_strat.check_sell_signal(df)
        
        # 2. เช็ค Stop Loss
        stop_loss_hit = pnl_pct <= self.config["stop_loss_pct"]
        
        # 3. เช็ค Take Profit
        take_profit_hit = pnl_pct >= self.config["take_profit_pct"]
        
        reason = ""
        if sell_signal:
            reason = "Strategy Sell Signal"
        elif stop_loss_hit:
            reason = f"Stop Loss Hit ({pnl_pct:.2f}%)"
        elif take_profit_hit:
            reason = f"Take Profit Hit ({pnl_pct:.2f}%)"
            
        if reason:
            self.add_log(f"🔴 [SELL SIGNAL] {symbol} because: {reason} | Current price: {last_price:,.2f} THB")
            self.execute_sell(symbol, last_price, reason)

    def execute_sell(self, symbol, current_price, reason="Manual"):
        self.last_trade_error = ""
        if symbol not in self.positions:
            self.last_trade_error = f"No active position found for {symbol}."
            return False
            
        position = self.positions[symbol]
        buy_price = position["buy_price"]
        amount = position["amount"]
        
        if self.config["dry_run"]:
            # คำนวณผลลัพธ์การจำลองเทรด
            sell_value = amount * current_price * 0.9975 # หักลบค่าธรรมเนียมตอนขาย
            buy_value = amount * buy_price
            pnl_thb = sell_value - buy_value
            pnl_pct = (pnl_thb / buy_value) * 100
            
            trade_record = {
                "symbol": symbol,
                "buy_time": position["buy_time"],
                "sell_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "buy_price": buy_price,
                "sell_price": current_price,
                "amount": amount,
                "pnl_percent": pnl_pct,
                "pnl_thb": pnl_thb,
                "reason": reason,
                "mode": "Dry-Run",
                "trade_direction": position.get("trade_direction", "long"),
                "leverage": position.get("leverage", 1),
                "margin_mode": position.get("margin_mode", "spot")
            }
            
            # บันทึกลงประวัติและลบตัวถือครอง
            self.save_history_db(trade_record)
            
            del self.positions[symbol]
            self.delete_position_db(symbol)
            
            self.add_log(f"📤 [Dry-Run Sell] Sold {amount:.6f} {symbol.split('/')[0]} | PnL: {pnl_pct:.2f}% ({pnl_thb:,.2f} THB)")
            return True
        else:
            # ขายจริงผ่าน API
            try:
                base_asset = symbol.split("/")[0].upper()
                available_amount = self.get_live_available_balance(base_asset)
                if available_amount <= 0:
                    self.last_trade_error = f"Insufficient live {base_asset} balance before sell for {symbol}."
                    self.add_log(f"{self.last_trade_error} Skip sell order.")
                    return False
                if available_amount < amount:
                    self.add_log(f"Live {base_asset} balance is lower than tracked position for {symbol}. Sell available amount {available_amount:.8f} instead of {amount:.8f}.")
                    amount = available_amount

                scales = self.get_symbol_scales(symbol)
                qty_scale = scales["quantity_scale"]
                amount = self.floor_order_amount(amount, qty_scale)
                estimated_sell_value = amount * current_price
                if amount <= 0:
                    self.last_trade_error = f"Sell amount is too small after precision adjustment for {symbol}."
                    self.add_log(self.last_trade_error)
                    return False
                min_sell_value = float(self.config.get("min_sell_value_thb", 10.0))
                if estimated_sell_value < min_sell_value:
                    self.last_trade_error = f"Estimated sell value is below Bitkub minimum for {symbol}: {estimated_sell_value:,.2f} THB < {min_sell_value:,.2f} THB."
                    self.add_log(self.last_trade_error)
                    return False

                self.add_log(f"Preparing LIVE sell for {symbol}: amount={amount:.8f}, available={available_amount:.8f}, estimated={estimated_sell_value:,.2f} THB")
                order = self.place_real_market_order("sell", symbol, amount)
                if order:
                    filled_price = float(order.get("rat", current_price)) or current_price
                    sold_amount = float(order.get("amt") or order.get("amount") or order.get("_submitted_amt") or amount)
                    sold_amount = min(amount, sold_amount)
                    # คำนวณผลกำไรจริง
                    sell_value = sold_amount * filled_price * 0.9975
                    buy_value = sold_amount * buy_price
                    pnl_thb = sell_value - buy_value
                    pnl_pct = (pnl_thb / buy_value) * 100
                    
                    trade_record = {
                        "symbol": symbol,
                        "buy_time": position["buy_time"],
                        "sell_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "buy_price": buy_price,
                        "sell_price": filled_price,
                        "amount": sold_amount,
                        "pnl_percent": pnl_pct,
                        "pnl_thb": pnl_thb,
                        "reason": reason,
                        "mode": "LIVE",
                        "order_id": order.get("id"),
                        "trade_direction": position.get("trade_direction", "long"),
                        "leverage": position.get("leverage", 1),
                        "margin_mode": position.get("margin_mode", "spot")
                    }
                    
                    self.save_history_db(trade_record)
                    
                    remaining_amount = amount - sold_amount
                    if remaining_amount > 0.00000001 and "Panic Sell" not in reason:
                        position["amount"] = remaining_amount
                        position["current_price"] = current_price
                        position["pnl_percent"] = ((current_price - buy_price) / buy_price) * 100
                        position["pnl_thb"] = (remaining_amount * current_price * 0.9975) - (remaining_amount * buy_price)
                        self.positions[symbol] = position
                        self.save_position_db(symbol, position)
                        self.add_log(f"📤 [LIVE Sell] Sold {sold_amount:.8f} {symbol.split('/')[0]} | Remaining dust: {remaining_amount:.8f}")
                    else:
                        del self.positions[symbol]
                        self.delete_position_db(symbol)
                    
                    self.add_log(f"📤 [LIVE Sell] Sold successfully | PnL: {pnl_pct:.2f}% ({pnl_thb:,.2f} THB)")
                    return True
            except Exception as e:
                self.last_trade_error = str(e)
                self.add_log(f"❌ [LIVE Sell Failed] {symbol}: {self.last_trade_error}")
                
        return False

    def update_active_positions_pnl(self):
        # สแกนหาความเคลื่อนไหวราคาปัจจุบันเพื่อทำ Realtime PnL
        if not self.positions:
            return
            
        try:
            # ดึงราคา Ticker ล่าสุดเพื่ออัปเดตราคาแบบไว
            url = "https://api.bitkub.com/api/market/ticker"
            r = bitkub_http.get(url, timeout=5)
            if r.status_code == 200:
                ticker_data = r.json()
                
                for symbol, pos in list(self.positions.items()):
                    parts = symbol.split("/")
                    if len(parts) == 2:
                        bitkub_symbol = f"THB_{parts[0]}"
                    else:
                        bitkub_symbol = symbol
                        
                    if bitkub_symbol in ticker_data:
                        current_price = float(ticker_data[bitkub_symbol]["last"])
                        buy_price = pos["buy_price"]
                        amount = pos["amount"]
                        
                        # อัปเดตราคา
                        pos["current_price"] = current_price
                        pos["pnl_percent"] = ((current_price - buy_price) / buy_price) * 100
                        pos["pnl_thb"] = (amount * current_price * 0.9975) - (amount * buy_price)
                        
                self.sync_positions_db()
        except Exception as e:
            self.add_log(f"Error updating positions PnL: {str(e)}")

    # ส่งคำสั่งเทรดจริงบน Bitkub API (REST v3)
    def reconcile_live_positions_with_wallet(self, force=False):
        if self.config.get("dry_run", True) or not self.positions:
            return

        now = time.time()
        if not force and now - self.last_wallet_reconcile_at < 15:
            return
        self.last_wallet_reconcile_at = now

        for symbol, pos in list(self.positions.items()):
            try:
                base_asset = symbol.split("/")[0].upper()
                tracked_amount = float(pos.get("amount", 0.0) or 0.0)
                available_amount = self.get_live_available_balance(base_asset)

                if tracked_amount <= 0:
                    del self.positions[symbol]
                    self.delete_position_db(symbol)
                    self.add_log(f"Removed invalid LIVE position for {symbol}: tracked amount is zero.")
                    continue

                if available_amount <= 0 or available_amount < tracked_amount * 0.05:
                    del self.positions[symbol]
                    self.delete_position_db(symbol)
                    self.add_log(f"Removed stale LIVE position for {symbol}: wallet available {available_amount:.8f} {base_asset}, tracked {tracked_amount:.8f}.")
                    continue

                if available_amount < tracked_amount:
                    pos["amount"] = available_amount
                    self.save_position_db(symbol, pos)
                    self.add_log(f"Adjusted LIVE position amount for {symbol}: wallet available {available_amount:.8f} {base_asset}, tracked {tracked_amount:.8f}.")
            except Exception as e:
                self.add_log(f"Error reconciling LIVE position {symbol} with wallet: {str(e)}")

    def floor_order_amount(self, amount, decimals=8):
        if decimals == 0:
            return int(math.floor(float(amount)))
        factor = 10 ** decimals
        val = math.floor(float(amount) * factor) / factor
        if val.is_integer():
            return int(val)
        return val

    def get_current_bid_price(self, symbol):
        parts = symbol.upper().split("/")
        bitkub_symbol = f"THB_{parts[0]}" if len(parts) == 2 else symbol.upper()
        r = bitkub_http.get("https://api.bitkub.com/api/market/ticker", timeout=5)
        ticker_data = r.json()
        item = ticker_data.get(bitkub_symbol)
        if not item:
            return 0.0
        return float(item.get("highestBid") or item.get("bid") or item.get("last") or 0.0)

    def get_live_available_balance(self, asset):
        api_key = os.getenv("BITKUB_API_KEY")
        api_secret = os.getenv("BITKUB_API_SECRET")

        if not api_key or not api_secret or "your_" in api_key:
            raise ValueError("API Keys are not configured. Cannot check live balance.")

        path = "/api/v4/wallet/balances"
        timestamp = str(int(time.time() * 1000))
        body_str = ""
        payload = timestamp + "GET" + path + body_str
        signature = hmac.new(
            api_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-BTK-APIKEY": api_key,
            "X-BTK-TIMESTAMP": timestamp,
            "X-BTK-SIGN": signature
        }

        r = bitkub_http.get("https://api.bitkub.com" + path, headers=headers, timeout=8)
        res_json = r.json()

        code = res_json.get("code")
        if code not in ("0", 0):
            raise ValueError(f"Bitkub balance error (Code {code}): {res_json.get('message')}")

        requested_asset = asset.upper()
        balances = res_json.get("data", [])

        if isinstance(balances, list):
            for item in balances:
                if str(item.get("currency", "")).upper() == requested_asset:
                    return float(item.get("available", 0.0) or 0.0)
            return 0.0

        if isinstance(balances, dict):
            item = balances.get(requested_asset) or balances.get(requested_asset.lower())
            if isinstance(item, dict):
                if "available" in item:
                    return float(item.get("available", 0.0) or 0.0)
                total = float(item.get("total", 0.0) or 0.0)
                reserved = float(item.get("reserved", 0.0) or 0.0)
                return max(0.0, total - reserved)
            if item is not None:
                return float(item or 0.0)

        return 0.0

    def place_real_market_order(self, side, symbol, amount):
        api_key = os.getenv("BITKUB_API_KEY")
        api_secret = os.getenv("BITKUB_API_SECRET")
        
        # ตรวจสอบคีย์ว่างหรือเป็นคีย์ตัวอย่าง
        if not api_key or not api_secret or "your_" in api_key:
            raise ValueError("API Keys are not configured. Cannot place real trade.")
            
        parts = symbol.upper().split('/')
        bitkub_symbol = f"{parts[0]}_{parts[1]}".lower() if len(parts) == 2 else symbol.lower()
        
        path = "/api/v3/market/place-bid" if side == "buy" else "/api/v3/market/place-ask"

        scales = self.get_symbol_scales(symbol)
        qty_scale = scales["quantity_scale"]
        price_scale = scales["price_scale"]

        amount_candidates = []
        if side == "sell":
            for decimals in (8, 6, 4, 2, 0):
                if decimals <= qty_scale:
                    candidate = self.floor_order_amount(amount, decimals)
                    if candidate > 0 and candidate not in amount_candidates:
                        amount_candidates.append(candidate)
            if not amount_candidates:
                candidate = self.floor_order_amount(amount, qty_scale)
                if candidate > 0:
                    amount_candidates.append(candidate)
        else:
            amount_candidates = [self.floor_order_amount(amount, 2)]
        
        last_error = None
        retried_sell_with_bid_rate = False
        for order_amount in amount_candidates:
            rate_candidates = [0]
            if side == "sell":
                bid_price = self.get_current_bid_price(symbol)
                if bid_price > 0:
                    floored_bid = self.floor_order_amount(bid_price, price_scale)
                    rate_candidates.append(floored_bid)

            for order_rate in rate_candidates:
                body = {
                    "sym": bitkub_symbol,
                    "amt": order_amount,
                    "rat": order_rate,
                    "typ": "market"
                }
            
                # การเซ็นลายเซ็นคำขอ
                timestamp = str(int(time.time() * 1000))
                body_str = json.dumps(body)
                payload = timestamp + "POST" + path + body_str
                signature = hmac.new(
                    api_secret.encode('utf-8'),
                    payload.encode('utf-8'),
                    hashlib.sha256
                ).hexdigest()
                
                headers = {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-BTK-APIKEY": api_key,
                    "X-BTK-TIMESTAMP": timestamp,
                    "X-BTK-SIGN": signature
                }
                
                r = bitkub_http.post("https://api.bitkub.com" + path, json=body, headers=headers, timeout=10)
                res_json = r.json()
                
                error_code = res_json.get("error", 0)
                if error_code == 0:
                    result = res_json.get("result", {})
                    if isinstance(result, dict) and side == "sell":
                        result["_submitted_amt"] = order_amount
                    return result

                message = res_json.get("message") or res_json.get("msg") or res_json.get("error_message")
                last_error = f"Bitkub API Error (Code {error_code}): {message or 'No message'} | sym={bitkub_symbol}, side={side}, amt={order_amount}, rat={order_rate}"
                if side == "sell" and error_code == 19 and order_rate == 0 and rate_candidates[-1] != 0:
                    retried_sell_with_bid_rate = True
                    self.add_log(f"Retry LIVE sell for {symbol} with market rate hint after Code 19: amt={order_amount}, rat={rate_candidates[-1]}")
                    continue
                if side == "sell" and error_code in (18, 19) and order_amount != amount_candidates[-1]:
                    self.add_log(f"Retry LIVE sell for {symbol} with adjusted precision after Code {error_code}: amt={order_amount}")
                    break
                raise ValueError(last_error)
        
        hint = " after retrying bid-rate market sell" if retried_sell_with_bid_rate else ""
        raise ValueError((last_error or f"Bitkub API Error: order failed | sym={bitkub_symbol}, side={side}, amt={amount}") + hint)
