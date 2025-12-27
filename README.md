# 自然科学基金申请书智能助手

基于 FastAPI 和纯前端技术开发的科研助手工具，通过结构化的方式帮助科研人员利用大语言模型（LLM）生成符合学术规范、风格严谨的申请书内容。

## 功能特点

- 📝 **结构化输入**：通过预设的"关键内容变量"管理核心信息
- 🎯 **模板化提示词**：使用预设的 Prompt 模板，确保生成内容符合学术规范
- 💬 **交互式对话**：支持对生成内容进行实时修改和优化
- 💾 **持久化存储**：自动保存配置和对话历史
- 🔄 **多对话管理**：支持创建多个对话，管理不同模块的内容
- 🚀 **DeepSeek API 支持**：集成 DeepSeek API，成本更低
- 👥 **多用户支持**：支持用户注册、登录，每个用户的数据完全隔离

## 技术栈

- **后端**：FastAPI (Python)
- **前端**：HTML + CSS + JavaScript (原生，无需框架)
- **API**：DeepSeek API

## 安装与运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 DeepSeek API

创建 `.env` 文件（或设置环境变量），添加以下配置：

**方法一：使用示例文件**
```bash
cp env.example .env
# 然后编辑 .env 文件，填入您的 DeepSeek API Key
```

**方法二：手动创建**
```bash
# 创建 .env 文件
cat > .env << EOF
DEEPSEEK_API_KEY=your-deepseek-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
EOF
```

**方法三：直接设置环境变量**
```bash
export DEEPSEEK_API_KEY=your-deepseek-api-key-here
export DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
export DEEPSEEK_MODEL=deepseek-chat
```

您可以从 [DeepSeek 官网](https://www.deepseek.com/) 获取 API Key。

### 3. 运行后端服务

**本地访问（仅本机）：**
```bash
cd backend
python main.py
```

**内网访问（允许其他机器访问）：**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问前端

- **本地访问**：`http://localhost:8000`
- **内网访问**：`http://服务器IP:8000`（例如：`http://192.168.1.100:8000`）

## 部署说明

### 内网部署

✅ **可以部署到内网**。只需将 `host` 设置为 `0.0.0.0`，内网其他机器即可通过服务器 IP 访问。

### 多用户支持

⚠️ **当前版本不支持多用户同时使用**。所有用户共享同一个 `config.json` 文件，会互相影响。

如需多用户支持，请参考 `DEPLOYMENT.md` 文件中的解决方案。


## 使用说明

### 1. 设置关键内容

在左侧边栏的"关键内容设置界面"中，填写以下变量：
- 目标系统具体定义
- 研究内容架构图
- 传统系统的做法及其面临的技术挑战
- 关键技术
- 关键科学问题
- 理论与方法
- 系统的具体应用
- 国家的相关政策
- 系统的相关产业

填写完成后，点击"保存关键内容"按钮。

### 2. 选择 Prompt 并生成

1. 在中间的"Prompt 设置界面"中，选择要生成的具体句子类型
2. 点击"一键生成"按钮
3. 系统会自动将关键内容变量替换到 Prompt 模板中，并调用 DeepSeek API 生成内容

### 3. 对话与微调

生成内容后，您可以在主界面的输入框中：
- 要求修改生成的内容
- 继续完善某个部分
- 提出新的问题

系统会基于对话历史进行上下文理解，提供更精准的回复。

### 4. 管理对话

- 点击"新建对话"创建新的对话会话
- 在"对话框列表"中选择不同的对话
- 可以编辑对话名称以便管理

## 项目结构

```
ChatRobot/
├── backend/
│   └── main.py              # FastAPI 后端服务器
├── static/
│   ├── index.html           # 前端页面
│   ├── style.css            # 样式文件
│   └── app.js               # 前端逻辑
├── config.json              # 配置文件（自动生成）
├── requirements.txt         # Python 依赖
├── .env.example            # 环境变量示例
└── README.md               # 项目说明
```

## API 端点

### 配置相关
- `GET /api/config` - 获取配置
- `POST /api/config/key-content` - 更新关键内容

### Prompt 相关
- `GET /api/prompts` - 获取所有 Prompt 选项
- `POST /api/generate` - 生成内容

### 对话相关
- `GET /api/conversations` - 获取所有对话
- `POST /api/conversations` - 创建新对话
- `GET /api/conversations/{id}` - 获取特定对话
- `PUT /api/conversations/{id}` - 更新对话名称
- `PUT /api/conversations/{id}/select` - 选择当前对话
- `POST /api/conversations/{id}/chat` - 发送消息

## 配置说明

`config.json` 文件包含以下结构：

- `key_content`: 关键内容变量池
- `prompt_library`: Prompt 模板库
- `conversations`: 对话历史记录
- `current_conversation_id`: 当前对话 ID

## DeepSeek API 配置

DeepSeek API 与 OpenAI API 格式兼容，但需要设置正确的 base_url：

- **Base URL**: `https://api.deepseek.com/v1`
- **Model**: `deepseek-chat` (或其他可用的模型)
- **API Key**: 从 DeepSeek 官网获取

## 注意事项

1. 首次运行会自动创建 `config.json` 文件
2. 所有配置和对话历史都会自动保存到 `config.json`
3. 确保已正确配置 DeepSeek API 密钥
4. 建议定期备份 `config.json` 文件
5. 前端文件需要放在 `static/` 目录下
6. 后端服务默认运行在 `http://localhost:8000`

## 开发计划

- [ ] 支持更多 Prompt 模板
- [ ] 支持导出生成的内容为 Word/PDF
- [ ] 支持自定义 Prompt 模板
- [ ] 优化 UI 界面
- [ ] 添加内容质量评估功能
- [ ] 支持多语言界面

## 许可证

MIT License
