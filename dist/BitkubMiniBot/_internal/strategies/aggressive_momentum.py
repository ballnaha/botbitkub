import numpy as np


def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).copy()
    loss = (-delta.where(delta < 0, 0)).copy()

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / np.where(avg_loss == 0, 1e-10, avg_loss)
    return 100 - (100 / (1 + rs))


def populate_indicators(df):
    if df.empty or len(df) < 30:
        df["rsi"] = 50.0
        df["ema_fast"] = df["close"]
        df["ema_slow"] = df["close"]
        df["breakout_high"] = df["close"]
        df["pullback_low"] = df["close"]
        df["vol_sma"] = df.get("volume", 0.0)
        return df

    df["rsi"] = calculate_rsi(df["close"], period=14)
    df["ema_fast"] = df["close"].ewm(span=5, adjust=False).mean()
    df["ema_slow"] = df["close"].ewm(span=13, adjust=False).mean()
    df["breakout_high"] = df["high"].rolling(window=12, min_periods=6).max().shift(1)
    df["pullback_low"] = df["low"].rolling(window=6, min_periods=3).min().shift(1)

    if "volume" in df.columns:
        df["vol_sma"] = df["volume"].rolling(window=12, min_periods=5).mean()
    else:
        df["vol_sma"] = 0.0

    return df


def check_buy_signal(df):
    if df.empty or len(df) < 30:
        return False

    last = df.iloc[-1]
    prev = df.iloc[-2]

    breakout = last["close"] > last["breakout_high"]
    trend_up = last["ema_fast"] > last["ema_slow"]
    momentum_ready = 48 <= last["rsi"] <= 78
    volume_confirmed = True

    if "volume" in df.columns and "vol_sma" in df.columns:
        volume_confirmed = last.get("vol_sma", 0) > 0 and last["volume"] > last["vol_sma"] * 1.15

    was_not_breakout = prev["close"] <= prev["breakout_high"]
    return breakout and was_not_breakout and trend_up and momentum_ready and volume_confirmed


def check_sell_signal(df):
    if df.empty or len(df) < 3:
        return False

    last = df.iloc[-1]

    momentum_exhausted = last["rsi"] > 82
    trend_lost = last["close"] < last["ema_fast"]
    quick_pullback = last["close"] < last["pullback_low"]

    return momentum_exhausted or trend_lost or quick_pullback
