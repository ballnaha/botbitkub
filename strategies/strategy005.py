import numpy as np
import pandas as pd

# =============================================================================
# Strategy005 Volume Spike Bounce
#
# แปลงจาก Freqtrade Strategy005 ให้เข้ากับ bot runner นี้
# แนวคิด: ซื้อจังหวะ panic/volume spike เมื่อราคาอยู่ใต้ SMA40 และ oscillator อยู่โซน oversold
#
# ซื้อเมื่อครบทั้งหมด:
#   - Volume > ค่าเฉลี่ยย้อนหลัง 150 แท่ง x 4
#   - Close < SMA40
#   - Fast Stochastic เริ่มฟื้น: fastd > fastk และ fastd > 1
#   - RSI > 26
#   - Fisher RSI normalized < 5
#
# ขายเมื่อ:
#   - RSI เพิ่งตัดขึ้นเหนือ 74
#   - MACD < 0
#   - Minus DI > 4
#
# หมายเหตุ: TP / SL / Trailing Stop ตรวจแยกใน bot_runner.py
# =============================================================================

RSI_PERIOD = 14
STOCH_PERIOD = 5
STOCH_D_PERIOD = 3
SMA_PERIOD = 40
VOLUME_AVG_PERIOD = 150
MIN_CANDLES = VOLUME_AVG_PERIOD + 5
LOOKBACK_CANDLES = 180


def calculate_rsi(series, period=RSI_PERIOD):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    return (100 - (100 / (1 + rs))).fillna(50.0)


def calculate_stoch_fast(df, period=STOCH_PERIOD, d_period=STOCH_D_PERIOD):
    lowest_low = df["low"].rolling(period, min_periods=period).min()
    highest_high = df["high"].rolling(period, min_periods=period).max()
    range_ = (highest_high - lowest_low).replace(0, np.nan)
    fastk = 100 * (df["close"] - lowest_low) / range_
    fastd = fastk.rolling(d_period, min_periods=d_period).mean()
    return fastk.fillna(0.0), fastd.fillna(0.0)


def calculate_macd(series, fast=12, slow=26, signal=9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    return macd, macd_signal


def calculate_minus_di(df, period=14):
    high = df["high"]
    low = df["low"]
    close = df["close"]

    prev_high = high.shift(1)
    prev_low = low.shift(1)
    prev_close = close.shift(1)

    down_move = prev_low - low
    up_move = high - prev_high
    minus_dm = down_move.where((down_move > up_move) & (down_move > 0), 0.0)

    true_range = pd.concat([
        (high - low).abs(),
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)

    atr = true_range.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    minus_dm_smooth = minus_dm.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    return (100 * minus_dm_smooth / atr.replace(0, np.nan)).fillna(0.0)


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


def crossed_above_threshold(series, threshold):
    return (series.iloc[-2] <= threshold) and (series.iloc[-1] > threshold)


def populate_indicators(df):
    if df.empty:
        return df

    df["macd"], df["macdsignal"] = calculate_macd(df["close"])
    df["minus_di"] = calculate_minus_di(df)
    df["rsi"] = calculate_rsi(df["close"])

    rsi_scaled = 0.1 * (df["rsi"] - 50)
    exp_rsi = np.exp(2 * rsi_scaled)
    df["fisher_rsi"] = (exp_rsi - 1) / (exp_rsi + 1)
    df["fisher_rsi_norma"] = 50 * (df["fisher_rsi"] + 1)

    df["fastk"], df["fastd"] = calculate_stoch_fast(df)
    df["sar"] = calculate_sar(df)
    df["sma"] = df["close"].rolling(SMA_PERIOD, min_periods=SMA_PERIOD).mean()
    df["volume_avg_150"] = df["volume"].rolling(VOLUME_AVG_PERIOD, min_periods=VOLUME_AVG_PERIOD).mean()

    return df


def check_buy_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]

    conditions = [
        last["close"] > 0.00000200,
        last["volume"] > last["volume_avg_150"] * 4,
        last["close"] < last["sma"],
        last["fastd"] > last["fastk"],
        last["rsi"] > 26,
        last["fastd"] > 1,
        last["fisher_rsi_norma"] < 5,
    ]
    return bool(all(conditions))


def check_sell_signal(df):
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    rsi_crossed = crossed_above_threshold(df["rsi"].iloc[-2:], 74)

    return bool(rsi_crossed and (last["macd"] < 0) and (last["minus_di"] > 4))
