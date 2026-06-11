import pandas as pd
import numpy as np

# =============================================================================
# กลยุทธ์ MACD & RSI Crossover (Alternative Strategy)
# 
# ซื้อเมื่อ:
#   1. MACD Line ตัดขึ้นเหนือ Signal Line (MACD Golden Cross)
#   2. MACD Line อยู่ต่ำกว่า 0 (โซนแนวโน้มขาลงที่พร้อมจะกลับตัว)
#   3. RSI < 55 (ราคาไม่ได้อยู่ในโซนร้อนแรงเกินไป)
#
# ขายเมื่อ:
#   1. MACD Line ตัดลงใต้ Signal Line (MACD Death Cross)
#   2. หรือ RSI > 70 (Overbought - ราคาร้อนแรงมากเกินไป)
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

# ── คำนวณอินดิเคเตอร์ทั้งหมด ──────────────────────────
def populate_indicators(df):
    """คำนวณอินดิเคเตอร์ MACD และ RSI"""
    if df.empty or len(df) < 35:
        df['rsi'] = 50.0
        df['macd_line'] = 0.0
        df['macd_signal'] = 0.0
        df['macd_hist'] = 0.0
        return df

    # RSI (14)
    df['rsi'] = calculate_rsi(df['close'], period=14)

    # MACD (12, 26, 9)
    ema_fast = df['close'].ewm(span=12, adjust=False).mean()
    ema_slow = df['close'].ewm(span=26, adjust=False).mean()
    df['macd_line'] = ema_fast - ema_slow
    df['macd_signal'] = df['macd_line'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd_line'] - df['macd_signal']

    return df

# ── เช็คสัญญาณซื้อ (MACD Golden Cross) ─────────────────
def check_buy_signal(df):
    if df.empty or len(df) < 3:
        return False

    last = df.iloc[-1]
    prev = df.iloc[-2]

    # เช็ค MACD Crossover (Golden Cross)
    macd_cross_up = (prev['macd_line'] <= prev['macd_signal']) and (last['macd_line'] > last['macd_signal'])
    
    # เงื่อนไขยืนยัน: MACD อยู่ในแดนลบ (มีโอกาสกลับตัวสูง) และ RSI ไม่ร้อนเกินไป
    macd_under_zero = last['macd_line'] < 0
    rsi_under_threshold = last['rsi'] < 55

    return macd_cross_up and macd_under_zero and rsi_under_threshold

# ── เช็คสัญญาณขาย (MACD Death Cross หรือ RSI Overbought) ──
def check_sell_signal(df):
    if df.empty or len(df) < 3:
        return False

    last = df.iloc[-1]
    prev = df.iloc[-2]

    # 1. MACD Crossunder (Death Cross)
    macd_cross_down = (prev['macd_line'] >= prev['macd_signal']) and (last['macd_line'] < last['macd_signal'])

    # 2. RSI Overbought (> 70)
    rsi_overbought = last['rsi'] > 70

    return macd_cross_down or rsi_overbought
