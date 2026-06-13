import numpy as np

# =============================================================================
# Volume Breakout
#
# แนวคิด: เก็งกำไรจังหวะราคาทะลุกรอบพร้อม volume สนับสนุน
#   เหมาะกับตลาดขาขึ้นหรือช่วงเหรียญเริ่มมี momentum
#
# ซื้อเมื่อ:
#   - Close ทะลุ high 20 แท่งก่อนหน้า
#   - Volume > 1.8x SMA20
#   - EMA9 > EMA21
#   - RSI อยู่ 50-78
#
# ขายเมื่อ:
#   - Close หลุด EMA9
#   - หรือ RSI > 84
#   - หรือ Close หลุด low 10 แท่งก่อนหน้า
#
# หมายเหตุ: TP / SL / Trailing Stop ตรวจแยกใน bot_runner.py
# =============================================================================

RSI_PERIOD = 14
VOLUME_PERIOD = 20
BREAKOUT_PERIOD = 20
TRAIL_LOW_PERIOD = 10
MIN_CANDLES = 50
LOOKBACK_CANDLES = 90


def calculate_rsi(series, period=RSI_PERIOD):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100 - (100 / (1 + rs))).fillna(50.0)


def populate_indicators(df):
    if df.empty:
        return df

    df["ema9"] = df["close"].ewm(span=9, adjust=False).mean()
    df["ema21"] = df["close"].ewm(span=21, adjust=False).mean()
    df["rsi"] = calculate_rsi(df["close"])
    df["volume_sma20"] = df["volume"].rolling(VOLUME_PERIOD, min_periods=VOLUME_PERIOD).mean()
    df["breakout_high"] = df["high"].shift(1).rolling(BREAKOUT_PERIOD, min_periods=BREAKOUT_PERIOD).max()
    df["trail_low"] = df["low"].shift(1).rolling(TRAIL_LOW_PERIOD, min_periods=TRAIL_LOW_PERIOD).min()
    df["volume_ratio"] = df["volume"] / df["volume_sma20"].replace(0, np.nan)
    return df


def check_buy_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]

    breakout = last["close"] > last["breakout_high"]
    volume_confirmed = last["volume_ratio"] > 1.8
    trend_ok = last["ema9"] > last["ema21"]
    rsi_ok = 50 <= last["rsi"] <= 78
    candle_ok = last["close"] > last["open"]

    return bool(breakout and volume_confirmed and trend_ok and rsi_ok and candle_ok)


def check_sell_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]

    if last["close"] < last["ema9"]:
        return True
    if last["rsi"] > 84:
        return True
    if last["close"] < last["trail_low"]:
        return True
    return False
