# Strategies package initializer

# Registry of all available strategies with metadata for the frontend UI
STRATEGY_REGISTRY = {
    "multi_indicator": {
        "name": "Multi-Indicator Confirmation",
        "description": "ซื้อเมื่อผ่านเงื่อนไข 2 ใน 4 ข้อ (RSI, Bollinger Bands, EMA Crossover, Volume) — สัญญาณมีความน่าเชื่อถือสูง เหมาะกับตลาดผันผวน",
        "indicators": ["RSI (14)", "Bollinger Bands (20, 2σ)", "EMA 9/21 Crossover", "Volume SMA (20)"],
        "risk_level": "medium",
        "buy_logic": "ผ่านอย่างน้อย 2 ใน 4 เงื่อนไข: RSI < 40, ราคา < BB Lower, EMA 9 > EMA 21, Volume > SMA",
        "sell_logic": "ผ่าน 1 ใน 3 เงื่อนไข: RSI > 70, ราคา > BB Upper, EMA 9 < EMA 21",
    },
    "macd_rsi": {
        "name": "MACD & RSI Crossover",
        "description": "ซื้อเมื่อ MACD ตัดขึ้น (Golden Cross) ในโซนลบ + RSI < 55 — เน้นจับจังหวะกลับตัวจากขาลง เหมาะกับเทรนด์ชัดเจน",
        "indicators": ["MACD (12, 26, 9)", "RSI (14)"],
        "risk_level": "low",
        "buy_logic": "MACD Line ตัดขึ้นเหนือ Signal Line + MACD Line < 0 + RSI < 55",
        "sell_logic": "MACD Line ตัดลงใต้ Signal Line หรือ RSI > 70",
    },
}

def get_strategy_list():
    """Return list of strategy metadata for frontend API"""
    result = []
    for key, meta in STRATEGY_REGISTRY.items():
        result.append({
            "id": key,
            **meta
        })
    return result
