#!/usr/bin/env python3
"""
检查服务器是否可以正常启动
"""
import sys
import os
from pathlib import Path

# 添加 backend 目录到路径
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 50)
print("检查服务器配置...")
print("=" * 50)

# 检查依赖
print("\n1. 检查 Python 依赖...")
try:
    import fastapi
    print(f"   ✓ FastAPI {fastapi.__version__}")
except ImportError:
    print("   ✗ FastAPI 未安装，请运行: pip install fastapi")
    sys.exit(1)

try:
    import uvicorn
    print(f"   ✓ Uvicorn {uvicorn.__version__}")
except ImportError:
    print("   ✗ Uvicorn 未安装，请运行: pip install uvicorn[standard]")
    sys.exit(1)

try:
    from openai import OpenAI
    print("   ✓ OpenAI 库已安装")
except ImportError:
    print("   ✗ OpenAI 库未安装，请运行: pip install openai")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    print("   ✓ python-dotenv 已安装")
except ImportError:
    print("   ✗ python-dotenv 未安装，请运行: pip install python-dotenv")
    sys.exit(1)

# 检查文件
print("\n2. 检查项目文件...")
base_dir = Path(__file__).parent
static_dir = base_dir / "static"
config_file = base_dir / "config.json"

if static_dir.exists():
    print(f"   ✓ static 目录存在: {static_dir}")
    index_file = static_dir / "index.html"
    if index_file.exists():
        print(f"   ✓ index.html 存在")
    else:
        print(f"   ✗ index.html 不存在")
else:
    print(f"   ✗ static 目录不存在: {static_dir}")

if config_file.exists():
    print(f"   ✓ config.json 存在")
else:
    print(f"   ⚠ config.json 不存在（首次运行会自动创建）")

# 检查环境变量
print("\n3. 检查环境变量...")
load_dotenv()
api_key = os.getenv("DEEPSEEK_API_KEY", "")
if api_key and api_key != "your-deepseek-api-key-here":
    print(f"   ✓ DEEPSEEK_API_KEY 已设置")
else:
    print(f"   ⚠ DEEPSEEK_API_KEY 未设置（请创建 .env 文件）")

base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
print(f"   ✓ DEEPSEEK_BASE_URL: {base_url}")

model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
print(f"   ✓ DEEPSEEK_MODEL: {model}")

# 尝试导入后端
print("\n4. 检查后端代码...")
try:
    from backend.main import app
    print("   ✓ 后端代码可以正常导入")
except Exception as e:
    print(f"   ✗ 后端代码导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 50)
print("检查完成！")
print("=" * 50)
print("\n启动服务器:")
print("  cd backend")
print("  python main.py")
print("\n或者:")
print("  uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000")
print("\n然后访问: http://127.0.0.1:8000")

