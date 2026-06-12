import os
import pprint
from dotenv import load_dotenv
from ai_analyzer import GeminiTradeAnalyzer

load_dotenv()

analyzer = GeminiTradeAnalyzer()

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

# 1. Test Gemini
print("=================== TESTING GEMINI ===================")
config_gemini = {
    "ai_provider": "gemini",
    "ai_model": "gemini-3.5-flash",
    "ai_timeout_seconds": 8.0,
    "max_open_trades": 3,
    "stake_amount_thb": 100.0,
    "max_budget_thb": 5000.0,
    "take_profit_pct": 10.0,
    "stop_loss_pct": -5.0
}
if not analyzer.is_configured(config_gemini):
    print("Skip Gemini: GEMINI_API_KEY is not configured in .env.")
else:
    try:
        print("Sending analysis request to Gemini...")
        result = analyzer.analyze_buy_signal(symbol, market_snapshot, positions_snapshot, config_gemini)
        print("\nGemini Analysis Result:")
        pprint.pprint(result)
    except Exception as e:
        print("Gemini Analysis Failed:", str(e))

# 2. Test DeepSeek
print("\n=================== TESTING DEEPSEEK ===================")
config_deepseek = {
    "ai_provider": "deepseek",
    "ai_model": "deepseek-reasoner",
    "ai_timeout_seconds": 8.0,
    "max_open_trades": 3,
    "stake_amount_thb": 100.0,
    "max_budget_thb": 5000.0,
    "take_profit_pct": 10.0,
    "stop_loss_pct": -5.0
}
if not analyzer.is_configured(config_deepseek):
    print("Skip DeepSeek: DEEPSEEK_API_KEY is not configured in .env.")
else:
    try:
        print("Sending analysis request to DeepSeek R1...")
        result = analyzer.analyze_buy_signal(symbol, market_snapshot, positions_snapshot, config_deepseek)
        print("\nDeepSeek Analysis Result:")
        pprint.pprint(result)
    except Exception as e:
        print("DeepSeek Analysis Failed:", str(e))

