import os
import time
import hmac
import hashlib
import json
import requests
import asyncio
from fastapi import FastAPI, HTTPException, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from bot_runner import BotRunner
from strategies import get_strategy_list
import secrets

# Global bot instance
bot = None

# Load environment variables
load_dotenv()

# Setup Custom Session Authentication for VPS Security
def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    correct_username = os.getenv("DASHBOARD_USERNAME", "admin")
    correct_password = os.getenv("DASHBOARD_PASSWORD", "password123")
    expected_token = hashlib.sha256((correct_username + correct_password).encode()).hexdigest()
    
    if session_token != expected_token:
        return None
    return correct_username

def api_auth(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user

app = FastAPI(title="Bitkub API Dashboard Proxy (Direct Client)")

# CORS configuration to allow Next.js app on port 3000 to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4011",
        "http://127.0.0.1:4011",
        "http://localhost:8282",
        "http://127.0.0.1:8282"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BITKUB_HOST = "https://api.bitkub.com"

bitkub_http = requests.Session()
bitkub_http.trust_env = False

# Helper to check if credentials are valid placeholder values
def are_credentials_placeholder(api_key, api_secret):
    return (
        not api_key 
        or not api_secret 
        or api_key == "your_api_key_here" 
        or api_secret == "your_api_secret_here"
    )

# Signature generator for Bitkub API v3/v4
def generate_signature(timestamp, method, path, body_str, api_secret):
    payload = str(timestamp) + method.upper() + path + (body_str or '')
    signature = hmac.new(
        api_secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature

# Fetch authenticated headers
def get_auth_headers(method, path, body_dict=None):
    api_key = os.getenv("BITKUB_API_KEY")
    api_secret = os.getenv("BITKUB_API_SECRET")

    if are_credentials_placeholder(api_key, api_secret):
        raise ValueError("API credentials are not configured in the .env file.")

    timestamp = str(int(time.time() * 1000))
    body_str = json.dumps(body_dict) if body_dict is not None else ""
    
    signature = generate_signature(timestamp, method, path, body_str, api_secret)
    
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-BTK-APIKEY": api_key,
        "X-BTK-TIMESTAMP": timestamp,
        "X-BTK-SIGN": signature
    }

# Pydantic models for request bodies
class TradeRequest(BaseModel):
    symbol: str  # e.g., 'BTC/THB'
    side: str  # 'buy' or 'sell'
    order_type: str  # 'limit' or 'market'
    amount: float
    price: float = None

class LoginRequest(BaseModel):
    username: str
    password: str

# HTTP Middleware to verify session tokens
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Bypass CORS preflight OPTIONS requests
    if request.method == "OPTIONS":
        return await call_next(request)
        
    path = request.url.path
    
    # 1. Allow public routes (all non-API files/paths and the login endpoint)
    if not path.startswith("/api") or path == "/api/login":
        return await call_next(request)
        
    # 2. Check session cookie
    session_token = request.cookies.get("session_token")
    correct_username = os.getenv("DASHBOARD_USERNAME", "admin")
    correct_password = os.getenv("DASHBOARD_PASSWORD", "password123")
    expected_token = hashlib.sha256((correct_username + correct_password).encode()).hexdigest()
    
    if session_token != expected_token:
        return Response(status_code=401, content="Unauthorized")
        
    # Authorized, continue
    return await call_next(request)

@app.post("/api/login")
async def api_login(credentials: LoginRequest, response: Response):
    correct_username = os.getenv("DASHBOARD_USERNAME", "admin")
    correct_password = os.getenv("DASHBOARD_PASSWORD", "password123")
    
    if credentials.username == correct_username and credentials.password == correct_password:
        session_token = hashlib.sha256((correct_username + correct_password).encode()).hexdigest()
        # Set HttpOnly cookie for 24 hours
        response.set_cookie(
            key="session_token", 
            value=session_token, 
            max_age=86400, 
            httponly=True, 
            samesite="lax",
            secure=False
        )
        return {"status": "success", "message": "Logged in successfully"}
    else:
        raise HTTPException(status_code=401, detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")

@app.post("/api/logout")
async def api_logout(response: Response):
    response.delete_cookie(key="session_token")
    return {"status": "success", "message": "Logged out successfully"}

# API Endpoints
cached_owner_name = None

@app.get("/api/user")
async def get_user_profile():
    global cached_owner_name
    if cached_owner_name:
        return {"username": cached_owner_name}

    api_key = os.getenv("BITKUB_API_KEY")
    api_secret = os.getenv("BITKUB_API_SECRET")

    if are_credentials_placeholder(api_key, api_secret):
        fallback_name = os.getenv("BITKUB_OWNER_NAME") or os.getenv("DASHBOARD_USERNAME", "admin")
        return {"username": fallback_name}

    try:
        path = "/api/v4/fiat/accounts"
        headers = get_auth_headers("GET", path)
        response = await asyncio.to_thread(bitkub_http.get, BITKUB_HOST + path, headers=headers, timeout=5)
        res_json = response.json()
        
        code = res_json.get("code")
        if code == 0 or code == "0":
            data = res_json.get("data", [])
            if data and len(data) > 0:
                owner_name = data[0].get("name")
                if owner_name:
                    cached_owner_name = owner_name
                    return {"username": cached_owner_name}
    except Exception as e:
        print(f"Error fetching Bitkub owner name: {e}")

    fallback_name = os.getenv("BITKUB_OWNER_NAME") or os.getenv("DASHBOARD_USERNAME", "admin")
    return {"username": fallback_name}

@app.get("/api/status")
async def get_status():
    api_key = os.getenv("BITKUB_API_KEY")
    api_secret = os.getenv("BITKUB_API_SECRET")

    if are_credentials_placeholder(api_key, api_secret):
        return {
            "status": "disconnected",
            "message": "API Keys are set to placeholders. Please edit the .env file in the workspace directory with your actual API credentials."
        }

    try:
        path = "/api/v4/wallet/balances"
        headers = get_auth_headers("GET", path)
        response = await asyncio.to_thread(bitkub_http.get, BITKUB_HOST + path, headers=headers)
        res_json = response.json()
        
        # Bitkub V4 API returns "code": "0" on success
        code = res_json.get("code")
        if code == "0":
            return {
                "status": "connected",
                "message": "Successfully connected to Bitkub API."
            }
        else:
            error_msg = res_json.get("message", f"Error Code {code}")
            return {
                "status": "disconnected",
                "message": f"Connection failed (Bitkub Code {code}): {error_msg}"
            }
    except Exception as e:
        return {
            "status": "disconnected",
            "message": f"Connection failed: {str(e)}"
        }

@app.get("/api/balance")
async def get_balance():
    try:
        path = "/api/v4/wallet/balances"
        headers = get_auth_headers("GET", path)
        response = await asyncio.to_thread(bitkub_http.get, BITKUB_HOST + path, headers=headers)
        res_json = response.json()

        code = res_json.get("code")
        if code != "0":
            raise HTTPException(
                status_code=400, 
                detail=f"Bitkub balance error (Code {code}): {res_json.get('message')}"
            )

        # Calculate bot-locked live positions directly from database
        bot_locked = {}
        try:
            import sqlite3
            conn = sqlite3.connect(bot.db_path if bot else "bot_data.db")
            cursor = conn.cursor()
            cursor.execute("SELECT symbol, amount FROM positions WHERE mode = 'LIVE'")
            for row in cursor.fetchall():
                symbol = row[0]
                amount = float(row[1])
                parts = symbol.split("/")
                if len(parts) == 2:
                    asset = parts[0]
                    bot_locked[asset] = bot_locked.get(asset, 0.0) + amount
            conn.close()
        except Exception as e:
            print(f"Error reading live bot positions for balance lock: {e}")

        data_list = res_json.get("data", [])
        parsed_balances = []
        
        for item in data_list:
            currency = item.get("currency")
            free = float(item.get("available", 0.0))
            used = float(item.get("reserved", 0.0))
            total = float(item.get("total", 0.0))
            
            # If this coin is locked by the bot in LIVE mode
            locked_by_bot = bot_locked.get(currency, 0.0)
            
            # Available free cash/coin for manual trading
            free_for_manual = max(0.0, free - locked_by_bot) if currency != "THB" else free
            
            # Show assets that have balance, or show THB always
            if total > 0.0 or currency == 'THB':
                parsed_balances.append({
                    "asset": currency,
                    "free": free,
                    "used": used,
                    "total": total,
                    "locked_by_bot": locked_by_bot,
                    "free_for_manual": free_for_manual
                })
        
        return {
            "status": "success",
            "balances": parsed_balances
        }
    except HTTPException as he:
        raise he
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch balance: {str(e)}")

@app.get("/api/tickers")
async def get_tickers():
    try:
        # Public ticker endpoint
        url = f"{BITKUB_HOST}/api/market/ticker"
        response = await asyncio.to_thread(bitkub_http.get, url)
        data = response.json()
        
        symbols = bot.config.get("symbols", []) if bot else ["BTC/THB", "ETH/THB", "KUB/THB", "XRP/THB", "USDT/THB"]
        symbols_map = {}
        for s in symbols:
            parts = s.split("/")
            if len(parts) == 2:
                symbols_map[s] = f"THB_{parts[0]}"
            else:
                symbols_map[s] = s
        
        parsed_tickers = {}
        for standard_symbol, bitkub_symbol in symbols_map.items():
            if bitkub_symbol in data:
                t = data[bitkub_symbol]
                parsed_tickers[standard_symbol] = {
                    "last": t.get("last"),
                    "bid": t.get("highestBid"),
                    "ask": t.get("lowestAsk"),
                    "high": t.get("high24hr"),
                    "low": t.get("low24hr"),
                    "percentage": t.get("percentChange"),
                    "change": 0.0,
                    "quoteVolume": t.get("quoteVolume")
                }
        return {
            "status": "success",
            "tickers": parsed_tickers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tickers: {str(e)}")

@app.post("/api/trade")
async def place_trade(trade: TradeRequest):
    try:
        side = trade.side.lower()
        if side not in ['buy', 'sell']:
            raise HTTPException(status_code=400, detail="Side must be 'buy' or 'sell'")
            
        order_type = trade.order_type.lower()
        if order_type not in ['limit', 'market']:
            raise HTTPException(status_code=400, detail="Type must be 'limit' or 'market'")

        # Map symbol from 'BTC/THB' to 'BTC_THB'
        standard_symbol = trade.symbol.upper()
        parts = standard_symbol.split('/')
        if len(parts) == 2:
            bitkub_symbol = f"{parts[0]}_{parts[1]}"
        else:
            bitkub_symbol = standard_symbol

        # Setup endpoint
        if side == 'buy':
            path = "/api/v3/market/place-bid"
        else:
            path = "/api/v3/market/place-ask"

        # Prepare payload
        body = {
            "sym": bitkub_symbol,
            "amt": trade.amount,
            "rat": trade.price if order_type == 'limit' else 0,
            "typ": order_type
        }
        
        headers = get_auth_headers("POST", path, body)
        response = await asyncio.to_thread(bitkub_http.post, BITKUB_HOST + path, json=body, headers=headers)
        res_json = response.json()

        error_code = res_json.get("error", 0)
        if error_code != 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Trade failed (Bitkub Code {error_code}): {res_json.get('message')}"
            )
            
        return {
            "status": "success",
            "order": res_json.get("result", {})
        }
    except HTTPException as he:
        raise he
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order failed: {str(e)}")

# Pydantic model for Cancel Order Request
class CancelOrderRequest(BaseModel):
    symbol: str
    order_id: str
    side: str

@app.get("/api/open-orders")
async def get_open_orders(symbol: str = None):
    try:
        if symbol:
            symbols_to_fetch = [symbol]
        else:
            symbols_to_fetch = bot.config.get("symbols", []) if bot else ["BTC/THB", "ETH/THB", "KUB/THB"]
            
        # Fetch bot order IDs to tag
        bot_order_ids = set()
        try:
            import sqlite3
            conn = sqlite3.connect(bot.db_path if bot else "bot_data.db")
            cursor = conn.cursor()
            cursor.execute("SELECT order_id FROM positions WHERE order_id IS NOT NULL AND order_id != ''")
            for row in cursor.fetchall():
                bot_order_ids.add(str(row[0]))
            conn.close()
        except Exception as e:
            print(f"Error reading bot order IDs: {e}")

        all_open_orders = []
        
        async def fetch_for_symbol(s):
            parts = s.split("/")
            if len(parts) == 2:
                bitkub_symbol = f"{parts[0]}_{parts[1]}"
            else:
                bitkub_symbol = s
                
            path = f"/api/v3/market/my-open-orders?sym={bitkub_symbol.lower()}"
            headers = get_auth_headers("GET", path)
            response = await asyncio.to_thread(bitkub_http.get, BITKUB_HOST + path, headers=headers, timeout=5)
            res_json = response.json()
            
            if res_json.get("error") == 0:
                orders = res_json.get("result", [])
                for o in orders:
                    o["symbol"] = s
                    # Tag order source
                    oid = str(o.get("id", o.get("order_id", "")))
                    o["source"] = "bot" if oid in bot_order_ids else "manual"
                return orders
            return []

        tasks = [fetch_for_symbol(s) for s in symbols_to_fetch]
        results = await asyncio.gather(*tasks)
        
        for r in results:
            all_open_orders.extend(r)
            
        # Sort orders by timestamp descending
        all_open_orders.sort(key=lambda x: x.get("ts", 0), reverse=True)
        
        return {
            "status": "success",
            "open_orders": all_open_orders
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch open orders: {str(e)}")

@app.post("/api/cancel-order")
async def post_cancel_order(req: CancelOrderRequest):
    try:
        parts = req.symbol.split("/")
        if len(parts) == 2:
            bitkub_symbol = f"{parts[0]}_{parts[1]}"
        else:
            bitkub_symbol = req.symbol
            
        path = "/api/v3/market/cancel-order"
        body = {
            "sym": bitkub_symbol.lower(),
            "id": req.order_id,
            "sd": req.side.lower()
        }
        headers = get_auth_headers("POST", path, body)
        response = await asyncio.to_thread(bitkub_http.post, BITKUB_HOST + path, json=body, headers=headers, timeout=5)
        res_json = response.json()
        
        error_code = res_json.get("error", 0)
        if error_code != 0:
            raise HTTPException(status_code=400, detail=f"Cancel failed (Code {error_code}): {res_json.get('message')}")
            
        return {
            "status": "success",
            "result": res_json.get("result")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel order: {str(e)}")

@app.get("/api/order-history")
async def get_order_history(symbol: str = None):
    try:
        if symbol:
            symbols_to_fetch = [symbol]
        else:
            symbols_to_fetch = bot.config.get("symbols", []) if bot else ["BTC/THB", "ETH/THB", "KUB/THB"]
            
        # Fetch bot-placed order IDs from database to cross-reference
        bot_order_ids = set()
        try:
            import sqlite3
            conn = sqlite3.connect(bot.db_path if bot else "bot_data.db")
            cursor = conn.cursor()
            
            # Fetch from active positions (pending sells)
            cursor.execute("SELECT order_id FROM positions WHERE order_id IS NOT NULL AND order_id != ''")
            for row in cursor.fetchall():
                bot_order_ids.add(str(row[0]))
                
            # Fetch from history (buys and sells)
            cursor.execute("SELECT buy_order_id, sell_order_id FROM trade_history")
            for row in cursor.fetchall():
                if row[0]: bot_order_ids.add(str(row[0]))
                if row[1]: bot_order_ids.add(str(row[1]))
            conn.close()
        except Exception as e:
            print(f"Error reading bot order IDs: {e}")

        all_order_history = []
        
        async def fetch_for_symbol(s):
            parts = s.split("/")
            if len(parts) == 2:
                bitkub_symbol = f"{parts[0]}_{parts[1]}"
            else:
                bitkub_symbol = s
                
            path = f"/api/v3/market/my-order-history?sym={bitkub_symbol.lower()}&limit=20"
            headers = get_auth_headers("GET", path)
            response = await asyncio.to_thread(bitkub_http.get, BITKUB_HOST + path, headers=headers, timeout=5)
            res_json = response.json()
            
            if res_json.get("error") == 0:
                orders = res_json.get("result", [])
                for o in orders:
                    o["symbol"] = s
                    # Tag order source
                    oid = str(o.get("id", o.get("order_id", "")))
                    o["source"] = "bot" if oid in bot_order_ids else "manual"
                return orders
            return []

        tasks = [fetch_for_symbol(s) for s in symbols_to_fetch]
        results = await asyncio.gather(*tasks)
        
        for r in results:
            all_order_history.extend(r)
            
        # Sort history by timestamp descending
        all_order_history.sort(key=lambda x: x.get("ts", 0), reverse=True)
        
        return {
            "status": "success",
            "history": all_order_history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch order history: {str(e)}")

# Bot Runtime Lifecycle

@app.on_event("startup")
def startup_event():
    global bot
    bot = BotRunner()

@app.on_event("shutdown")
def shutdown_event():
    global bot
    if bot:
        bot.stop()

# Pydantic models for Bot Requests
class BotToggleRequest(BaseModel):
    dry_run: bool = None
    stake_amount_thb: float = None
    stop_loss_pct: float = None
    take_profit_pct: float = None
    max_open_trades: int = None
    max_budget_thb: float = None
    symbols: list[str] = None
    strategy: str = None

class PanicSellRequest(BaseModel):
    symbol: str

@app.get("/api/bot/strategies")
async def get_bot_strategies():
    return {"status": "success", "strategies": get_strategy_list()}

@app.get("/api/bot/status")
async def get_bot_status():
    if not bot:
        return {"status": "error", "message": "Bot not initialized."}
    return {
        "is_running": bot.config.get("is_running", False),
        "dry_run": bot.config.get("dry_run", True),
        "stake_amount_thb": bot.config.get("stake_amount_thb", 100.0),
        "stop_loss_pct": bot.config.get("stop_loss_pct", -5.0),
        "take_profit_pct": bot.config.get("take_profit_pct", 10.0),
        "max_open_trades": bot.config.get("max_open_trades", 3),
        "max_budget_thb": bot.config.get("max_budget_thb", 5000.0),
        "trade_direction": bot.config.get("trade_direction", "long"),
        "leverage": bot.config.get("leverage", 1),
        "symbols": bot.config.get("symbols", []),
        "timeframe": bot.config.get("timeframe", "15"),
        "strategy": bot.config.get("strategy", "multi_indicator")
    }

@app.post("/api/bot/config")
async def save_bot_config(config_req: BotToggleRequest):
    if not bot:
        raise HTTPException(status_code=500, detail="Bot not initialized.")
    
    mode_changed = False
    if config_req.dry_run is not None:
        old_dry_run = bot.config.get("dry_run", True)
        if old_dry_run != config_req.dry_run:
            mode_changed = True
        bot.config["dry_run"] = config_req.dry_run
        
    if config_req.stake_amount_thb is not None:
        bot.config["stake_amount_thb"] = config_req.stake_amount_thb
    if config_req.stop_loss_pct is not None:
        bot.config["stop_loss_pct"] = config_req.stop_loss_pct
    if config_req.take_profit_pct is not None:
        bot.config["take_profit_pct"] = config_req.take_profit_pct
    if config_req.max_open_trades is not None:
        bot.config["max_open_trades"] = max(1, config_req.max_open_trades)
    if config_req.max_budget_thb is not None:
        bot.config["max_budget_thb"] = max(0.0, config_req.max_budget_thb)
    if config_req.symbols is not None:
        bot.config["symbols"] = [sym.strip().upper() for sym in config_req.symbols if sym]
    if config_req.strategy is not None:
        bot.config["strategy"] = config_req.strategy
    bot.config["trade_direction"] = "long"
    bot.config["leverage"] = 1
        
    bot.save_json("bot_config.json", bot.config)
    
    if mode_changed:
        bot.add_log(f"Trading mode changed to: {'Dry-Run' if bot.config['dry_run'] else 'LIVE'}. Reloading active positions.")
        bot.load_positions_from_db()
        
    return {"status": "success", "config": bot.config}

@app.post("/api/bot/toggle")
async def toggle_bot():
    if not bot:
        raise HTTPException(status_code=500, detail="Bot not initialized.")
    
    # Toggle running status
    if bot.config.get("is_running", False):
        bot.stop()
    else:
        bot.start()
        
    return {
        "status": "success",
        "is_running": bot.config.get("is_running", False),
        "dry_run": bot.config.get("dry_run", True)
    }

@app.get("/api/bot/positions")
async def get_bot_positions():
    if not bot:
        return []
    bot.update_active_positions_pnl()
    return list(bot.positions.values())

@app.get("/api/bot/history")
async def get_bot_history():
    if not bot:
        return []
    return bot.get_history()

@app.get("/api/bot/logs")
async def get_bot_logs():
    if not bot:
        return []
    return bot.logs

@app.post("/api/bot/panic-sell")
async def bot_panic_sell(req: PanicSellRequest):
    if not bot:
        raise HTTPException(status_code=500, detail="Bot not initialized.")
    
    symbol = req.symbol
    if symbol not in bot.positions:
        raise HTTPException(status_code=400, detail="No active position found for this symbol.")
    
    # Fetch latest price
    try:
        url = f"{BITKUB_HOST}/api/market/ticker"
        r = await asyncio.to_thread(bitkub_http.get, url, timeout=5)
        ticker_data = r.json()
        
        parts = symbol.split("/")
        if len(parts) == 2:
            bitkub_symbol = f"THB_{parts[0]}"
        else:
            bitkub_symbol = symbol
        if bitkub_symbol in ticker_data:
            last_price = float(ticker_data[bitkub_symbol]["last"])
        else:
            raise ValueError(f"Ticker price not found for {symbol}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch current price: {str(e)}")

    success = bot.execute_sell(symbol, last_price, reason="Emergency Panic Sell via UI")
    if success:
        return {"status": "success", "message": f"Successfully sold {symbol}."}
    else:
        raise HTTPException(status_code=500, detail="Panic sell execution failed.")


# ----------------------------------------------------
# Credential Configuration API (Local Settings)
# ----------------------------------------------------
class CredentialsUpdateRequest(BaseModel):
    username: str = None
    password: str = None
    api_key: str = None
    api_secret: str = None

def update_env_file(updates: dict):
    env_path = ".env"
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    
    env_dict = {}
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            parts = line.split("=", 1)
            if len(parts) == 2:
                k, v = parts
                env_dict[k.strip()] = v.strip().strip('"').strip("'")
                
    for k, v in updates.items():
        if v is not None:
            env_dict[k] = v
            os.environ[k] = str(v)
            
    with open(env_path, "w", encoding="utf-8") as f:
        for k, v in env_dict.items():
            f.write(f'{k}="{v}"\n')

@app.get("/api/settings/credentials")
async def get_credentials():
    api_key = os.getenv("BITKUB_API_KEY", "")
    api_secret = os.getenv("BITKUB_API_SECRET", "")
    
    # Mask values
    masked_key = api_key[:6] + "..." + api_key[-4:] if len(api_key) > 10 else "not set" if not api_key else "configured"
    masked_secret = api_secret[:6] + "..." + api_secret[-4:] if len(api_secret) > 10 else "not set" if not api_secret else "configured"
    
    return {
        "status": "success",
        "username": os.getenv("DASHBOARD_USERNAME", "admin"),
        "api_key_masked": masked_key,
        "api_secret_masked": masked_secret,
        "has_api_key": bool(api_key and not are_credentials_placeholder(api_key, api_secret))
    }

@app.post("/api/settings/credentials")
async def update_credentials(req: CredentialsUpdateRequest):
    updates = {}
    if req.username is not None and req.username.strip():
        updates["DASHBOARD_USERNAME"] = req.username.strip()
    if req.password is not None and req.password.strip():
        updates["DASHBOARD_PASSWORD"] = req.password.strip()
    if req.api_key is not None and req.api_key.strip():
        updates["BITKUB_API_KEY"] = req.api_key.strip()
    if req.api_secret is not None and req.api_secret.strip():
        updates["BITKUB_API_SECRET"] = req.api_secret.strip()
        
    if updates:
        try:
            update_env_file(updates)
            return {"status": "success", "message": "Credentials updated successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update credentials: {str(e)}")
    return {"status": "success", "message": "No updates applied"}


# ----------------------------------------------------
# Static Frontend Serving (Packaged Desktop Mode)
# ----------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend", "out")

if os.path.exists(FRONTEND_DIR):
    print(f"Frontend static files found at {FRONTEND_DIR}. Serving static files.")
    
    # Mount Next.js _next static assets folder directly
    next_assets_dir = os.path.join(FRONTEND_DIR, "_next")
    if os.path.exists(next_assets_dir):
        app.mount("/_next", StaticFiles(directory=next_assets_dir), name="next_assets")
        
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        # Allow bypass for api
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
            
        # Try to find the literal file
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Handle paths without extensions (e.g. /login -> login.html)
        html_path = os.path.join(FRONTEND_DIR, f"{path}.html")
        if os.path.isfile(html_path):
            return FileResponse(html_path)
            
        # Handle directory index paths
        dir_index_path = os.path.join(FRONTEND_DIR, path, "index.html")
        if os.path.isfile(dir_index_path):
            return FileResponse(dir_index_path)
            
        # Fallback to SPA index.html
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    import os
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8282"))
    uvicorn.run("backend:app", host=host, port=port, reload=False)
