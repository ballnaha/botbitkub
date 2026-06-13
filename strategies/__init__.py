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
    "ema_pullback_trend": {
        "name": "🌊 EMA Pullback Trend",
        "description": "เทรดตามเทรนด์ขาขึ้นแบบไม่ไล่ราคา รอให้ราคาอยู่เหนือ EMA200 แล้วพักตัวกลับมาใกล้ EMA20/EMA50 ก่อนเริ่มเด้ง เหมาะกับ Spot long-only และตลาดที่แข็งแรง",
        "indicators": ["EMA 20/50/200", "RSI (14)", "Volume SMA (20)", "Pullback Distance"],
        "risk_level": "low",
        "market_condition": "uptrend",
        "ai_min_score": 72,
        "ai_min_confidence": 0.62,
        "buy_logic": "Close > EMA200 + EMA50 > EMA200 + Close reclaim EMA20 + เคยย่อใกล้ EMA20/50 ใน 5 แท่งล่าสุด + RSI 42-68 + Volume > 0.8x SMA20",
        "sell_logic": "Close < EMA50 หรือ RSI > 76 หรือ EMA20 ตัดลง EMA50",
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
    "bollinger_mean_reversion": {
        "name": "↩️ Bollinger Mean Reversion",
        "description": "เล่นตลาด Sideway แบบรอ confirm ซื้อเมื่อราคาหลุด Bollinger ล่างแล้วกลับเข้ากรอบ พร้อม RSI เริ่มฟื้น เน้นขายเมื่อกลับสู่ค่าเฉลี่ย ไม่ aggressive เท่า Bounce Scalper",
        "indicators": ["Bollinger Bands (20, 2σ)", "RSI (14)", "BB Width"],
        "risk_level": "medium",
        "market_condition": "sideway",
        "ai_min_score": 62,
        "ai_min_confidence": 0.52,
        "buy_logic": "แท่งก่อนหน้า Close < BB Lower + แท่งล่าสุด Close กลับเหนือ BB Lower + RSI < 42 และเริ่มฟื้น + BB Width ไม่กว้างเกินไป",
        "sell_logic": "Close >= BB Mid หรือ RSI > 62 หรือ Close หลุด BB Lower อีกครั้ง",
    },
    "volume_breakout": {
        "name": "🔥 Volume Breakout",
        "description": "เก็งกำไรจังหวะราคาทะลุกรอบพร้อมแรงซื้อหนุน ซื้อเมื่อ Close ทะลุ high ระยะสั้นและ Volume มากกว่าปกติ เหมาะกับตลาดขาขึ้นหรือเหรียญที่เริ่มมี momentum",
        "indicators": ["20-Candle Breakout", "Volume SMA (20)", "EMA 9/21", "RSI (14)", "Trail Low (10)"],
        "risk_level": "high",
        "market_condition": "uptrend",
        "ai_min_score": 58,
        "ai_min_confidence": 0.48,
        "buy_logic": "Close ทะลุ High 20 แท่งก่อนหน้า + Volume > 1.8x SMA20 + EMA9 > EMA21 + RSI 50-78 + แท่งเขียว",
        "sell_logic": "Close < EMA9 หรือ RSI > 84 หรือ Close หลุด Low 10 แท่งก่อนหน้า",
    },
    "strategy003": {
        "name": "🔄 Strategy003 Oversold Bounce",
        "description": "แปลงจาก Freqtrade Strategy003 เน้นซื้อจังหวะ oversold หนักด้วย RSI/Fisher/MFI แต่ต้องมี EMA filter หรือ EMA5 ตัดขึ้น EMA10 ช่วยยืนยัน เหมาะกับตลาด Sideway ที่มีการเด้งกลับเป็นรอบ",
        "indicators": ["RSI (14)", "MFI (14)", "Fisher RSI", "Stochastic Fast", "EMA 5/10/50/100", "SMA 40", "Parabolic SAR"],
        "risk_level": "medium",
        "market_condition": "sideway",
        "ai_min_score": 58,
        "ai_min_confidence": 0.48,
        "buy_logic": "RSI < 28 + Fisher RSI < -0.94 + MFI < 16 + Close < SMA40 + (EMA50 > EMA100 หรือ EMA5 cross above EMA10) + FastD > FastK",
        "sell_logic": "Parabolic SAR > Close + Fisher RSI > 0.3",
    },
    "strategy005": {
        "name": "⚡ Strategy005 Volume Spike Bounce",
        "description": "แปลงจาก Freqtrade Strategy005 เน้นจังหวะ panic volume spike เมื่อราคาอยู่ใต้ SMA40 และ oscillator อยู่โซน oversold มาก สัญญาณน้อยแต่คัดจังหวะเด้งแรง",
        "indicators": ["Volume SMA (150)", "RSI (14)", "Fisher RSI Normalized", "Stochastic Fast", "MACD", "Minus DI", "SMA 40", "Parabolic SAR"],
        "risk_level": "high",
        "market_condition": "sideway",
        "ai_min_score": 60,
        "ai_min_confidence": 0.5,
        "buy_logic": "Volume > SMA150 x4 + Close < SMA40 + FastD > FastK + RSI > 26 + FastD > 1 + Fisher RSI Normalized < 5",
        "sell_logic": "RSI cross above 74 + MACD < 0 + Minus DI > 4",
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
