# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# 使用淘宝 npm 镜像（中国大陆加速）
RUN npm config set registry https://registry.npmmirror.com

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Backend + serve static
FROM python:3.12-slim
WORKDIR /app

# 使用清华 PyPI 镜像（中国大陆加速）
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy frontend build to static folder
COPY --from=frontend-builder /app/frontend/dist /app/static

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

CMD ["python", "run.py"]
