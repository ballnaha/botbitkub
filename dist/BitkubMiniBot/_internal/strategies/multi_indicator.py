import pandas as pd
import numpy as np

# =============================================================================
# กลยุทธ์ Multi-Indicator Confirmation (Professional Bot Strategy)
# 
# ซื้อเมื่อ: ผ่านเงื่อนไขอย่างน้อย 2 ใน 4 ข้อ (กรองสัญญาณหลอก)
#   1. RSI < 40          → ราคาถูกขายมากเกินไป (ผ่อนกว่าเดิม)
#   2. ราคา < Bollinger Band ล่าง → ราคาต่ำกว่าค่าปกติ
#   3. EMA 9 > EMA 21    → แนวโน้มระยะสั้นเริ่มขาขึ้น
#   4. Volume > ค่าเฉลี่ย 20 แท่ง  → มีปริมาณซื้อขายจริงรองรับ
#
# ขายเมื่อ: ผ่านเงื่อนไขอย่างน้อย 1 ข้อ (ออกเร็วเพื่อรักษากำไร)
#   1. RSI > 70          → ราคาร้อนเกินไป (Overbought)
#   2. ราคา > Bollinger Band บน → ราคาสูงกว่าค่าปกติ
#   3. EMA 9 < EMA 21    → แนวโน้มเปลี่ยนเป็นขาลง
# =============================================================================


# ── RSI ──────────────────────────────────────────────────
def calculate_rsi(series, period=14):
    """คำนวณ RSI แบบ Wilder's Smoothing"""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).copy()
    loss = (-delta.where(delta < 0, 0)).copy()

    avg_gain = gain.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

    rs = avg_gain / np.where(avg_loss == 0, 1e-10, avg_loss)
    return 100 - (100 / (1 + rs))


# ── Bollinger Bands ──────────────────────────────────────
def calculate_bollinger_bands(series, period=20, std_dev=2.0):
    """คำนวณ Bollinger Bands (เส้นกลาง, ขอบบน, ขอบล่าง)"""
    sma = series.rolling(window=period, min_periods=period).mean()
    std = series.rolling(window=period, min_periods=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return sma, upper, lower


# ── คำนวณอินดิเคเตอร์ทั้งหมด ──────────────────────────
def populate_indicators(df):
    """เพิ่มอินดิเคเตอร์ทุกตัวที่ต้องใช้ลงใน DataFrame"""
    if df.empty or len(df) < 30:
        df['rsi'] = 50.0
        df['ema_fast'] = df['close']
        df['ema_slow'] = df['close']
        df['bb_mid'] = df['close']
        df['bb_upper'] = df['close']
        df['bb_lower'] = df['close']
        df['vol_sma'] = df.get('volume', pd.Series(dtype=float))
        return df

    # RSI (14 แท่ง)
    df['rsi'] = calculate_rsi(df['close'], period=14)

    # EMA สำหรับแนวโน้ม (เร็ว 9, ช้า 21)
    df['ema_fast'] = df['close'].ewm(span=9, adjust=False).mean()
    df['ema_slow'] = df['close'].ewm(span=21, adjust=False).mean()

    # Bollinger Bands (20 แท่ง, 2 SD)
    df['bb_mid'], df['bb_upper'], df['bb_lower'] = calculate_bollinger_bands(
        df['close'], period=20, std_dev=2.0
    )

    # Volume Moving Average (20 แท่ง) สำหรับยืนยันปริมาณ
    if 'volume' in df.columns:
        df['vol_sma'] = df['volume'].rolling(window=20, min_periods=5).mean()
    else:
        df['vol_sma'] = 0.0

    return df


# ── เช็คสัญญาณซื้อ (Multi-Indicator Confirmation) ───────
def check_buy_signal(df):
    """
    ซื้อเมื่อผ่านเงื่อนไขอย่างน้อย 2 ใน 4 ข้อ
    ทำให้ได้สัญญาณบ่อยขึ้น แต่ยังมีความน่าเชื่อถือจากการยืนยันหลายตัว
    """
    if df.empty or len(df) < 2:
        return False

    last = df.iloc[-1]
    score = 0

    # 1. RSI Oversold (< 40)
    if last['rsi'] < 40:
        score += 1

    # 2. ราคาต่ำกว่า Bollinger Band ล่าง — ราคาถูกผิดปกติ
    if last['close'] < last['bb_lower']:
        score += 1

    # 3. EMA Crossover ขาขึ้น — แนวโน้มระยะสั้นเริ่มเป็นบวก
    if last['ema_fast'] > last['ema_slow']:
        score += 1

    # 4. Volume ยืนยัน — มีคนซื้อขายมากกว่าปกติ (ไม่ใช่สัญญาณหลอก)
    if 'volume' in df.columns and 'vol_sma' in df.columns:
        if last.get('vol_sma', 0) > 0 and last['volume'] > last['vol_sma']:
            score += 1

    # ต้องผ่านอย่างน้อย 2 ข้อ
    return score >= 2


# ── เช็คสัญญาณขาย (ออกเร็วเพื่อรักษากำไร) ──────────────
def check_sell_signal(df):
    """
    ขายเมื่อผ่านเงื่อนไขอย่างน้อย 1 ข้อ (ออกเร็วกว่าเข้า)
    หมายเหตุ: TP/SL ตรวจสอบแยกใน bot_runner.py อยู่แล้ว
    """
    if df.empty or len(df) < 2:
        return False

    last = df.iloc[-1]

    # 1. RSI Overbought (> 70) — ราคาร้อนเกินไป ควรทำกำไร
    if last['rsi'] > 70:
        return True

    # 2. ราคาสูงกว่า Bollinger Band บน — ราคาแพงผิดปกติ
    if last['close'] > last['bb_upper']:
        return True

    # 3. EMA Crossover ขาลง — แนวโน้มเริ่มเปลี่ยน
    if last['ema_fast'] < last['ema_slow']:
        return True

    return False
