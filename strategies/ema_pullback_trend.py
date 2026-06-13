import numpy as np

# =============================================================================
# EMA Pullback Trend
#
# แนวคิด: เทรดตามเทรนด์ขาขึ้น แต่ไม่ไล่ราคา
#   รอให้ราคาอยู่เหนือ EMA200 แล้วพักตัวลงมาใกล้ EMA20/EMA50 ก่อนเริ่มเด้งกลับ
#
# ซื้อเมื่อ:
#   - Close > EMA200 และ EMA50 > EMA200
#   - แท่งล่าสุดปิดเหนือ EMA20
#   - ภายใน 5 แท่งล่าสุดมีการย่อลงใกล้ EMA20 หรือ EMA50
#   - RSI อยู่โซนกลาง 42-68 ไม่อ่อนเกินไปและไม่ร้อนเกินไป
#   - Volume ไม่แห้ง: Volume > 0.8x SMA20
#
# ขายเมื่อ:
#   - Close หลุด EMA50
#   - หรือ RSI > 76
#   - หรือ EMA20 ตัดลง EMA50
#
# หมายเหตุ: TP / SL / Trailing Stop ตรวจแยกใน bot_runner.py
# =============================================================================

RSI_PERIOD = 14
VOLUME_PERIOD = 20
MIN_CANDLES = 220
LOOKBACK_CANDLES = 240


def calculate_rsi(series, period=RSI_PERIOD):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100 - (100 / (1 + rs))).fillna(50.0)


def crossed_below(series_a, series_b):
    return (series_a.iloc[-2] >= series_b.iloc[-2]) and (series_a.iloc[-1] < series_b.iloc[-1])


def populate_indicators(df):
    if df.empty:
        return df

    df["ema20"] = df["close"].ewm(span=20, adjust=False).mean()
    df["ema50"] = df["close"].ewm(span=50, adjust=False).mean()
    df["ema200"] = df["close"].ewm(span=200, adjust=False).mean()
    df["rsi"] = calculate_rsi(df["close"])
    df["volume_sma20"] = df["volume"].rolling(VOLUME_PERIOD, min_periods=VOLUME_PERIOD).mean()
    df["pullback_gap_ema20_pct"] = ((df["low"] - df["ema20"]) / df["ema20"]) * 100
    df["pullback_gap_ema50_pct"] = ((df["low"] - df["ema50"]) / df["ema50"]) * 100
    return df


def check_buy_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    recent = df.tail(5)

    trend_ok = (last["close"] > last["ema200"]) and (last["ema50"] > last["ema200"])
    reclaimed_short_ema = last["close"] > last["ema20"]
    healthy_rsi = 42 <= last["rsi"] <= 68
    volume_ok = last["volume"] > (last["volume_sma20"] * 0.8)

    touched_ema20 = (recent["pullback_gap_ema20_pct"].abs() <= 1.2).any()
    touched_ema50 = (recent["pullback_gap_ema50_pct"].abs() <= 1.8).any()
    pullback_seen = bool(touched_ema20 or touched_ema50)

    turning_up = last["close"] > df.iloc[-2]["close"]

    return bool(trend_ok and reclaimed_short_ema and healthy_rsi and volume_ok and pullback_seen and turning_up)


def check_sell_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    ema_cross_down = crossed_below(df["ema20"].iloc[-2:], df["ema50"].iloc[-2:])

    return bool((last["close"] < last["ema50"]) or (last["rsi"] > 76) or ema_cross_down)
