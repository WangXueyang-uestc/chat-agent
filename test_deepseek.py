#!/usr/bin/env python3
"""
测试 DeepSeek API 连接
"""
import os
from dotenv import load_dotenv
from openai import OpenAI

# 加载环境变量
load_dotenv()

def test_deepseek():
    """测试 DeepSeek API 连接"""
    print("=" * 50)
    print("测试 DeepSeek API 连接")
    print("=" * 50)
    
    # 检查环境变量
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
    
    print(f"\n1. 检查配置:")
    print(f"   API Key: {'已设置' if api_key and api_key != 'your-deepseek-api-key-here' else '❌ 未设置或使用默认值'}")
    if api_key:
        print(f"   API Key 前缀: {api_key[:10]}...")
    print(f"   Base URL: {base_url}")
    print(f"   Model: {model}")
    
    if not api_key or api_key == "your-deepseek-api-key-here":
        print("\n❌ 错误: 请先配置 DEEPSEEK_API_KEY")
        print("   创建 .env 文件并添加:")
        print("   DEEPSEEK_API_KEY=sk-your-actual-api-key")
        return False
    
    # 测试 API 连接
    print(f"\n2. 测试 API 连接...")
    try:
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        print("   发送测试请求...")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "你好，请回复'连接成功'"}
            ],
            temperature=0.7
        )
        
        result = response.choices[0].message.content
        print(f"   ✅ API 连接成功！")
        print(f"   响应: {result}")
        return True
        
    except Exception as e:
        print(f"   ❌ API 连接失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_deepseek()
    print("\n" + "=" * 50)
    if success:
        print("✅ DeepSeek API 配置正确，可以正常使用！")
    else:
        print("❌ DeepSeek API 配置有问题，请检查上述错误信息")
    print("=" * 50)

