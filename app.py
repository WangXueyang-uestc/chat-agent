import streamlit as st
import json
import os
from datetime import datetime
from typing import Dict, Any
import openai
from openai import OpenAI

# 配置页面
st.set_page_config(
    page_title="自然科学基金申请书智能助手",
    page_icon="📝",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 配置文件路径
CONFIG_FILE = "config.json"

def load_config() -> Dict[str, Any]:
    """加载配置文件"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
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
            "prompt_library": {
                "1.1 研究意义": {
                    "一句话介绍目标系统具体定义": {
                        "template": "我在写自然科学基金申请书, 参考这句话\"{style_example}\"的写作风格,根据\"{variable}\",写一句话。",
                        "variable": "目标系统具体定义",
                        "style_example": "自由视点视频技术以三维场景的多视点拍摄为基础,允许用户自由地控制观看视点,从任意三维位置生成场景的新视图。"
                    },
                    "两三句话介绍系统的具体应用": {
                        "template": "我在写自然科学基金申请书, 参考这两句话\"{style_example}\"的写作风格,根据\"{variable}\",写两句话。",
                        "variable": "系统的具体应用",
                        "style_example": "自由视点技术可为大型体育赛事直播、远程视频会议等应用提供全新的技术途径,具有广阔的应用前景。例如,2020年初爆发的新冠肺炎疫情使得对远程会议的需求爆发式增长,相较于传统的视频通话技术,自由视点技术可极大地增强用户参与会议的沉浸感,提升用户的交互体验与沟通效率。"
                    },
                    "一句话介绍国家的相关政策": {
                        "template": "我在写自然科学基金申请书, 参考这句话\"{style_example}\"的写作风格,根据\"{variable}\",写一句话。",
                        "variable": "国家的相关政策",
                        "style_example": "我国《十四五规划和2035远景目标纲要》中已经明确把\"三维图形生成、动态环境建模、实时动作捕捉与虚拟现实内容采集制作\"列为数字经济重点发展方向。"
                    }
                }
            },
            "conversations": {},
            "current_conversation_id": None
        }

def save_config(config: Dict[str, Any]):
    """保存配置文件"""
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def replace_variables(template: str, variable_value: str, style_example: str) -> str:
    """替换模板中的变量"""
    prompt = template.replace("{variable}", variable_value)
    prompt = prompt.replace("{style_example}", style_example)
    return prompt

def call_llm(prompt: str, api_key: str = None, base_url: str = None) -> str:
    """调用 LLM API"""
    try:
        # 优先使用传入的参数，其次使用 secrets，最后使用环境变量
        api_key = api_key or st.secrets.get("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY", ""))
        base_url = base_url or st.secrets.get("OPENAI_BASE_URL", os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"))
        model = st.secrets.get("OPENAI_MODEL", os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"))
        
        if not api_key:
            return "错误: 请配置 OPENAI_API_KEY。可以在 .streamlit/secrets.toml 文件中设置，或设置环境变量。"
        
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"错误: {str(e)}"

def initialize_session_state():
    """初始化 session state"""
    if 'config' not in st.session_state:
        st.session_state.config = load_config()
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    if 'current_prompt_key' not in st.session_state:
        st.session_state.current_prompt_key = None

def main():
    initialize_session_state()
    
    # 标题
    st.title("📝 自然科学基金申请书智能助手")
    
    # 侧边栏1：关键内容设置
    with st.sidebar:
        st.header("🔧 关键内容设置界面")
        
        # 关键内容输入
        st.subheader("关键内容变量")
        key_content = st.session_state.config.get("key_content", {})
        
        updated_key_content = {}
        for key, value in key_content.items():
            updated_key_content[key] = st.text_area(
                key,
                value=value,
                height=100,
                key=f"key_content_{key}"
            )
        
        # 保存关键内容
        if st.button("💾 保存关键内容", use_container_width=True):
            st.session_state.config["key_content"] = updated_key_content
            save_config(st.session_state.config)
            st.success("关键内容已保存！")
    
    # 主内容区域
    col1, col2 = st.columns([1, 3])
    
    with col1:
        st.header("📋 Prompt 设置界面")
        
        # 对话管理
        st.subheader("对话管理")
        if st.button("➕ 新建对话", use_container_width=True):
            conversation_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            st.session_state.config["conversations"][conversation_id] = {
                "name": f"对话_{conversation_id}",
                "messages": [],
                "created_at": conversation_id
            }
            st.session_state.config["current_conversation_id"] = conversation_id
            save_config(st.session_state.config)
            st.session_state.messages = []
            st.rerun()
        
        # 对话列表
        st.subheader("对话框列表")
        conversations = st.session_state.config.get("conversations", {})
        conversation_ids = list(conversations.keys())
        
        if conversation_ids:
            current_id = st.session_state.config.get("current_conversation_id")
            selected_id = st.selectbox(
                "选择对话",
                conversation_ids,
                index=conversation_ids.index(current_id) if current_id in conversation_ids else 0,
                key="conversation_selector"
            )
            
            if selected_id != current_id:
                st.session_state.config["current_conversation_id"] = selected_id
                st.session_state.messages = conversations[selected_id].get("messages", [])
                save_config(st.session_state.config)
                st.rerun()
            
            # 对话名称编辑
            conv_name = st.text_input(
                "对话框名称",
                value=conversations[selected_id].get("name", f"对话_{selected_id}"),
                key="conversation_name"
            )
            if conv_name != conversations[selected_id].get("name"):
                st.session_state.config["conversations"][selected_id]["name"] = conv_name
                save_config(st.session_state.config)
        
        # Prompt 选择
        st.subheader("选择 Prompt")
        prompt_library = st.session_state.config.get("prompt_library", {})
        
        # 构建 Prompt 选项
        prompt_options = []
        prompt_dict = {}
        for section, prompts in prompt_library.items():
            for prompt_name, prompt_data in prompts.items():
                full_name = f"{section} - {prompt_name}"
                prompt_options.append(full_name)
                prompt_dict[full_name] = {
                    "section": section,
                    "name": prompt_name,
                    "data": prompt_data
                }
        
        if prompt_options:
            selected_prompt = st.selectbox(
                "选择具体的目标句子",
                prompt_options,
                key="prompt_selector"
            )
            
            if selected_prompt:
                st.session_state.current_prompt_key = selected_prompt
                
                # 显示 Prompt 详情
                prompt_info = prompt_dict[selected_prompt]
                st.info(f"**变量:** {prompt_info['data']['variable']}")
                
                # 一键生成按钮
                if st.button("🚀 一键生成", use_container_width=True):
                    prompt_data = prompt_info['data']
                    variable_key = prompt_data['variable']
                    variable_value = st.session_state.config["key_content"].get(variable_key, "")
                    style_example = prompt_data.get('style_example', '')
                    
                    if variable_value:
                        full_prompt = replace_variables(
                            prompt_data['template'],
                            variable_value,
                            style_example
                        )
                        
                        # 调用 LLM
                        with st.spinner("正在生成内容..."):
                            generated_text = call_llm(full_prompt)
                        
                        # 保存到对话历史
                        conversation_id = st.session_state.config.get("current_conversation_id")
                        if conversation_id:
                            if conversation_id not in st.session_state.config["conversations"]:
                                st.session_state.config["conversations"][conversation_id] = {
                                    "name": f"对话_{conversation_id}",
                                    "messages": [],
                                    "created_at": conversation_id
                                }
                            
                            message = {
                                "role": "assistant",
                                "content": generated_text,
                                "prompt": selected_prompt,
                                "timestamp": datetime.now().isoformat()
                            }
                            st.session_state.config["conversations"][conversation_id]["messages"].append(message)
                            st.session_state.messages.append(message)
                            save_config(st.session_state.config)
                            st.rerun()
                    else:
                        st.warning(f"请先填写关键内容：{variable_key}")
    
    with col2:
        st.header("💬 对话与微调区域")
        
        # 显示初始输入的文本（关键内容）
        st.subheader("展示一开始输入的文本")
        key_content_display = st.session_state.config.get("key_content", {})
        key_content_text = "\n\n".join([f"**{k}:**\n{v}" for k, v in key_content_display.items() if v])
        st.text_area(
            "关键内容预览",
            value=key_content_text,
            height=200,
            disabled=True,
            key="key_content_display"
        )
        
        # 对话历史
        st.subheader("生成内容")
        if st.session_state.messages:
            for msg in st.session_state.messages:
                with st.chat_message(msg.get("role", "assistant")):
                    st.write(msg.get("content", ""))
                    if msg.get("prompt"):
                        st.caption(f"Prompt: {msg.get('prompt')}")
        else:
            st.info("👈 请从左侧选择 Prompt 并点击「一键生成」开始")
        
        # 交互式对话框
        st.subheader("输入框")
        if prompt := st.chat_input("输入指令进行修改或继续对话..."):
            # 添加用户消息
            user_message = {
                "role": "user",
                "content": prompt,
                "timestamp": datetime.now().isoformat()
            }
            st.session_state.messages.append(user_message)
            
            # 构建上下文
            conversation_context = "\n".join([
                f"{'用户' if msg.get('role') == 'user' else '助手'}: {msg.get('content', '')}"
                for msg in st.session_state.messages[-10:]  # 只使用最近10条消息作为上下文
            ])
            
            full_prompt = f"以下是之前的对话内容：\n{conversation_context}\n\n用户的新请求：{prompt}\n\n请根据用户的请求进行修改或回答。"
            
            # 调用 LLM
            with st.spinner("正在处理..."):
                response = call_llm(full_prompt)
            
            # 添加助手回复
            assistant_message = {
                "role": "assistant",
                "content": response,
                "timestamp": datetime.now().isoformat()
            }
            st.session_state.messages.append(assistant_message)
            
            # 保存到配置
            conversation_id = st.session_state.config.get("current_conversation_id")
            if conversation_id:
                if conversation_id not in st.session_state.config["conversations"]:
                    st.session_state.config["conversations"][conversation_id] = {
                        "name": f"对话_{conversation_id}",
                        "messages": [],
                        "created_at": conversation_id
                    }
                st.session_state.config["conversations"][conversation_id]["messages"] = st.session_state.messages
                save_config(st.session_state.config)
            
            st.rerun()

if __name__ == "__main__":
    main()

