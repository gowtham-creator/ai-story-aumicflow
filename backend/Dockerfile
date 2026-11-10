FROM python:3.10-slim

# Ensure logs appear instantly (important for Azure)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install any OS packages if needed later (e.g., ffmpeg)
# RUN apt-get update && apt-get install -y ffmpeg

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Gunicorn (master) + Uvicorn workers (async + websockets)
CMD ["gunicorn", "--worker-class", "gevent", "--workers", "1","--timeout", "600", "--bind", "0.0.0.0:5000", "app:create_app()"]

