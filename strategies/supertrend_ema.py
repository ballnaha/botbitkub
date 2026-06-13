import pandas as pd
import numpy as np

# =============================================================================
# กลยุทธ์ Supertrend + EMA Trend Filter (Trend Following)
#
# แนวคิด: "ถือกำไรยาวตามเทรนด์ ตัดขาดทุนสั้น"
#   ใช้ Supertrend (อิงความผันผวนจาก ATR) จับทิศทางตลาด และใช้ EMA 50
#   เป็นตัวกรองให้เข้าซื้อเฉพาะฝั่งขาขึ้นเท่านั้น (เหมาะกับ spot long-only)
#
# ซื้อเมื่อ: แท่งแรกที่เงื่อนไขขาขึ้นครบพร้อมกัน (rising edge)
#   - Supertrend เป็นขาขึ้น (เขียว)  → ทิศทางเทรนด์เป็นบวก
#   - ราคา Close > EMA 50            → ราคายืนเหนือเส้นเทรนด์
#   - RSI < 78                       → เลี่ยงไล่ราคาตอนร้อนจัด
#   * เข้าเฉพาะ "แท่งแรก" ที่ Supertrend เขียว + ราคา reclaim EMA 50 พร้อมกัน
#     (Supertrend พลิกขึ้นกับการ reclaim EMA ไม่จำเป็นต้องเกิดในแท่งเดียวกัน)
#
# ขายเมื่อ:
#   - Supertrend พลิกเป็นขาลง (แดง)  → เทรนด์จบ ออกทันที (ทำหน้าที่ trailing ในตัว)
#
# หมายเหตุ: TP / SL / Trailing Stop ตรวจสอบแยกใน bot_runner.py อยู่แล้ว
# =============================================================================

EMA_TREND_PERIOD = 50
ATR_PERIOD = 10
ATR_MULTIPLIER = 3.0
MIN_CANDLES = 60


# ── RSI (Wilder's Smoothing) ─────────────────────────────
def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).copy()
    loss = (-delta.where(delta < 0, 0)).copy()

    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / np.where(avg_loss == 0, 1e-10, avg_loss)
    return 100 - (100 / (1 + rs))


# ── ATR (Average True Range) แบบ Wilder ──────────────────
def calculate_atr(df, period=ATR_PERIOD):
    high = df['high']
    low = df['low']
    prev_close = df['close'].shift(1)
    true_range = pd.concat([
        (high - low).abs(),
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return true_range.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


# ── Supertrend ───────────────────────────────────────────
def calculate_supertrend(df, period=ATR_PERIOD, multiplier=ATR_MULTIPLIER):
    """คืนค่า (เส้น supertrend, ทิศทาง) โดยทิศทาง 1 = ขาขึ้น(เขียว), -1 = ขาลง(แดง)"""
    atr = calculate_atr(df, period)
    hl2 = (df['high'] + df['low']) / 2
    upperband = (hl2 + multiplier * atr).to_numpy()
    lowerband = (hl2 - multiplier * atr).to_numpy()
    close = df['close'].to_numpy()
    n = len(df)

    final_upper = np.zeros(n)
    final_lower = np.zeros(n)
    direction = np.zeros(n)
    supertrend = np.full(n, np.nan)

    for i in range(n):
        # ยังไม่มี ATR ที่ใช้ได้ -> ข้ามไปก่อน (ทิศทางยังเป็น 0 = เป็นกลาง)
        if i == 0 or np.isnan(upperband[i]) or np.isnan(upperband[i - 1]):
            final_upper[i] = upperband[i]
            final_lower[i] = lowerband[i]
            continue

        # ปรับ "เส้นขอบสุดท้าย" แบบ carry-over ตามสูตร Supertrend มาตรฐาน
        final_upper[i] = upperband[i] if (upperband[i] < final_upper[i - 1] or close[i - 1] > final_upper[i - 1]) else final_upper[i - 1]
        final_lower[i] = lowerband[i] if (lowerband[i] > final_lower[i - 1] or close[i - 1] < final_lower[i - 1]) else final_lower[i - 1]

        # กำหนดทิศทาง
        if close[i] > final_upper[i - 1]:
            direction[i] = 1
        elif close[i] < final_lower[i - 1]:
            direction[i] = -1
        else:
            direction[i] = direction[i - 1] if direction[i - 1] != 0 else 1

        supertrend[i] = final_lower[i] if direction[i] == 1 else final_upper[i]

    return supertrend, direction


# ── คำนวณอินดิเคเตอร์ทั้งหมด ──────────────────────────
def populate_indicators(df):
    if df.empty or len(df) < MIN_CANDLES:
        df['rsi'] = 50.0
        df['ema_trend'] = df['close']
        df['supertrend'] = df['close']
        df['st_dir'] = 0.0
        return df

    df['rsi'] = calculate_rsi(df['close'], period=14)
    df['ema_trend'] = df['close'].ewm(span=EMA_TREND_PERIOD, adjust=False).mean()

    supertrend, direction = calculate_supertrend(df)
    df['supertrend'] = supertrend
    df['st_dir'] = direction

    return df


# ── เช็คสัญญาณซื้อ ───────────────────────────────────────
def _is_uptrend(row):
    """อยู่ในเทรนด์ขาขึ้น: Supertrend เขียว และราคายืนเหนือ EMA 50"""
    return (row['st_dir'] == 1) and (row['close'] > row['ema_trend'])


def check_buy_signal(df):
    """ซื้อที่แท่งแรกซึ่งเข้าสู่ขาขึ้น (Supertrend เขียว + ราคา > EMA 50) และ RSI ยังไม่ร้อนจัด"""
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    prev = df.iloc[-2]

    now_uptrend = _is_uptrend(last) and (last['rsi'] < 78)
    prev_uptrend = _is_uptrend(prev)

    # rising edge: เพิ่งเข้าสู่ขาขึ้นในแท่งนี้ (ก่อนหน้ายังไม่เข้าเงื่อนไข)
    return bool(now_uptrend and not prev_uptrend)


# ── เช็คสัญญาณขาย ────────────────────────────────────────
def check_sell_signal(df):
    """ขายเมื่อ Supertrend พลิกเป็นขาลง (เทรนด์จบ)"""
    if df.empty or len(df) < MIN_CANDLES:
        return False

    last = df.iloc[-1]
    return bool(last['st_dir'] == -1)
