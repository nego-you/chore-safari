FROM python:3.12-slim

WORKDIR /app

# 依存関係を先にコピーしてキャッシュを活かす
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# 0.0.0.0 でバインドして Docker ネットワーク内から到達できるようにする
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
