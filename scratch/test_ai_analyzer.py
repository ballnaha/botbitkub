import os
from dotenv import load_dotenv
from ai_analyzer import GeminiTradeAnalyzer

load_dotenv()

analyzer = GeminiTradeAnalyzer()
if not analyzer.is_configured():
    print("Error: GEMINI_API_KEY is not configured in .env.")
    exit(1)

symbol = "WLD/THB"
market_snapshot = {
    "last_price": 50.5,
    "rsi": 42.1,
    "macd_line": 0.12,
    "signal_line": 0.05,
    "volume_ratio": 1.2,
    "trend": "bullish"
}
positions_snapshot = {}
config = {
    "ai_model": "gemini-3.5-flash",
    "ai_timeout_seconds": 8.0,
    "max_open_trades": 3,
    "stake_amount_thb": 100.0,
    "max_budget_thb": 5000.0,
    "take_profit_pct": 10.0,
    "stop_loss_pct": -5.0
}

try:
    print("Sending analysis request to Gemini...")
    result = analyzer.analyze_buy_signal(symbol, market_snapshot, positions_snapshot, config)
    print("\nAnalysis Result:")
    import pprint
    pprint.pprint(result)
except Exception as e:
    print("Analysis Failed:", str(e))
