import os
import time
import json
import hmac
import hashlib
import threading
import sqlite3
import requests
import pandas as pd
import numpy as np
from datetime import datetime
import importlib
import strategy
from dotenv import load_dotenv

# Load env variables for API calls
load_dotenv()

bitkub_http = requests.Session()
bitkub_http.trust_env = False

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
        self.positions = {}
        self.logs = []
        self.thread = None
        self.stop_event = threading.Event()
        
        # Initialize Database and Load Positions
        self.init_db()
        self.load_positions_from_db()
        
        # เพิ่ม Log เริ่มต้น
        self.add_log("Bot system initialized with SQLite database.")
        
        # ถ้าเปิดไว้ในคอนฟิก ให้รันเมื่อเริ่มโปรแกรม
        if self.config.get("is_running", False):
            self.start()

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
        # แปลงชื่อคู่เหรียญเป็นแบบ Bitkub เช่น BTC/THB -> THB_BTC
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
            self.add_log(f"Failed to fetch candles for {symbol}. Code: {r.status_code}")
        except Exception as e:
            self.add_log(f"Error fetching candles for {symbol}: {str(e)}")
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
        if len(self.positions) >= max_open_trades:
            self.add_log(f"Max open trades reached ({max_open_trades}). Skip buy for {symbol}.")
            return

        max_budget = float(self.config.get("max_budget_thb", 5000.0))
        stake = float(self.config.get("stake_amount_thb", 100.0))
        
        # Calculate current budget in use by active positions
        current_used_budget = 0.0
        for pos in self.positions.values():
            current_used_budget += float(pos.get("amount", 0.0)) * float(pos.get("buy_price", 0.0))
            
        # Check if adding this trade would exceed the budget
        if current_used_budget + stake > max_budget:
            self.add_log(f"Allocated budget limit reached (Used: {current_used_budget:,.2f} THB + Stake: {stake:,.2f} THB > Max: {max_budget:,.2f} THB). Skip buy for {symbol}.")
            return

        if active_strat.check_buy_signal(df):
            last_price = float(df.iloc[-1]["close"])
            
            self.add_log(f"🟢 [BUY SIGNAL] {symbol} at {last_price:,.2f} THB")
            
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
                        self.add_log(f"📥 [LIVE Buy] Order matched: {filled_amt:.6f} at {filled_price:,.2f} THB")
                except Exception as e:
                    self.add_log(f"❌ [LIVE Buy Failed] {symbol}: {str(e)}")

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
        if symbol not in self.positions:
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
                order = self.place_real_market_order("sell", symbol, amount)
                if order:
                    filled_price = float(order.get("rat", current_price)) or current_price
                    # คำนวณผลกำไรจริง
                    sell_value = amount * filled_price * 0.9975
                    buy_value = amount * buy_price
                    pnl_thb = sell_value - buy_value
                    pnl_pct = (pnl_thb / buy_value) * 100
                    
                    trade_record = {
                        "symbol": symbol,
                        "buy_time": position["buy_time"],
                        "sell_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "buy_price": buy_price,
                        "sell_price": filled_price,
                        "amount": amount,
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
                    
                    del self.positions[symbol]
                    self.delete_position_db(symbol)
                    
                    self.add_log(f"📤 [LIVE Sell] Sold successfully | PnL: {pnl_pct:.2f}% ({pnl_thb:,.2f} THB)")
                    return True
            except Exception as e:
                self.add_log(f"❌ [LIVE Sell Failed] {symbol}: {str(e)}")
                
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
    def place_real_market_order(self, side, symbol, amount):
        api_key = os.getenv("BITKUB_API_KEY")
        api_secret = os.getenv("BITKUB_API_SECRET")
        
        # ตรวจสอบคีย์ว่างหรือเป็นคีย์ตัวอย่าง
        if not api_key or not api_secret or "your_" in api_key:
            raise ValueError("API Keys are not configured. Cannot place real trade.")
            
        parts = symbol.upper().split('/')
        bitkub_symbol = f"{parts[0]}_{parts[1]}" if len(parts) == 2 else symbol
        
        path = "/api/v3/market/place-bid" if side == "buy" else "/api/v3/market/place-ask"
        
        # โครงสร้างตัวแปร
        body = {
            "sym": bitkub_symbol,
            "amt": amount,
            "rat": 0, # Market order ใช้ rate = 0
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
        if error_code != 0:
            raise ValueError(f"Bitkub API Error (Code {error_code}): {res_json.get('message')}")
            
        return res_json.get("result", {})
