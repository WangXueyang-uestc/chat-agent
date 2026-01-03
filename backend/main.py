from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncio
import json
from pydantic import BaseModel, EmailStr
from typing import Dict, Any, List, Optional
import json
import os
import concurrent.futures
import threading
from queue import Queue
import hashlib
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

# 加载环境变量
load_dotenv()

app = FastAPI(title="自然科学基金申请书智能助手 API")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置文件路径
BASE_DIR = Path(__file__).parent.parent
CONFIG_DIR = BASE_DIR / "user_data"  # 用户数据目录
USERS_FILE = BASE_DIR / "users.json"  # 用户信息文件
CONFIG_DIR.mkdir(exist_ok=True)  # 确保目录存在

# JWT 配置
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# 密码加密
# 使用 pbkdf2_sha256 作为密码加密方案（更稳定，没有72字节限制，兼容性更好）
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
print("[INFO] 使用 pbkdf2_sha256 进行密码加密")

# Token 安全
security = HTTPBearer()

# 请求模型
class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class KeyContentUpdate(BaseModel):
    key_content: Dict[str, str]

class GenerateRequest(BaseModel):
    prompt_key: str
    conversation_id: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class ConversationCreate(BaseModel):
    name: Optional[str] = None

class ConversationUpdate(BaseModel):
    name: str

class VariableItem(BaseModel):
    name: str
    key_content_key: str

class PromptTemplateData(BaseModel):
    template: str
    variables: Optional[List[VariableItem]] = None
    variable_key: Optional[str] = None  # 向后兼容旧格式

class PromptTemplatesUpdate(BaseModel):
    prompt_templates: Dict[str, PromptTemplateData]  # key: prompt名称, value: {template: "...", variables: [...]} 或 {template: "...", variable_key: "..."}

class LLMConfigUpdate(BaseModel):
    api_base_url: str
    model_name: str
    api_key: str
    enable_web_search: Optional[bool] = False  # 是否启用联网搜索
    enable_reasoning: Optional[bool] = False  # 是否启用深度思考/推理模式

