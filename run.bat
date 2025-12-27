@echo off
chcp 65001 >nul
echo 正在启动自然科学基金申请书智能助手...
echo.

cd /d %~dp0

REM 检查环境变量
if "%DEEPSEEK_API_KEY%"=="" (
    echo 警告: 未设置 DEEPSEEK_API_KEY 环境变量
    echo 请创建 .env 文件或设置环境变量
    echo.
)

REM 启动后端服务
echo 启动后端服务...
cd backend
python main.py
pause

