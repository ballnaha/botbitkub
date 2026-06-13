# Strategies package initializer

# Registry of all available strategies with metadata for the frontend UI.
STRATEGY_REGISTRY = {
    "macd_rsi": {
        "name": "🛡️ เล่นตามจังหวะกลับตัว (Safe Reversal)",
        "description": "รอจังหวะที่ราคาลงมาต่ำแล้วกลับตัวขึ้น โดยใช้สัญญาณ MACD และ RSI ช่วยยืนยัน เหมาะกับคนที่ต้องการความปลอดภัยสูง เทรดไม่บ่อยแต่มั่นคง",
        "indicators": ["MACD (12, 26, 9)", "RSI (14)"],
        "risk_level": "low",
        "market_condition": "sideway",
        "buy_logic": "MACD Line ตัดขึ้นเหนือ Signal Line + MACD Line < 0 + RSI < 55",
        "sell_logic": "MACD Line ตัดลงใต้ Signal Line หรือ RSI > 70",
    },
    "multi_indicator": {
        "name": "⚖️ วิเคราะห์รอบด้าน (Balanced Signal)",
        "description": "ใช้ 4 เครื่องมือช่วยวิเคราะห์พร้อมกัน (RSI, Bollinger Bands, EMA, Volume) ซื้อเมื่อผ่านอย่างน้อย 2 ใน 4 เงื่อนไข ช่วยกรองสัญญาณหลอกได้ดี เหมาะกับผู้เริ่มต้น",
        "indicators": ["RSI (14)", "Bollinger Bands (20, 2σ)", "EMA 9/21 Crossover", "Volume SMA (20)"],
        "risk_level": "medium",
        "market_condition": "sideway",
        "buy_logic": "ผ่านอย่างน้อย 2 ใน 4 เงื่อนไข: RSI < 40, ราคา < BB Lower, EMA 9 > EMA 21, Volume > SMA",
        "sell_logic": "ผ่าน 1 ใน 3 เงื่อนไข: RSI > 70, ราคา > BB Upper, EMA 9 < EMA 21",
    },
    "aggressive_momentum": {
        "name": "🚀 เก็งกำไรเร็ว (Fast Breakout)",
        "description": "ซื้อทันทีเมื่อราคาทะลุจุดสูงสุดระยะสั้น พร้อมแรงซื้อหนุน เทรดบ่อย กำไรไว แต่ผันผวนสูง เหมาะกับคนรับความเสี่ยงได้",
        "indicators": ["EMA 5/13 Trend", "12-Candle Breakout", "RSI (14)", "Volume SMA (12)"],
        "risk_level": "high",
        "market_condition": "uptrend",
        "buy_logic": "ราคา Close ทะลุ High 12 แท่งก่อนหน้า + EMA 5 > EMA 13 + RSI 48-78 + Volume > 1.15x SMA",
        "sell_logic": "ขายเมื่อ RSI > 82, ราคา Close ต่ำกว่า EMA 5, หรือหลุด Low ระยะสั้น",
    },
    "supertrend_ema": {
        "name": "📈 เทรดตามเทรนด์ (Trend Following)",
        "description": "ใช้ Supertrend (อิงความผันผวนจาก ATR) จับทิศทางตลาด ซื้อเมื่อเทรนด์พลิกเป็นขาขึ้นและราคายืนเหนือ EMA 50 เน้นถือกำไรยาวตามเทรนด์ ตัดขาดทุนสั้น เหมาะกับตลาดที่เป็นเทรนด์ชัดเจน",
        "indicators": ["Supertrend (ATR 10, x3)", "EMA 50 Trend Filter", "RSI (14)"],
        "risk_level": "medium",
        "market_condition": "uptrend",
        "buy_logic": "แท่งแรกที่ Supertrend เป็นขาขึ้น (เขียว) + ราคา Close > EMA 50 + RSI < 78",
        "sell_logic": "Supertrend พลิกเป็นขาลง (แดง)",
    },
    "bounce_scalper": {
        "name": "🎯 เก็บเด้งขาลง (Bounce Scalper)",
        "description": "เล่น long ในตลาดขาลงโดยเฉพาะ ซื้อตอนราคาถูกขายทิ้งจนหลุดกรอบล่าง + oversold แล้วเริ่มเด้งกลับ เน้นเข้าน้อย ออกไว เก็บกำไรสั้น (counter-trend) ควรตั้ง TP สั้นและ SL แน่น",
        "indicators": ["RSI (14)", "Bollinger Bands (20, 2σ)", "Reversal Candle"],
        "risk_level": "medium",
        "market_condition": "downtrend",
        # counter-trend: AI มักให้คะแนนระมัดระวัง จึงผ่อนเกณฑ์ AI Gate ลงเพื่อไม่ให้ปฏิเสธสัญญาณเด้งทิ้งหมด
        "ai_min_score": 55,
        "ai_min_confidence": 0.45,
        "buy_logic": "แท่งก่อนหน้า Close < BB Lower + RSI < 35 + แท่งนี้กลับตัวขึ้น (เขียว และ Close > แท่งก่อน)",
        "sell_logic": "ราคา Close >= เส้นกลาง BB หรือ RSI > 60 (ออกไวเก็บกำไรเด้ง)",
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
