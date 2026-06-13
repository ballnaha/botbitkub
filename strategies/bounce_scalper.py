import pandas as pd
import numpy as np

# =============================================================================
# กลยุทธ์ Bounce Scalper (Mean-Reversion สำหรับตลาดขาลง / Sideway ขอบล่าง)
#
# แนวคิด: "ซื้อตอนถูกขายทิ้งจนเกินจริง แล้วขายเด้งสั้นๆ"
#   ออกแบบมาเพื่อเล่น long ในตลาดขาลงโดยเฉพาะ — ไม่ฝืนถือยาว
#   เน้น "เข้าน้อย ออกไว กำไรสั้น" เก็บกำไรจากการเด้งทางเทคนิค (technical bounce)
#
# ซื้อเมื่อ: ครบทั้ง 3 เงื่อนไข
#   1. แท่งก่อนหน้า ราคา Close < Bollinger Band ล่าง  → ถูกขายทิ้งจนหลุดกรอบ
#   2. RSI < 35                                        → oversold (ขายมากเกินไป)
#   3. แท่งนี้กลับตัวขึ้น: Close > Close ก่อนหน้า และเป็นแท่งเขียว (Close >= Open)
#
# ขายเมื่อ: ผ่านเงื่อนไขใดเงื่อนไขหนึ่ง (ออกไวเพื่อเก็บกำไรเด้ง)
#   1. ราคา Close >= เส้นกลาง Bollinger (กลับเข้าค่าเฉลี่ย = เป้า scalp)
#   2. RSI > 60                                        → เด้งแรงพอแล้ว
#
# ⚠️ เป็นกลยุทธ์ counter-trend ความเสี่ยงสูงโดยธรรมชาติ ควรตั้ง TP สั้น (เช่น 3-5%)
#    และ SL แน่น (เช่น -3%) คู่กับ Cooldown เพื่อกัน whipsaw
# หมายเหตุ: TP / SL / Trailing Stop ตรวจสอบแยกใน bot_runner.py อยู่แล้ว
# =============================================================================

BB_PERIOD = 20
BB_STD = 2.0
RSI_PERIOD = 14
MIN_CANDLES = 30


# ── RSI (Wilder's Smoothing) ─────────────────────────────
def calculate_rsi(series, period=RSI_PERIOD):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).copy()
    loss = (-delta.where(delta < 0, 0)).copy()

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / np.where(avg_loss == 0, 1e-10, avg_loss)
    return 100 - (100 / (1 + rs))


# ── Bollinger Bands ──────────────────────────────────────
def calculate_bollinger_bands(series, period=BB_PERIOD, std_dev=BB_STD):
    sma = series.rolling(window=period, min_periods=period).mean()
    std = series.rolling(window=period, min_periods=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return sma, upper, lower


# ── คำนวณอินดิเคเตอร์ทั้งหมด ──────────────────────────
def populate_indicators(df):
    if df.empty or len(df) < MIN_CANDLES:
        df['rsi'] = 50.0
        df['bb_mid'] = df['close']
        df['bb_upper'] = df['close']
        df['bb_lower'] = df['close']
        return df

    df['rsi'] = calculate_rsi(df['close'], period=RSI_PERIOD)
    df['bb_mid'], df['bb_upper'], df['bb_lower'] = calculate_bollinger_bands(
        df['close'], period=BB_PERIOD, std_dev=BB_STD
    )
    return df


# ── เช็คสัญญาณซื้อ ───────────────────────────────────────
def check_buy_signal(df):
    """ซื้อตอนราคาหลุดกรอบล่างจน oversold แล้วเริ่มเด้งกลับ (reversal candle)"""
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    prev = df.iloc[-2]

    stretched_below = prev['close'] < prev['bb_lower']                 # ก่อนหน้าหลุดกรอบล่าง
    oversold = last['rsi'] < 35                                        # ขายมากเกินไป
    turning_up = (last['close'] > prev['close']) and (last['close'] >= last['open'])  # เด้งขึ้น

    return bool(stretched_below and oversold and turning_up)


# ── เช็คสัญญาณขาย ────────────────────────────────────────
def check_sell_signal(df):
    """ขายเร็วเมื่อราคากลับเข้าค่าเฉลี่ย หรือเด้งจน RSI ฟื้นพอแล้ว"""
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]

    if last['close'] >= last['bb_mid']:  # กลับเข้าค่าเฉลี่ย = เป้าหมายของการ scalp
        return True
    if last['rsi'] > 60:                 # เด้งแรงพอแล้ว ทำกำไร
        return True

    return False
