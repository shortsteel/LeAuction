# LeAuction 乐拍 - 公司内部拍卖系统

公司内部同事之间使用的轻量级拍卖平台，用于交易年会奖品、闲置物品等。

## 技术栈

- **后端**: Flask + SQLAlchemy + SQLite + JWT
- **前端**: React + TypeScript + Ant Design + Vite
- **部署**: Docker / 直接运行

## 功能特性

- 用户注册/登录（邮箱 + 密码）
- 发布拍品（支持多图、分类、成色描述）
- 竞拍出价（加价幅度、一口价、保留价）
- 防狙击机制（最后 5 分钟出价自动延时）
- 站内通知系统（出价被超越、拍卖成交、流拍等）
- 交易确认流程
- 响应式设计（兼容手机和电脑）

## 本地开发

### 1. 启动后端

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

后端运行在 http://localhost:5000

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000（自动代理 API 到后端）

## Docker 部署

```bash
docker compose up -d --build
```

访问 http://localhost:5000

## 项目结构

```
LeAuction/
├── backend/
│   ├── app/
│   │   ├── __init__.py        # Flask 应用工厂
│   │   ├── models.py          # 数据库模型
│   │   ├── scheduler.py       # 定时任务（拍卖到期检查）
│   │   └── routes/
│   │       ├── auth.py        # 认证 API
│   │       ├── items.py       # 拍品管理 API
│   │       ├── bids.py        # 竞拍 API
│   │       ├── notifications.py # 通知 API
│   │       ├── transactions.py  # 交易 API
│   │       └── upload.py      # 文件上传 API
│   ├── config.py
│   ├── run.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/               # API 请求封装
│       ├── components/        # 通用组件
│       ├── pages/             # 页面
│       ├── store/             # 状态管理
│       ├── types/             # TypeScript 类型
│       ├── App.tsx
│       └── main.tsx
├── Dockerfile
├── docker-compose.yml
└── README.md
```
