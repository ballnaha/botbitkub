import os
import time
import hmac
import hashlib
import json
import math
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
bitkub_http.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
})

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
        
        parsed_tickers = {}
        for key, t in data.items():
            if key.startswith("THB_"):
                base = key.split("_", 1)[1]
                standard_symbol = f"{base}/THB"
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

        # Map symbol from 'BTC/THB' to Bitkub V3 pair format 'BTC_THB'
        standard_symbol = trade.symbol.upper()
        parts = standard_symbol.split('/')
        if len(parts) == 2:
            bitkub_symbol = f"{parts[0]}_{parts[1]}".lower()
        else:
            bitkub_symbol = standard_symbol.lower()

        # Setup endpoint
        if side == 'buy':
            path = "/api/v3/market/place-bid"
        else:
            path = "/api/v3/market/place-ask"

        # Format amount and rate using bot helper if bot is initialized
        if bot:
            scales = bot.get_symbol_scales(standard_symbol)
            qty_scale = scales["quantity_scale"]
            price_scale = scales["price_scale"]
            bitkub_symbol = scales.get("symbol", f"{parts[0]}_{parts[1]}").lower()
            
            if side == "sell":
                formatted_amt = bot.floor_order_amount(trade.amount, qty_scale)
            else:
                if order_type == "market":
                    formatted_amt = bot.floor_order_amount(trade.amount, 2)
                else:
                    formatted_amt = bot.floor_order_amount(trade.amount, qty_scale)
                    
            formatted_rat = bot.floor_order_amount(trade.price, price_scale) if order_type == "limit" else 0
        else:
            formatted_amt = trade.amount
            formatted_rat = trade.price if order_type == "limit" else 0

        # Prepare payload
        body = {
            "sym": bitkub_symbol,
            "amt": formatted_amt,
            "rat": formatted_rat,
            "typ": order_type
        }
        
        print(f"DEBUG place_trade: body={body}, path={path}")
        headers = get_auth_headers("POST", path, body)
        response = await asyncio.to_thread(bitkub_http.post, BITKUB_HOST + path, json=body, headers=headers)
        res_json = response.json()
        print(f"DEBUG place_trade: response={res_json}")

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
                if bot:
                    scales = bot.get_symbol_scales(s)
                    bitkub_symbol = scales.get("symbol", f"{parts[0]}_{parts[1]}").lower()
                else:
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
            if bot:
                scales = bot.get_symbol_scales(req.symbol)
                bitkub_symbol = scales.get("symbol", f"{parts[0]}_{parts[1]}").lower()
            else:
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
                if bot:
                    scales = bot.get_symbol_scales(s)
                    bitkub_symbol = scales.get("symbol", f"{parts[0]}_{parts[1]}").lower()
                else:
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
    ai_enabled: bool = None
    ai_provider: str = None
    ai_model: str = None
    ai_min_score: int = None
    ai_min_confidence: float = None
    ai_timeout_seconds: float = None

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
        "strategy": bot.config.get("strategy", "multi_indicator"),
        "ai_enabled": bot.config.get("ai_enabled", False),
        "ai_provider": bot.config.get("ai_provider", "gemini"),
        "ai_model": bot.config.get("ai_model", "gemini-3.5-flash"),
        "ai_min_score": bot.config.get("ai_min_score", 65),
        "ai_min_confidence": bot.config.get("ai_min_confidence", 0.55),
        "ai_timeout_seconds": bot.config.get("ai_timeout_seconds", 8),
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
    if config_req.ai_enabled is not None:
        bot.config["ai_enabled"] = config_req.ai_enabled
    if config_req.ai_provider is not None:
        bot.config["ai_provider"] = config_req.ai_provider.strip().lower() or "gemini"
    if config_req.ai_model is not None:
        bot.config["ai_model"] = config_req.ai_model.strip() or "gemini-3.5-flash"
    if config_req.ai_min_score is not None:
        bot.config["ai_min_score"] = max(0, min(100, config_req.ai_min_score))
    if config_req.ai_min_confidence is not None:
        bot.config["ai_min_confidence"] = max(0.0, min(1.0, config_req.ai_min_confidence))
    if config_req.ai_timeout_seconds is not None:
        bot.config["ai_timeout_seconds"] = max(2.0, min(30.0, config_req.ai_timeout_seconds))
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
    bot.reconcile_live_positions_with_wallet()
    bot.update_active_positions_pnl()
    return list(bot.positions.values())

@app.get("/api/bot/history")
async def get_bot_history():
    if not bot:
        return []
    return bot.get_history()

