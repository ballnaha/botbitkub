import pandas as pd
import numpy as np

# คำนวณ RSI แบบดั้งเดิมด้วย Pandas
def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).copy()
    loss = (-delta.where(delta < 0, 0)).copy()
    
    # ใช้ค่าเฉลี่ยเคลื่อนที่แบบ Wilder (Exponential moving average) สำหรับ RSI
    avg_gain = gain.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    
    rs = avg_gain / np.where(avg_loss == 0, 1e-10, avg_loss)
    return 100 - (100 / (1 + rs))

# คำนวณอินดิเคเตอร์เทคนิคสำหรับกลยุทธ์
def populate_indicators(df):
    if df.empty or len(df) < 30:
        # กำหนดค่าเริ่มต้นถ้ามีข้อมูลไม่พอ
        df['rsi'] = 50.0
        df['ema_fast'] = df['close']
        df['ema_slow'] = df['close']
        return df

    df['rsi'] = calculate_rsi(df['close'], period=14)
    df['ema_fast'] = df['close'].ewm(span=12, adjust=False).mean()
    df['ema_slow'] = df['close'].ewm(span=26, adjust=False).mean()
    return df

# ตรวจสอบสัญญาณซื้อ
def check_buy_signal(df):
    if df.empty or len(df) < 2:
        return False
    
    last_row = df.iloc[-1]
    
    # เงื่อนไขซื้อ: RSI มีสถานะ Oversold (< 35) และราคาปิดยืนเหนือเส้น EMA 12 (เริ่มกลับตัว)
    if last_row['rsi'] < 35 and last_row['close'] > last_row['ema_fast']:
        return True
    return False

# ตรวจสอบสัญญาณขาย
def check_sell_signal(df):
    if df.empty or len(df) < 2:
        return False
    
    last_row = df.iloc[-1]
    
    # เงื่อนไขขาย: RSI มีสถานะ Overbought (> 70) หรือ ราคาหลุดต่ำกว่าเส้น EMA 26 (แนวโน้มเปลี่ยนเป็นขาลง)
    if last_row['rsi'] > 70 or last_row['close'] < last_row['ema_slow']:
        return True
    return False
