# ใช้ Base Image Python 3.10 ที่มีขนาดเล็ก
FROM python:3.10-slim

# กำหนด Working Directory ภายใน Container
WORKDIR /app

# คัดลอกเฉพาะ requirements.txt เพื่อทำ Caching layers
COPY requirements.txt .

# ติดตั้ง Dependencies โดยไม่มี Cache เพื่อให้บิลด์เร็วและขนาดเล็ก
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอกซอร์สโค้ดทั้งหมดเข้าไปใน Container
COPY . .

# เปิดพอร์ต 8000
EXPOSE 8000

# ตั้งค่าให้ Python แสดง log ทันทีโดยไม่บัฟเฟอร์
ENV PYTHONUNBUFFERED=1

# คำสั่งสำหรับรันเซิร์ฟเวอร์ โดยผูกเข้ากับโฮสต์ 0.0.0.0 เพื่อให้ VPS รับทราฟฟิกได้
CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "8000"]