@app.get("/api/bot/ai-watchlist")
async def get_bot_ai_watchlist():
    if not bot:
        return []
    return bot.get_ai_watchlist()

@app.get("/api/bot/wallet-summary")
async def get_bot_wallet_summary():
    if not bot:
        raise HTTPException(status_code=500, detail="Bot not initialized.")

    dry_run = bot.config.get("dry_run", True)
    
    # Fetch current ticker prices to convert coin balances to THB
    ticker_data = {}
    try:
        url = "https://api.bitkub.com/api/market/ticker"
        r = await asyncio.to_thread(bitkub_http.get, url, timeout=5)
        if r.status_code == 200:
            ticker_data = r.json()
    except Exception as e:
        print(f"Error fetching ticker for wallet summary: {e}")

    # Helper to get ticker price
    def get_coin_price(coin):
        coin = coin.upper()
        if coin == "THB":
            return 1.0
        bitkub_symbol = f"THB_{coin}"
        if bitkub_symbol in ticker_data:
            return float(ticker_data[bitkub_symbol].get("last", 0.0))
        return 0.0

    def floor_thb(value):
        return math.floor(max(0.0, float(value)) * 100) / 100

    assets = []
    total_balance_thb = 0.0
    total_invested_thb = 0.0
    total_cost_basis_thb = 0.0

    if dry_run:
        # Dry-run wallet simulation
        max_budget = float(bot.config.get("max_budget_thb", 5000.0))
        
        # Calculate budget in use by active positions
        invested = 0.0
        for symbol, pos in bot.positions.items():
            invested += float(pos.get("amount", 0.0)) * float(pos.get("buy_price", 0.0))
            
        available_thb = max(0.0, max_budget - invested)
        
        # Add THB cash asset
        assets.append({
            "currency": "THB",
            "available": available_thb,
            "reserved": 0.0,
            "total": available_thb,
            "bot_amount": 0.0,
            "free_for_manual": available_thb,
            "value_thb": available_thb,
            "bot_value_thb": 0.0,
            "current_price": 1.0,
            "avg_entry_price": 1.0,
            "pnl_percent": 0.0,
            "pnl_thb": 0.0
        })
        total_balance_thb += available_thb

        # Add coin assets from active positions
        for symbol, pos in bot.positions.items():
            base_coin = symbol.split("/")[0].upper()
            amount = float(pos.get("amount", 0.0))
            buy_price = float(pos.get("buy_price", 0.0))
            current_price = get_coin_price(base_coin) or buy_price
            
            pnl_percent = ((current_price - buy_price) / buy_price) * 100
            pnl_thb = (amount * current_price * 0.9975) - (amount * buy_price)
            value_thb = floor_thb(amount * current_price)
            
            assets.append({
                "currency": base_coin,
                "available": amount,
                "reserved": 0.0,
                "total": amount,
                "bot_amount": amount,
                "free_for_manual": 0.0,
                "value_thb": value_thb,
                "bot_value_thb": value_thb,
                "current_price": current_price,
                "avg_entry_price": buy_price,
                "pnl_percent": pnl_percent,
                "pnl_thb": pnl_thb
            })
            total_balance_thb += value_thb
            total_invested_thb += value_thb
            total_cost_basis_thb += (amount * buy_price)

    else:
        # LIVE wallet fetching
        api_key = os.getenv("BITKUB_API_KEY")
        api_secret = os.getenv("BITKUB_API_SECRET")
        if are_credentials_placeholder(api_key, api_secret):
            raise HTTPException(status_code=400, detail="API credentials are not configured in the .env file.")

        try:
            path = "/api/v4/wallet/balances"
            headers = get_auth_headers("GET", path)
            response = await asyncio.to_thread(bitkub_http.get, BITKUB_HOST + path, headers=headers, timeout=8)
            res_json = response.json()
            
            code = res_json.get("code")
            if code not in ("0", 0):
                raise ValueError(f"Bitkub balance API error (Code {code}): {res_json.get('message')}")
            
            balances_data = res_json.get("data", [])
            raw_balances = []
            if isinstance(balances_data, list):
                raw_balances = balances_data
            elif isinstance(balances_data, dict):
                for curr, val in balances_data.items():
                    if isinstance(val, dict):
                        raw_balances.append({
                            "currency": curr.upper(),
                            "available": float(val.get("available", 0.0) or 0.0),
                            "reserved": float(val.get("reserved", 0.0) or 0.0)
                        })
                    else:
                        raw_balances.append({
                            "currency": curr.upper(),
                            "available": float(val or 0.0),
                            "reserved": 0.0
                        })

            # Process assets
            for item in raw_balances:
                curr = item.get("currency", "").upper()
                available = float(item.get("available", 0.0) or 0.0)
                reserved = float(item.get("reserved", 0.0) or 0.0)
                total = available + reserved
                
                # Filter out microscopic balances to keep UI clean, but always keep THB
                if total <= 0.000001 and curr != "THB":
                    continue
                
                current_price = get_coin_price(curr)
                value_thb = floor_thb(total * current_price) if curr != "THB" else total
                
                # Check if we have an active position tracked for this symbol (curr/THB)
                pair_symbol = f"{curr}/THB"
                avg_entry_price = None
                pnl_percent = 0.0
                pnl_thb = 0.0
                bot_amount = 0.0
                
                if pair_symbol in bot.positions:
                    pos = bot.positions[pair_symbol]
                    bot_amount = min(total, float(pos.get("amount", 0.0) or 0.0))
                    avg_entry_price = float(pos.get("buy_price", 0.0))
                    pnl_percent = float(pos.get("pnl_percent", 0.0))
                    pnl_thb = float(pos.get("pnl_thb", 0.0))
                    total_cost_basis_thb += (bot_amount * avg_entry_price)
                free_for_manual = max(0.0, available - bot_amount) if curr != "THB" else available
                bot_value_thb = floor_thb(bot_amount * current_price) if curr != "THB" else 0.0
                
                assets.append({
                    "currency": curr,
                    "available": available,
                    "reserved": reserved,
                    "total": total,
                    "bot_amount": bot_amount,
                    "free_for_manual": free_for_manual,
                    "value_thb": value_thb,
                    "bot_value_thb": bot_value_thb,
                    "current_price": current_price if curr != "THB" else 1.0,
                    "avg_entry_price": avg_entry_price,
                    "pnl_percent": pnl_percent,
                    "pnl_thb": pnl_thb
                })
                total_balance_thb += value_thb
                if curr != "THB":
                    total_invested_thb += value_thb

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch live balances: {str(e)}")

    # Calculate overall stats
    overall_pnl_thb = 0.0
    overall_pnl_percent = 0.0
    
    for asset in assets:
        if asset["avg_entry_price"] is not None and asset["currency"] != "THB":
            overall_pnl_thb += asset["pnl_thb"]
            
    if total_cost_basis_thb > 0:
        overall_pnl_percent = (overall_pnl_thb / total_cost_basis_thb) * 100

    return {
        "status": "success",
        "dry_run": dry_run,
        "total_balance_thb": total_balance_thb,
        "total_invested_thb": total_invested_thb,
        "overall_pnl_thb": overall_pnl_thb,
        "overall_pnl_percent": overall_pnl_percent,
        "assets": assets
    }

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
        detail = getattr(bot, "last_trade_error", "") or "Panic sell execution failed."
        raise HTTPException(status_code=500, detail=detail)


