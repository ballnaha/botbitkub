# Strategies package initializer

# Registry of all available strategies with metadata for the frontend UI.
STRATEGY_REGISTRY = {
    "macd_rsi": {
        "name": "MACD & RSI Crossover",
        "description": "ซื้อเมื่อ MACD ตัดขึ้นในโซนลบ และ RSI ยังไม่ร้อนแรงเกินไป เหมาะกับการรอจังหวะกลับตัวที่ค่อนข้างนิ่ง",
        "indicators": ["MACD (12, 26, 9)", "RSI (14)"],
        "risk_level": "low",
        "buy_logic": "MACD Line ตัดขึ้นเหนือ Signal Line + MACD Line < 0 + RSI < 55",
        "sell_logic": "MACD Line ตัดลงใต้ Signal Line หรือ RSI > 70",
    },
    "multi_indicator": {
        "name": "Multi-Indicator Confirmation",
        "description": "ซื้อเมื่อผ่านเงื่อนไข 2 ใน 4 ข้อจาก RSI, Bollinger Bands, EMA และ Volume เพื่อช่วยลดสัญญาณหลอก",
        "indicators": ["RSI (14)", "Bollinger Bands (20, 2σ)", "EMA 9/21 Crossover", "Volume SMA (20)"],
        "risk_level": "medium",
        "buy_logic": "ผ่านอย่างน้อย 2 ใน 4 เงื่อนไข: RSI < 40, ราคา < BB Lower, EMA 9 > EMA 21, Volume > SMA",
        "sell_logic": "ผ่าน 1 ใน 3 เงื่อนไข: RSI > 70, ราคา > BB Upper, EMA 9 < EMA 21",
    },
    "aggressive_momentum": {
        "name": "Aggressive Momentum Breakout",
        "description": "ซื้อเมื่อราคาทะลุกรอบสูงระยะสั้น พร้อมแนวโน้มและปริมาณซื้อขายสนับสนุน สัญญาณไวขึ้นแต่ผันผวนมากขึ้น",
        "indicators": ["EMA 5/13 Trend", "12-Candle Breakout", "RSI (14)", "Volume SMA (12)"],
        "risk_level": "high",
        "buy_logic": "ราคา Close ทะลุ High 12 แท่งก่อนหน้า + EMA 5 > EMA 13 + RSI 48-78 + Volume > 1.15x SMA",
        "sell_logic": "ขายเมื่อ RSI > 82, ราคา Close ต่ำกว่า EMA 5, หรือหลุด Low ระยะสั้น",
    },
}


def get_strategy_list():
    """Return list of strategy metadata for frontend API."""
    result = []
    for key, meta in STRATEGY_REGISTRY.items():
        result.append({
            "id": key,
            **meta,
        })
    return result
