#!/bin/bash

# 启动脚本
cd "$(dirname "$0")"

echo "正在启动自然科学基金申请书智能助手..."
echo ""

# 检查环境变量
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "警告: 未设置 DEEPSEEK_API_KEY 环境变量"
    echo "请创建 .env 文件或设置环境变量"
    echo ""
fi

# 启动后端服务
echo "启动后端服务..."
cd backend
python main.py