# ----------------------------------------------------
# Credential Configuration API (Local Settings)
# ----------------------------------------------------
class CredentialsUpdateRequest(BaseModel):
    username: str = None
    password: str = None
    api_key: str = None
    api_secret: str = None
    gemini_api_key: str = None
    deepseek_api_key: str = None

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
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
    
    # Mask values
    masked_key = api_key[:6] + "..." + api_key[-4:] if len(api_key) > 10 else "not set" if not api_key else "configured"
    masked_secret = api_secret[:6] + "..." + api_secret[-4:] if len(api_secret) > 10 else "not set" if not api_secret else "configured"
    masked_gemini_key = gemini_api_key[:6] + "..." + gemini_api_key[-4:] if len(gemini_api_key) > 10 else "not set" if not gemini_api_key else "configured"
    masked_deepseek_key = deepseek_api_key[:6] + "..." + deepseek_api_key[-4:] if len(deepseek_api_key) > 10 else "not set" if not deepseek_api_key else "configured"
    
    return {
        "status": "success",
        "username": os.getenv("DASHBOARD_USERNAME", "admin"),
        "api_key_masked": masked_key,
        "api_secret_masked": masked_secret,
        "gemini_api_key_masked": masked_gemini_key,
        "deepseek_api_key_masked": masked_deepseek_key,
        "has_gemini_api_key": bool(gemini_api_key),
        "has_deepseek_api_key": bool(deepseek_api_key),
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
    if req.gemini_api_key is not None and req.gemini_api_key.strip():
        updates["GEMINI_API_KEY"] = req.gemini_api_key.strip()
    if req.deepseek_api_key is not None and req.deepseek_api_key.strip():
        updates["DEEPSEEK_API_KEY"] = req.deepseek_api_key.strip()
        
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
