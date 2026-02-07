# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Backend + serve static
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy frontend build to static folder
COPY --from=frontend-builder /app/frontend/dist /app/static

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

CMD ["python", "run.py"]
