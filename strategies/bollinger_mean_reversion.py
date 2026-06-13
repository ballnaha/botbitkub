import numpy as np

# =============================================================================
# Bollinger Mean Reversion
#
# แนวคิด: เหมาะกับตลาด sideway ซื้อเมื่อราคาหลุดกรอบล่างแล้วกลับเข้ากรอบ
#   ต่างจาก Bounce Scalper ที่ aggressive กว่า กลยุทธ์นี้รอ confirm การกลับเข้ากรอบ
#
# ซื้อเมื่อ:
#   - แท่งก่อนหน้าปิดต่ำกว่า BB Lower
#   - แท่งล่าสุดปิดกลับเหนือ BB Lower
#   - RSI ต่ำกว่า 42 แต่เริ่มฟื้น
#   - BB width ไม่กว้างเกินไป เพื่อเลี่ยงตลาดเทรนด์แรง
#
# ขายเมื่อ:
#   - Close >= BB Mid
#   - หรือ RSI > 62
#   - หรือ Close หลุด BB Lower อีกรอบ
#
# หมายเหตุ: TP / SL / Trailing Stop ตรวจแยกใน bot_runner.py
# =============================================================================

BB_PERIOD = 20
BB_STD = 2.0
RSI_PERIOD = 14
MIN_CANDLES = 40
LOOKBACK_CANDLES = 80


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

    df["rsi"] = calculate_rsi(df["close"])
    df["bb_mid"] = df["close"].rolling(BB_PERIOD, min_periods=BB_PERIOD).mean()
    bb_std = df["close"].rolling(BB_PERIOD, min_periods=BB_PERIOD).std()
    df["bb_upper"] = df["bb_mid"] + (BB_STD * bb_std)
    df["bb_lower"] = df["bb_mid"] - (BB_STD * bb_std)
    df["bb_width_pct"] = ((df["bb_upper"] - df["bb_lower"]) / df["bb_mid"]) * 100
    return df


def check_buy_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    prev = df.iloc[-2]

    reentered_band = (prev["close"] < prev["bb_lower"]) and (last["close"] > last["bb_lower"])
    rsi_recovering = (last["rsi"] < 42) and (last["rsi"] > prev["rsi"])
    not_expanding_too_hard = last["bb_width_pct"] < 18
    green_or_higher = (last["close"] >= last["open"]) or (last["close"] > prev["close"])

    return bool(reentered_band and rsi_recovering and not_expanding_too_hard and green_or_higher)


def check_sell_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]

    if last["close"] >= last["bb_mid"]:
        return True
    if last["rsi"] > 62:
        return True
    if last["close"] < last["bb_lower"]:
        return True
    return False
