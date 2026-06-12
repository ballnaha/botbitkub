# Strategies package initializer

# Registry of all available strategies with metadata for the frontend UI.
STRATEGY_REGISTRY = {
    "macd_rsi": {
        "name": "🛡️ เล่นตามจังหวะกลับตัว (Safe Reversal)",
        "description": "รอจังหวะที่ราคาลงมาต่ำแล้วกลับตัวขึ้น โดยใช้สัญญาณ MACD และ RSI ช่วยยืนยัน เหมาะกับคนที่ต้องการความปลอดภัยสูง เทรดไม่บ่อยแต่มั่นคง",
        "indicators": ["MACD (12, 26, 9)", "RSI (14)"],
        "risk_level": "low",
        "buy_logic": "MACD Line ตัดขึ้นเหนือ Signal Line + MACD Line < 0 + RSI < 55",
        "sell_logic": "MACD Line ตัดลงใต้ Signal Line หรือ RSI > 70",
    },
    "multi_indicator": {
        "name": "⚖️ วิเคราะห์รอบด้าน (Balanced Signal)",
        "description": "ใช้ 4 เครื่องมือช่วยวิเคราะห์พร้อมกัน (RSI, Bollinger Bands, EMA, Volume) ซื้อเมื่อผ่านอย่างน้อย 2 ใน 4 เงื่อนไข ช่วยกรองสัญญาณหลอกได้ดี เหมาะกับผู้เริ่มต้น",
        "indicators": ["RSI (14)", "Bollinger Bands (20, 2σ)", "EMA 9/21 Crossover", "Volume SMA (20)"],
        "risk_level": "medium",
        "buy_logic": "ผ่านอย่างน้อย 2 ใน 4 เงื่อนไข: RSI < 40, ราคา < BB Lower, EMA 9 > EMA 21, Volume > SMA",
        "sell_logic": "ผ่าน 1 ใน 3 เงื่อนไข: RSI > 70, ราคา > BB Upper, EMA 9 < EMA 21",
    },
    "aggressive_momentum": {
        "name": "🚀 เก็งกำไรเร็ว (Fast Breakout)",
        "description": "ซื้อทันทีเมื่อราคาทะลุจุดสูงสุดระยะสั้น พร้อมแรงซื้อหนุน เทรดบ่อย กำไรไว แต่ผันผวนสูง เหมาะกับคนรับความเสี่ยงได้",
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
