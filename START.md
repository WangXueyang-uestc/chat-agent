# 快速启动指南

## 问题排查

如果遇到 HTTP 502 错误，请按以下步骤检查：

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

如果安装失败，可以逐个安装：

```bash
pip install fastapi
pip install uvicorn[standard]
pip install openai
pip install python-dotenv
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
cp env.example .env
```

然后编辑 `.env` 文件，填入您的 DeepSeek API Key：

```
DEEPSEEK_API_KEY=sk-your-actual-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

### 3. 检查服务器

运行检查脚本：

```bash
python check_server.py
```

### 4. 启动服务器

**方法一：直接运行**
```bash
cd backend
python main.py
```

**方法二：使用 uvicorn**
```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**方法三：从项目根目录运行**
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### 5. 访问应用

启动成功后，在浏览器中访问：

- 应用首页: http://127.0.0.1:8000
- API 文档: http://127.0.0.1:8000/docs
- API 测试: http://127.0.0.1:8000/redoc

## 常见问题

### 问题1: 端口被占用

如果 8000 端口被占用，可以修改端口：

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001
```

然后访问: http://127.0.0.1:8001

### 问题2: 找不到模块

确保在正确的目录下运行，或者使用绝对路径：

```bash
# 从项目根目录
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### 问题3: 静态文件404

确保 `static` 目录在项目根目录下，包含以下文件：
- static/index.html
- static/style.css
- static/app.js

### 问题4: API 调用失败

检查 `.env` 文件中的 `DEEPSEEK_API_KEY` 是否正确设置。

## 验证服务器运行

启动后，您应该看到类似以下的输出：

```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

如果看到这些信息，说明服务器已成功启动！

