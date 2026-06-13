import numpy as np
import pandas as pd

# =============================================================================
# Strategy003 Bounce Reversal
#
# แปลงจาก Freqtrade Strategy003 ให้เข้ากับ bot runner นี้
# แนวคิด: ซื้อจังหวะ oversold หนัก แต่ต้องมี EMA/crossover ช่วยยืนยันว่าเริ่มเด้ง
#
# ซื้อเมื่อครบทั้งหมด:
#   - RSI < 28
#   - Close < SMA40
#   - Fisher RSI < -0.94
#   - MFI < 16
#   - EMA50 > EMA100 หรือ EMA5 เพิ่งตัดขึ้น EMA10
#   - Fast Stochastic เริ่มฟื้น: fastd > fastk และ fastd > 0
#
# ขายเมื่อ:
#   - Parabolic SAR อยู่เหนือราคา และ Fisher RSI > 0.3
#
# หมายเหตุ: TP / SL / Trailing Stop ตรวจแยกใน bot_runner.py
# =============================================================================

RSI_PERIOD = 14
MFI_PERIOD = 14
STOCH_PERIOD = 5
STOCH_D_PERIOD = 3
SMA_PERIOD = 40
MIN_CANDLES = 110
LOOKBACK_CANDLES = 130


def calculate_rsi(series, period=RSI_PERIOD):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100 - (100 / (1 + rs))).fillna(50.0)


def calculate_mfi(df, period=MFI_PERIOD):
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    raw_money_flow = typical_price * df["volume"]
    direction = typical_price.diff()

    positive_flow = raw_money_flow.where(direction > 0, 0.0)
    negative_flow = raw_money_flow.where(direction < 0, 0.0).abs()

    positive_sum = positive_flow.rolling(period, min_periods=period).sum()
    negative_sum = negative_flow.rolling(period, min_periods=period).sum()
    money_ratio = positive_sum / negative_sum.replace(0, np.nan)
    return (100 - (100 / (1 + money_ratio))).fillna(50.0)


def calculate_stoch_fast(df, period=STOCH_PERIOD, d_period=STOCH_D_PERIOD):
    lowest_low = df["low"].rolling(period, min_periods=period).min()
    highest_high = df["high"].rolling(period, min_periods=period).max()
    range_ = (highest_high - lowest_low).replace(0, np.nan)
    fastk = 100 * (df["close"] - lowest_low) / range_
    fastd = fastk.rolling(d_period, min_periods=d_period).mean()
    return fastk.fillna(0.0), fastd.fillna(0.0)


def calculate_sar(df, acceleration=0.02, maximum=0.2):
    if df.empty:
        return pd.Series(dtype=float)

    high = df["high"].to_numpy(dtype=float)
    low = df["low"].to_numpy(dtype=float)
    close = df["close"].to_numpy(dtype=float)
    sar = np.zeros(len(df), dtype=float)

    uptrend = True
    af = acceleration
    ep = high[0]
    sar[0] = low[0]

    for i in range(1, len(df)):
        prev_sar = sar[i - 1]
        sar[i] = prev_sar + af * (ep - prev_sar)

        if uptrend:
            if i >= 2:
                sar[i] = min(sar[i], low[i - 1], low[i - 2])
            if low[i] < sar[i]:
                uptrend = False
                sar[i] = ep
                ep = low[i]
                af = acceleration
            elif high[i] > ep:
                ep = high[i]
                af = min(af + acceleration, maximum)
        else:
            if i >= 2:
                sar[i] = max(sar[i], high[i - 1], high[i - 2])
            if high[i] > sar[i]:
                uptrend = True
                sar[i] = ep
                ep = high[i]
                af = acceleration
            elif low[i] < ep:
                ep = low[i]
                af = min(af + acceleration, maximum)

        if not np.isfinite(sar[i]):
            sar[i] = close[i]

    return pd.Series(sar, index=df.index)


def crossed_above(series_a, series_b):
    return (series_a.iloc[-2] <= series_b.iloc[-2]) and (series_a.iloc[-1] > series_b.iloc[-1])


def populate_indicators(df):
    if df.empty:
        return df

    df["mfi"] = calculate_mfi(df)
    df["fastk"], df["fastd"] = calculate_stoch_fast(df)
    df["rsi"] = calculate_rsi(df["close"])

    rsi_scaled = 0.1 * (df["rsi"] - 50)
    exp_rsi = np.exp(2 * rsi_scaled)
    df["fisher_rsi"] = (exp_rsi - 1) / (exp_rsi + 1)

    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    bb_mid = typical_price.rolling(20, min_periods=20).mean()
    bb_std = typical_price.rolling(20, min_periods=20).std()
    df["bb_lowerband"] = bb_mid - (2 * bb_std)

    df["ema5"] = df["close"].ewm(span=5, adjust=False).mean()
    df["ema10"] = df["close"].ewm(span=10, adjust=False).mean()
    df["ema50"] = df["close"].ewm(span=50, adjust=False).mean()
    df["ema100"] = df["close"].ewm(span=100, adjust=False).mean()
    df["sar"] = calculate_sar(df)
    df["sma"] = df["close"].rolling(SMA_PERIOD, min_periods=SMA_PERIOD).mean()

    return df


def check_buy_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    ema5 = df["ema5"].iloc[-2:]
    ema10 = df["ema10"].iloc[-2:]

    trend_or_bounce = (last["ema50"] > last["ema100"]) or crossed_above(ema5, ema10)

    conditions = [
        last["rsi"] < 28,
        last["rsi"] > 0,
        last["close"] < last["sma"],
        last["fisher_rsi"] < -0.94,
        last["mfi"] < 16.0,
        trend_or_bounce,
        last["fastd"] > last["fastk"],
        last["fastd"] > 0,
    ]
    return bool(all(conditions))


def check_sell_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    return bool((last["sar"] > last["close"]) and (last["fisher_rsi"] > 0.3))