# 用户工具函数
def get_password_hash(password: str) -> str:
    """加密密码"""
    # pbkdf2_sha256 没有72字节限制，可以直接使用
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # pbkdf2_sha256 没有72字节限制，可以直接使用
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建 JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def load_users() -> Dict[str, Any]:
    """加载用户信息"""
    if USERS_FILE.exists():
        try:
            with open(USERS_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                # 如果文件为空或只包含空白字符，返回空字典
                if not content:
                    return {}
                return json.loads(content)
        except (json.JSONDecodeError, ValueError):
            # 如果 JSON 解析失败（比如文件格式不正确），返回空字典
            return {}
    return {}

def save_users(users: Dict[str, Any]):
    """保存用户信息"""
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def get_user_config_file(user_id: str) -> Path:
    """获取用户的配置文件路径"""
    return CONFIG_DIR / f"{user_id}.json"

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """从 token 中获取当前用户ID"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # 验证用户是否存在（通过user_id查找）
        users = load_users()
        user_exists = False
        for username, user_data in users.items():
            if user_data.get("user_id") == user_id:
                user_exists = True
                break
        if not user_exists:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )

def load_config(user_id: str) -> Dict[str, Any]:
    """加载用户的配置文件"""
    config_file = get_user_config_file(user_id)
    if config_file.exists():
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        # 返回默认配置
        return {
            "key_content": {
                "目标系统具体定义": "",
                "研究内容架构图": "",
                "传统系统的做法及其面临的技术挑战": "",
                "关键技术": "",
                "关键科学问题": "",
                "理论与方法": "",
                "系统的具体应用": "",
                "国家的相关政策": "",
                "系统的相关产业": ""
            },
            "prompt_templates": {},
            "llm_config": {
                "api_base_url": "https://api.deepseek.com/v1",
                "model_name": "deepseek-chat",
                "api_key": "",
                "enable_web_search": False,
                "enable_reasoning": False
            },
            "conversations": {},
            "current_conversation_id": None
        }

def save_config(user_id: str, config: Dict[str, Any]):
    """保存用户的配置文件"""
    config_file = get_user_config_file(user_id)
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def generate_conversation_name(prompt_key: str, variable_value: str = "") -> str:
    """根据 prompt_key 生成有意义的对话名称"""
    # 直接使用 prompt_key 作为名称，去掉"模板"两字
    name = prompt_key.replace("模板", "").strip()
    
    # 如果名称太长，可以截取前30个字符
    if len(name) > 30:
        name = name[:27] + "..."
    
    return name

def call_llm_api(prompt: str, messages: Optional[List[Dict]] = None, user_id: Optional[str] = None) -> str:
    """调用 LLM API（通用函数，支持 OpenAI 兼容的 API）"""
    try:
        # 优先从配置文件读取，如果没有则从环境变量读取
        if user_id:
            config = load_config(user_id)
        else:
            # 兼容旧代码，如果没有user_id，尝试加载默认配置
            config_file = BASE_DIR / "config.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            else:
                config = {}
        llm_config = config.get("llm_config", {})
        
        api_key = llm_config.get("api_key", "") or os.getenv("LLM_API_KEY", "")
        base_url = llm_config.get("api_base_url", "") or os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        model = llm_config.get("model_name", "") or os.getenv("LLM_MODEL", "gpt-3.5-turbo")
        
        if not api_key:
            error_msg = "⚠️ 错误：未检测到 API Key。请在「设置」页面输入并保存您的 LLM API Key。"
            print(f"[ERROR] {error_msg}")
            return error_msg
        
        if not base_url:
            base_url = "https://api.openai.com/v1"
        
        if not model:
            model = "gpt-3.5-turbo"
        
        # 获取高级功能配置
        enable_web_search = llm_config.get("enable_web_search", False)
        enable_reasoning = llm_config.get("enable_reasoning", False)
        
        print(f"[DEBUG] 使用 API Key: {api_key[:10]}... (已隐藏)")
        print(f"[DEBUG] Base URL: {base_url}")
        print(f"[DEBUG] Model: {model}")
        print(f"[DEBUG] 联网搜索: {'启用' if enable_web_search else '禁用'}")
        print(f"[DEBUG] 深度思考: {'启用' if enable_reasoning else '禁用'}")
        
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 如果提供了消息历史，使用消息历史；否则使用单个 prompt
        if messages:
            message_list = messages
            print(f"[DEBUG] 使用消息历史，消息数量: {len(message_list)}")
        else:
            message_list = [{"role": "user", "content": prompt}]
            print(f"[DEBUG] 使用单个 prompt，长度: {len(prompt)}")
        
        # 构建 API 调用参数
        api_params = {
            "model": model,
            "messages": message_list,
            "temperature": 0.7
        }
        
        # 根据模型类型和配置添加特殊参数
        # 注意：不同模型对联网搜索和深度思考的支持方式不同
        # 这里提供基础框架，具体实现取决于模型提供商的API规范
        
        # DeepSeek 模型支持的特殊功能
        if "deepseek" in model.lower():
            # DeepSeek 的联网搜索功能
            # 注意：DeepSeek 的联网搜索可能需要特定的模型版本或API参数
            # 某些版本可能需要在消息中添加特殊指令，而不是通过 tools 参数
            if enable_web_search:
                print(f"[INFO] 联网搜索已启用，模型 {model} 将尝试使用最新信息")
                # 如果模型支持，可以在消息中添加提示
                # 这里不修改消息内容，让用户通过 prompt 明确要求
        
            # DeepSeek 的深度思考功能
            # DeepSeek-R1 等推理模型本身就是为深度思考设计的
            if enable_reasoning:
                if "reasoner" in model.lower() or "r1" in model.lower():
                    print(f"[INFO] 深度思考模式已启用，使用推理模型 {model}")
                else:
                    print(f"[INFO] 深度思考模式：当前模型 {model} 可能不是专门的推理模型，建议使用 deepseek-reasoner 或 deepseek-r1")
        
        # OpenAI 和其他兼容 API
        elif enable_web_search or enable_reasoning:
            # OpenAI 可以通过 tools/function calling 实现联网搜索
            # 但这需要额外的工具定义和实现
            if enable_web_search:
                print(f"[INFO] 联网搜索：当前模型 {model} 的联网搜索功能需要额外的工具配置")
            if enable_reasoning:
                print(f"[INFO] 深度思考：当前模型 {model} 的深度思考功能取决于模型本身的能力")
        
        print(f"[DEBUG] 发送请求到 LLM API...")
        response = client.chat.completions.create(**api_params)
        
        result = response.choices[0].message.content
        print(f"[DEBUG] LLM API 响应成功，响应长度: {len(result)}")
        return result
    except Exception as e:
        error_str = str(e)
        error_msg_lower = error_str.lower()
        
        # 尝试从异常对象中获取更详细的错误信息
        error_code = None
        error_type = None
        
        # OpenAI SDK 的错误对象通常有 status_code 和 code 属性
        if hasattr(e, 'status_code'):
            error_code = e.status_code
        if hasattr(e, 'code'):
            error_type = str(e.code).lower()
        if hasattr(e, 'response'):
            try:
                error_body = e.response.json() if hasattr(e.response, 'json') else {}
                if 'error' in error_body:
                    error_info = error_body['error']
                    if isinstance(error_info, dict):
                        error_type = error_info.get('code', '').lower() or error_info.get('type', '').lower()
                        error_str = error_info.get('message', error_str)
                        error_msg_lower = error_str.lower()
            except:
                pass
        
        # 检测余额/配额相关的错误
        balance_keywords = [
            "insufficient quota",
            "insufficient_quota",
            "quota exceeded",
            "quota_exceeded",
            "billing_not_active",
            "insufficient funds",
            "insufficient_funds",
            "account_deactivated",
            "payment required",
            "payment_required",
            "余额不足",
            "配额不足",
            "账户余额不足",
            "billing_not_active"
        ]
        
        # 检查错误码和错误类型
        is_balance_error = (
            any(keyword in error_msg_lower for keyword in balance_keywords) or
            error_type in ['insufficient_quota', 'billing_not_active', 'quota_exceeded'] or
            error_code == 402  # Payment Required
        )
        
        if is_balance_error:
            error_msg = "⚠️ API Key 余额不足或配额已用完，请检查账户余额或充值后重试。"
            print(f"[ERROR] LLM API 调用失败（余额问题）: {error_str}")
        elif error_code == 401 or "unauthorized" in error_msg_lower or error_type == 'invalid_api_key':
            # 检查是否是API Key未设置的问题
            if "api key" in error_msg_lower and ("missing" in error_msg_lower or "not provided" in error_msg_lower or "required" in error_msg_lower):
                error_msg = "⚠️ 错误：未检测到 API Key。请在「设置」页面输入并保存您的 LLM API Key。"
            else:
                error_msg = "⚠️ API Key 无效或未授权。请检查「设置」页面中的 API Key 是否正确，或重新输入有效的 API Key。"
            print(f"[ERROR] LLM API 调用失败（认证问题）: {error_str}")
        elif error_code == 429 or "rate limit" in error_msg_lower or error_type == 'rate_limit_exceeded':
            error_msg = "⚠️ API 请求频率过高，请稍后再试。"
            print(f"[ERROR] LLM API 调用失败（频率限制）: {error_str}")
        elif error_code == 404 or "not found" in error_msg_lower:
            error_msg = "⚠️ 模型不存在或 API 端点错误，请检查模型名称和 Base URL。"
            print(f"[ERROR] LLM API 调用失败（模型不存在）: {error_str}")
        else:
            # 检查错误信息中是否包含API Key相关的问题
            if "api key" in error_msg_lower and ("missing" in error_msg_lower or "not provided" in error_msg_lower or "required" in error_msg_lower):
                error_msg = "⚠️ 错误：未检测到 API Key。请在「设置」页面输入并保存您的 LLM API Key。"
            else:
                error_msg = f"⚠️ 错误: {error_str}。请检查「设置」页面中的 API Key、Base URL 和 Model 名称是否正确。"
            print(f"[ERROR] LLM API 调用失败: {error_str}")
        
        import traceback
        traceback.print_exc()
        return error_msg

async def call_llm_api_stream(messages: List[Dict], user_id: Optional[str] = None):
    """调用 LLM API（流式版本，用于实时显示）"""
    try:
        # 优先从配置文件读取，如果没有则从环境变量读取
        if user_id:
            config = load_config(user_id)
        else:
            config_file = BASE_DIR / "config.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            else:
                config = {}
        llm_config = config.get("llm_config", {})
        
        api_key = llm_config.get("api_key", "") or os.getenv("LLM_API_KEY", "")
        base_url = llm_config.get("api_base_url", "") or os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        model = llm_config.get("model_name", "") or os.getenv("LLM_MODEL", "gpt-3.5-turbo")
        
        if not api_key:
            error_msg = "⚠️ 错误：未检测到 API Key。请在「设置」页面输入并保存您的 LLM API Key。"
            yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"
            return
        
        if not base_url:
            base_url = "https://api.openai.com/v1"
        
        if not model:
            model = "gpt-3.5-turbo"
        
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # 构建 API 调用参数（启用流式输出）
        api_params = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "stream": True
        }
        
        print(f"[DEBUG] 发送流式请求到 LLM API，消息数量: {len(messages)}")
        
        try:
            # 使用asyncio.Queue实现真正的边读边写
            async_queue = asyncio.Queue()
            full_content = ""
            error_occurred = False
            stream_finished = asyncio.Event()
            
            # 获取当前事件循环（在主线程中）
            loop = asyncio.get_event_loop()
            
            def process_stream_sync():
                """在线程中处理同步stream，边读边放入异步队列"""
                try:
                    print(f"[DEBUG] 线程中开始创建stream...")
                    stream = client.chat.completions.create(**api_params)
                    print(f"[DEBUG] Stream创建成功，开始读取chunks...")
                    chunk_count = 0
                    # 边读边写：每读取一个chunk立即放入异步队列
                    for chunk in stream:
                        if chunk.choices and len(chunk.choices) > 0:
                            delta = chunk.choices[0].delta
                            if delta.content:
                                chunk_count += 1
                                # 立即放入异步队列（非阻塞，线程安全）
                                asyncio.run_coroutine_threadsafe(
                                    async_queue.put(delta.content), 
                                    loop
                                )
                                if chunk_count % 10 == 0:
                                    print(f"[DEBUG] 已读取 {chunk_count} 个chunks并放入队列")
                    print(f"[DEBUG] Stream读取完成，共 {chunk_count} 个chunks")
                    # 发送完成信号
                    asyncio.run_coroutine_threadsafe(
                        async_queue.put(None), 
                        loop
                    )
                except Exception as e:
                    print(f"[ERROR] 线程中处理stream异常: {e}")
                    import traceback
                    traceback.print_exc()
                    asyncio.run_coroutine_threadsafe(
                        async_queue.put(("error", str(e))), 
                        loop
                    )
                finally:
                    # 设置完成标志（Event.set()是同步方法，使用call_soon_threadsafe）
                    loop.call_soon_threadsafe(stream_finished.set)
                    print(f"[DEBUG] 线程完成")
            
            # 在后台线程中启动stream处理
            thread = threading.Thread(target=process_stream_sync, daemon=True)
            thread.start()
            
            # 从异步队列中读取数据并立即yield（真正的边读边写）
            chunk_yielded = 0
            while True:
                try:
                    # 等待队列中的数据（异步等待，不阻塞，超时时间很短）
                    item = await asyncio.wait_for(async_queue.get(), timeout=0.05)
                    if item is None:
                        # 完成信号
                        print(f"[DEBUG] 收到完成信号，已yield {chunk_yielded} 个chunks")
                        break
                    elif isinstance(item, tuple) and item[0] == "error":
                        # 错误
                        error_occurred = True
                        print(f"[ERROR] 收到错误信号: {item[1]}")
                        yield f"data: {json.dumps({'error': f'⚠️ 错误: {item[1]}'}, ensure_ascii=False)}\n\n"
                        break
                    else:
                        # 内容 - 立即yield，实现真正的边读边写
                        content = item
                        full_content += content
                        chunk_yielded += 1
                        if chunk_yielded % 10 == 0:
                            print(f"[DEBUG] 已yield {chunk_yielded} 个chunks，当前总长度: {len(full_content)}")
                        yield f"data: {json.dumps({'content': content, 'done': False}, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    # 超时，检查stream是否已完成
                    if stream_finished.is_set():
                        # 检查队列是否还有数据
                        if async_queue.empty():
                            print(f"[DEBUG] Stream完成且队列为空，退出循环，已yield {chunk_yielded} 个chunks")
                            break
                        else:
                            # 还有数据，继续读取
                            continue
                    else:
                        # Stream还在运行，继续等待
                        continue
                except Exception as e:
                    print(f"[ERROR] 读取队列异常: {e}")
                    if stream_finished.is_set():
                        break
                    continue
            
            if not error_occurred:
                # 发送完成信号
                yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content}, ensure_ascii=False)}\n\n"
                print(f"[DEBUG] 流式响应完成，总长度: {len(full_content)}")
            
        except Exception as e:
            error_str = str(e)
            print(f"[ERROR] 流式API调用失败: {error_str}")
            yield f"data: {json.dumps({'error': f'⚠️ 错误: {error_str}'}, ensure_ascii=False)}\n\n"
            
    except Exception as e:
        error_str = str(e)
        print(f"[ERROR] 流式API调用异常: {error_str}")
        import traceback
        traceback.print_exc()
        yield f"data: {json.dumps({'error': f'⚠️ 错误: {error_str}'}, ensure_ascii=False)}\n\n"

# 获取项目根目录
BASE_DIR = Path(__file__).parent.parent
STATIC_DIR = BASE_DIR / "static"

# 静态文件服务
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def read_root():
    """返回前端页面"""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "前端文件未找到，请确保 static/index.html 存在"}

# 用户认证相关API
@app.post("/api/auth/register", response_model=Dict[str, str])
async def register(user: UserRegister):
    users = load_users()
    
    # 检查用户名是否已存在
    if user.username in users:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在，请使用其他用户名")
    
    # 检查邮箱是否已被使用（如果提供了邮箱）
    if user.email:
        for uname, user_data in users.items():
            if user_data.get("email") and user_data.get("email") == user.email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该邮箱已被注册，请使用其他邮箱")
    
    # 检查新注册的用户名是否与已有用户的邮箱相同
    for uname, user_data in users.items():
        if user_data.get("email") and user_data.get("email") == user.username:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名不能与已有用户的邮箱相同，请使用其他用户名")
    
    # 检查新注册的邮箱是否与已有用户的用户名相同
    if user.email and user.email in users:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱不能与已有用户的用户名相同，请使用其他邮箱")
    
    user_id = str(secrets.token_urlsafe(16))  # 生成唯一的user_id
    hashed_password = get_password_hash(user.password)
    
    users[user.username] = {
        "user_id": user_id,
        "hashed_password": hashed_password,
        "email": user.email,
        "created_at": datetime.now().isoformat()
    }
    save_users(users)
    
    # 创建用户专属的配置文件
    initial_config = load_config(user_id)  # 使用load_config的默认值
    save_config(user_id, initial_config)
    
    access_token_expires = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    access_token = create_access_token(
        data={"sub": user_id, "username": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "username": user.username, "user_id": user_id}

@app.post("/api/auth/login", response_model=Dict[str, str])
async def login(user: UserLogin):
    users = load_users()
    
    # 支持用户名或邮箱登录
    db_user = None
    username = None
    
    # 先尝试用户名登录
    if user.username in users:
        db_user = users[user.username]
        username = user.username
    else:
        # 尝试邮箱登录
        for uname, user_data in users.items():
            if user_data.get("email") and user_data.get("email") == user.username:
                db_user = user_data
                username = uname
                break
    
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名/邮箱或密码错误")
    
    user_id = db_user["user_id"]
    access_token_expires = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    access_token = create_access_token(
        data={"sub": user_id, "username": username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "username": username, "user_id": user_id}

# API 端点
@app.get("/api/config/key-content")
async def get_key_content(current_user_id: str = Depends(get_current_user)):
    """获取关键内容"""
    config = load_config(current_user_id)
    return config.get("key_content", {})

@app.post("/api/config/key-content")
async def update_key_content(data: KeyContentUpdate, current_user_id: str = Depends(get_current_user)):
    """更新关键内容"""
    config = load_config(current_user_id)
    config["key_content"] = data.key_content
    save_config(current_user_id, config)
    return {"success": True, "message": "关键内容已保存"}

@app.get("/api/config/prompt-templates")
async def get_prompt_templates(current_user_id: str = Depends(get_current_user)):
    """获取 Prompt 模板"""
    config = load_config(current_user_id)
    prompt_templates = config.get("prompt_templates", {})
    # 返回完整的 prompt_templates 结构（包含 template 和 variable_key）
    return prompt_templates

@app.post("/api/config/prompt-templates")
async def update_prompt_templates(data: PromptTemplatesUpdate, current_user_id: str = Depends(get_current_user)):
    """更新 Prompt 模板"""
    config = load_config(current_user_id)
    # 将 Pydantic 模型转换为字典格式
    prompt_templates_dict = {}
    for key, template_data in data.prompt_templates.items():
        template_dict = {
            "template": template_data.template
        }
        # 支持新格式（variables数组）
        if template_data.variables:
            template_dict["variables"] = [
                {"name": var.name, "key_content_key": var.key_content_key}
                for var in template_data.variables
            ]
        # 向后兼容旧格式（variable_key）
        elif template_data.variable_key:
            template_dict["variable_key"] = template_data.variable_key
        
        prompt_templates_dict[key] = template_dict
    
    config["prompt_templates"] = prompt_templates_dict
    save_config(current_user_id, config)
    return {"success": True, "message": "Prompt 模板已保存"}

@app.get("/api/config/llm")
async def get_llm_config(current_user_id: str = Depends(get_current_user)):
    """获取 LLM 配置"""
    config = load_config(current_user_id)
    llm_config = config.get("llm_config", {})
    # 隐藏 API Key（只返回是否已设置）
    return {
        "api_base_url": llm_config.get("api_base_url", ""),
        "model_name": llm_config.get("model_name", ""),
        "api_key_set": bool(llm_config.get("api_key", "")),
        "enable_web_search": llm_config.get("enable_web_search", False),
        "enable_reasoning": llm_config.get("enable_reasoning", False)
    }

@app.post("/api/config/llm")
async def update_llm_config(data: LLMConfigUpdate, current_user_id: str = Depends(get_current_user)):
    """更新 LLM 配置"""
    config = load_config(current_user_id)
    existing_llm_config = config.get("llm_config", {})
    
    # 如果 api_key 是特殊标记 "__KEEP_EXISTING__"，保留原有的 API Key
    if data.api_key == "__KEEP_EXISTING__":
        api_key = existing_llm_config.get("api_key", "")
        if not api_key:
            raise HTTPException(status_code=400, detail="未找到已保存的 API Key，请重新输入")
    else:
        api_key = data.api_key
    
    config["llm_config"] = {
        "api_base_url": data.api_base_url,
        "model_name": data.model_name,
        "api_key": api_key,
        "enable_web_search": data.enable_web_search if hasattr(data, 'enable_web_search') else False,
        "enable_reasoning": data.enable_reasoning if hasattr(data, 'enable_reasoning') else False
    }
    
    print(f"[DEBUG] 保存 LLM 配置: Base URL={data.api_base_url}, Model={data.model_name}, API Key={'已设置' if api_key else '未设置'}, Web Search={config['llm_config']['enable_web_search']}, Reasoning={config['llm_config']['enable_reasoning']}")
    
    save_config(current_user_id, config)
    
    # 验证保存是否成功
    saved_config = load_config(current_user_id)
    saved_llm_config = saved_config.get("llm_config", {})
    print(f"[DEBUG] 验证保存结果: Base URL={saved_llm_config.get('api_base_url')}, Model={saved_llm_config.get('model_name')}, API Key={'已设置' if saved_llm_config.get('api_key') else '未设置'}")
    
    return {"success": True, "message": "LLM 配置已保存"}

@app.get("/api/conversations")
async def get_conversations(current_user_id: str = Depends(get_current_user)):
    """获取所有对话"""
    config = load_config(current_user_id)
    conversations = config.get("conversations", {})
    current_id = config.get("current_conversation_id")
    
    return {
        "conversations": conversations,
        "current_conversation_id": current_id
    }

@app.post("/api/conversations")
async def create_conversation(data: ConversationCreate, current_user_id: str = Depends(get_current_user)):
    """创建新对话"""
    config = load_config(current_user_id)
    conversation_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    # 如果提供了名称，使用提供的名称；否则使用默认名称
    name = data.name if data.name and data.name.strip() else f"新对话_{conversation_id[-6:]}"
    
    config["conversations"][conversation_id] = {
        "name": name,
        "messages": [],
        "created_at": conversation_id
    }
    config["current_conversation_id"] = conversation_id
    save_config(current_user_id, config)
    
    return {
        "success": True,
        "conversation_id": conversation_id,
        "name": name
    }

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, current_user_id: str = Depends(get_current_user)):
    """获取特定对话的消息"""
    config = load_config(current_user_id)
    conversations = config.get("conversations", {})
    
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="对话不存在")
    
    return {
        "conversation_id": conversation_id,
        "conversation": conversations[conversation_id]
    }

@app.put("/api/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, data: ConversationUpdate, current_user_id: str = Depends(get_current_user)):
    """更新对话名称"""
    config = load_config(current_user_id)
    conversations = config.get("conversations", {})
    
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="对话不存在")
    
    conversations[conversation_id]["name"] = data.name
    save_config(current_user_id, config)
    
    return {"success": True, "message": "对话名称已更新"}

@app.post("/api/conversations/{conversation_id}/chat")
async def chat(conversation_id: str, request: ChatRequest, current_user_id: str = Depends(get_current_user)):
    """对话接口（流式输出）"""
    try:
        config = load_config(current_user_id)
        conversations = config.get("conversations", {})
        
        if conversation_id not in conversations:
            raise HTTPException(status_code=404, detail="对话不存在")
        
        # 添加用户消息
        user_message = {
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now().isoformat()
        }
        conversations[conversation_id]["messages"].append(user_message)
        
        # 构建消息历史（转换为 API 格式）
        message_history = []
        for msg in conversations[conversation_id]["messages"][-10:]:  # 只使用最近10条
            message_history.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        # 保存用户消息
        save_config(current_user_id, config)
        
        # 流式调用 LLM API
        async def generate():
            full_content = ""
            try:
                async for chunk in call_llm_api_stream(message_history, user_id=current_user_id):
                    # 解析SSE数据
                    if chunk.startswith("data: "):
                        data_str = chunk[6:].strip()
                        if data_str:
                            try:
                                data = json.loads(data_str)
                                if "error" in data:
                                    yield chunk
                                    return
                                elif "content" in data:
                                    full_content += data.get("content", "")
                                    yield chunk
                                    if data.get("done", False):
                                        # 流式响应完成，保存助手回复
                                        assistant_message = {
                                            "role": "assistant",
                                            "content": data.get("full_content", full_content),
                                            "timestamp": datetime.now().isoformat()
                                        }
                                        config = load_config(current_user_id)
                                        if conversation_id in config.get("conversations", {}):
                                            config["conversations"][conversation_id]["messages"].append(assistant_message)
                                            save_config(current_user_id, config)
                                        break
                            except json.JSONDecodeError:
                                continue
            except Exception as e:
                error_msg = f'data: {json.dumps({"error": f"⚠️ 错误: {str(e)}"}, ensure_ascii=False)}\n\n'
                yield error_msg
        
        return StreamingResponse(generate(), media_type="text/event-stream")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] 对话接口错误: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"处理请求时出错: {str(e)}")

@app.put("/api/conversations/{conversation_id}/select")
async def select_conversation(conversation_id: str, current_user_id: str = Depends(get_current_user)):
    """选择当前对话"""
    config = load_config(current_user_id)
    conversations = config.get("conversations", {})
    
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="对话不存在")
    
    config["current_conversation_id"] = conversation_id
    save_config(current_user_id, config)
    
    return {"success": True, "conversation_id": conversation_id}

@app.post("/api/chat/send-prompt")
async def send_prompt_to_model(request: Dict[str, Any], current_user_id: str = Depends(get_current_user)):
    """发送 Prompt 给大模型"""
    try:
        prompt_key = request.get("prompt_key", "")
        if not prompt_key:
            raise HTTPException(status_code=400, detail="请选择 Prompt")
        
        config = load_config(current_user_id)
        prompt_templates = config.get("prompt_templates", {})
        key_content = config.get("key_content", {})
        
        # 获取对应的prompt模板（新的数据结构）
        prompt_item = prompt_templates.get(prompt_key)
        if not prompt_item:
            raise HTTPException(status_code=400, detail=f"未找到对应的 Prompt 模板: {prompt_key}")
        
        template = prompt_item.get("template", "")
        
        if not template:
            raise HTTPException(status_code=400, detail=f"Prompt 模板 {prompt_key} 的模板内容为空")
        
        # 支持多个variables（新格式）或单个variable_key（旧格式，兼容）
        full_prompt = template
        variables = prompt_item.get("variables", [])
        variable_key = prompt_item.get("variable_key", "")
        
        print(f"[DEBUG] Prompt Item: {prompt_item}")
        print(f"[DEBUG] Variables: {variables}")
        print(f"[DEBUG] Variable Key: {variable_key}")
        
        if variables and len(variables) > 0:
            # 新格式：多个variables
            print(f"[DEBUG] 使用新格式，variables数量: {len(variables)}")
            for variable in variables:
                var_name = variable.get("name", "variable")
                key_content_key = variable.get("key_content_key", "")
                print(f"[DEBUG] 处理变量: name={var_name}, key_content_key={key_content_key}")
                
                if not key_content_key:
                    raise HTTPException(status_code=400, detail=f"变量 {var_name} 未选择引用的关键内容。请在 Prompt 设置页面为该变量选择一个关键内容条目。")
                
                variable_value = key_content.get(key_content_key, "")
                if not variable_value:
                    raise HTTPException(status_code=400, detail=f"请先在「关键内容设置」页面填写: {key_content_key}")
                
                # 替换变量：{variable_name}
                placeholder = f"{{{var_name}}}"
                print(f"[DEBUG] 替换占位符: {placeholder} -> {variable_value[:50]}...")
                full_prompt = full_prompt.replace(placeholder, variable_value)
        elif variable_key:
            # 旧格式：单个variable_key（向后兼容）
            print(f"[DEBUG] 使用旧格式，variable_key: {variable_key}")
            variable_value = key_content.get(variable_key, "")
            if not variable_value:
                raise HTTPException(status_code=400, detail=f"请先在「关键内容设置」页面填写: {variable_key}")
            # 替换变量：{variable}
            full_prompt = full_prompt.replace("{variable}", variable_value)
        else:
            # 没有variables，直接使用template
            print(f"[DEBUG] 没有variables，直接使用template")
            pass
        
        print(f"[发送Prompt] Prompt Key: {prompt_key}")
        print(f"[发送Prompt] 完整 Prompt: {full_prompt[:200]}...")
        
        # 根据 prompt_key 生成对话名称（去掉"模板"）
        conversation_name = generate_conversation_name(prompt_key)
        
        # 创建或获取当前对话
        conversation_id = config.get("current_conversation_id")
        is_new_conversation = False
        
        if not conversation_id:
            # 创建新对话，使用 prompt 名称
            conversation_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            config["conversations"][conversation_id] = {
                "name": conversation_name,
                "messages": [],
                "created_at": conversation_id
            }
            config["current_conversation_id"] = conversation_id
            is_new_conversation = True
        elif conversation_id not in config["conversations"]:
            # 对话ID存在但对话数据不存在，创建新对话，使用 prompt 名称
            config["conversations"][conversation_id] = {
                "name": conversation_name,
                "messages": [],
                "created_at": conversation_id
            }
            is_new_conversation = True
        else:
            # 对话已存在
            # 如果对话名称是默认的（"新对话_xxxxxx"）或者对话还没有消息，说明是第一次发送 prompt，更新名称
            existing_conversation = config["conversations"][conversation_id]
            existing_name = existing_conversation.get("name", "")
            existing_messages = existing_conversation.get("messages", [])
            
            # 如果名称是默认格式或者没有消息，说明是第一次发送 prompt，更新名称
            if existing_name.startswith("新对话_") or len(existing_messages) == 0:
                config["conversations"][conversation_id]["name"] = conversation_name
            # 否则保持原有名称（不修改）
        
        # 添加用户消息（发送的prompt）
        user_message = {
            "role": "user",
            "content": full_prompt,
            "timestamp": datetime.now().isoformat(),
            "prompt_key": prompt_key
        }
        config["conversations"][conversation_id]["messages"].append(user_message)
        
        # 保存用户消息
        save_config(current_user_id, config)
        
        # 构建消息历史用于流式调用
        message_history = [{"role": "user", "content": full_prompt}]
        
        # 流式调用 LLM API
        async def generate():
            try:
                async for chunk in call_llm_api_stream(message_history, user_id=current_user_id):
                    # 解析SSE数据
                    if chunk.startswith("data: "):
                        data_str = chunk[6:].strip()
                        if data_str:
                            try:
                                data = json.loads(data_str)
                                if "error" in data:
                                    yield chunk
                                    return
                                elif "content" in data:
                                    # 转发内容
                                    yield chunk
                                    if data.get("done", False):
                                        # 流式响应完成，保存助手回复
                                        assistant_message = {
                                            "role": "assistant",
                                            "content": data.get("full_content", ""),
                                            "timestamp": datetime.now().isoformat()
                                        }
                                        config = load_config(current_user_id)
                                        if conversation_id in config.get("conversations", {}):
                                            config["conversations"][conversation_id]["messages"].append(assistant_message)
                                            save_config(current_user_id, config)
                                        break
                            except json.JSONDecodeError:
                                continue
            except Exception as e:
                error_msg = f'data: {json.dumps({"error": f"⚠️ 错误: {str(e)}"}, ensure_ascii=False)}\n\n'
                yield error_msg
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] 发送Prompt时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"发送Prompt时出错: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("启动自然科学基金申请书智能助手")
    print("=" * 50)
    print(f"访问地址: http://127.0.0.1:8000")
    print(f"API 文档: http://127.0.0.1:8000/docs")
    print("=" * 50)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
