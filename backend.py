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
    
    # 1. Allow public routes
    if path in ["/api/login"]:
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

        data_list = res_json.get("data", [])
        parsed_balances = []
        
        for item in data_list:
            currency = item.get("currency")
            free = float(item.get("available", 0.0))
            used = float(item.get("reserved", 0.0))
            total = float(item.get("total", 0.0))
            # Show assets that have balance, or show THB always
            if total > 0.0 or currency == 'THB':
                parsed_balances.append({
                    "asset": currency,
                    "free": free,
                    "used": used,
                    "total": total
                })
        
        return {
            "status": "success",
            "balances": parsed_balances
        }
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

        # Map symbol from 'BTC/THB' to 'THB_BTC'
        standard_symbol = trade.symbol.upper()
        parts = standard_symbol.split('/')
        if len(parts) == 2:
            bitkub_symbol = f"THB_{parts[0]}"
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
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order failed: {str(e)}")

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
    symbols: list[str] = None

class PanicSellRequest(BaseModel):
    symbol: str

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
        "trade_direction": bot.config.get("trade_direction", "long"),
        "leverage": bot.config.get("leverage", 1),
        "symbols": bot.config.get("symbols", []),
        "timeframe": bot.config.get("timeframe", "15")
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
    if config_req.symbols is not None:
        bot.config["symbols"] = [sym.strip().upper() for sym in config_req.symbols if sym]
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


if __name__ == "__main__":
    import uvicorn
    import os
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8282"))
    uvicorn.run("backend:app", host=host, port=port, reload=False)
