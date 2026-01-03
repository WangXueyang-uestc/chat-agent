// API 基础地址 - 根据实际部署情况修改
const API_BASE = window.location.origin + '/api';

// 状态管理
let state = {
    config: null,
    conversations: {},
    currentConversationId: null,
    promptTemplates: {},
    user: null,  // 当前用户信息
    token: null  // JWT token
};

// 从 localStorage 加载 token
function loadToken() {
    const token = localStorage.getItem('auth_token');
    if (token) {
        state.token = token;
        return token;
    }
    return null;
}

// 保存 token 到 localStorage
function saveToken(token) {
    state.token = token;
    localStorage.setItem('auth_token', token);
}

// 清除 token
function clearToken() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('auth_token');
}

// 获取认证头
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    return headers;
}

// 检查是否已登录
function isLoggedIn() {
    return !!state.token;
}

// 检查认证状态
async function checkAuth() {
    if (!state.token) {
        return false;
    }
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: getAuthHeaders()
        });
        if (response.ok) {
            const user = await response.json();
            state.user = user;
            return true;
        } else {
            clearToken();
            return false;
        }
    } catch (error) {
        console.error('检查认证失败:', error);
        clearToken();
        return false;
    }
}

// 路由管理
function initRouter() {
    // 处理导航点击
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);
        });
    });
    
    // 处理 hash 路由
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#page-', '');
        if (hash) {
            switchPage(hash);
        }
    });
    
    // 初始化页面
    const hash = window.location.hash.replace('#page-', '');
    if (hash && ['key-content', 'prompt', 'chat', 'settings'].includes(hash)) {
        switchPage(hash);
    } else {
        switchPage('key-content');
    }
}

// 切换页面
function switchPage(pageName) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 移除所有导航项的 active 状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 激活对应的导航项
    const targetNav = document.querySelector(`[data-page="${pageName}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
    }
    
    // 更新 URL hash
    window.location.hash = `page-${pageName}`;
    
    // 页面切换后的特殊处理
    if (pageName === 'chat') {
        updateKeyContentDisplay();
        loadPromptSelector();
        renderChatConversationSelector();
        if (state.currentConversationId) {
            loadConversationMessages(state.currentConversationId);
        }
        // 检查API Key
        checkAndRemindAPIKey();
    } else if (pageName === 'prompt') {
        renderPromptInputs();
    } else if (pageName === 'settings') {
        loadLLMConfig();
    }
}

// 强制清空输入框
function forceClearInput(input) {
    if (!input) return;
    input.value = '';
    input.setAttribute('value', '');
    // 触发输入事件，确保浏览器更新显示
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

// 初始化
async function init() {
    // 先检查是否已登录
    loadToken();
    const isAuthenticated = await checkAuth();
    
    if (!isAuthenticated) {
        // 显示登录页面（登录页面会自己处理输入框清空，且不会影响用户输入）
        showLoginPage();
        // 设置登录/注册按钮的事件监听器
        setupAuthEventListeners();
    } else {
        // 已登录，初始化应用
        initRouter();
        await loadConfig();
        await loadConversations();
        setupEventListeners();
        updateKeyContentDisplay();
        showMainApp();
        // 检查API Key是否设置
        await checkAndRemindAPIKey();
    }
}

// 检查并提醒API Key设置
async function checkAndRemindAPIKey() {
    try {
        const hasApiKey = await checkAPIKey();
        if (!hasApiKey) {
            // 延迟显示提醒，让页面先加载完成
            setTimeout(() => {
                showError('⚠️ 请先在「设置」页面配置 LLM API Key，否则无法使用对话功能');
            }, 1000);
        }
    } catch (error) {
        console.error('检查 API Key 失败:', error);
    }
}

// 显示登录页面
function showLoginPage() {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const loginPage = document.getElementById('page-login');
    if (loginPage) {
        loginPage.classList.add('active');
    }
    
    // 确保登录输入框是空的（立即清空）
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    if (loginUsername) {
        loginUsername.value = '';
        loginUsername.setAttribute('value', '');
        // 移除autocomplete属性，防止浏览器自动填充
        loginUsername.removeAttribute('autocomplete');
        loginUsername.setAttribute('autocomplete', 'off');
    }
    if (loginPassword) {
        loginPassword.value = '';
        loginPassword.setAttribute('value', '');
        // 移除autocomplete属性，防止浏览器自动填充
        loginPassword.removeAttribute('autocomplete');
        loginPassword.setAttribute('autocomplete', 'off');
    }
    
    // 延迟清空，确保在浏览器自动填充之后
    setTimeout(() => {
        if (loginUsername) {
            loginUsername.value = '';
            loginUsername.setAttribute('value', '');
        }
        if (loginPassword) {
            loginPassword.value = '';
            loginPassword.setAttribute('value', '');
        }
    }, 100);
    
    setTimeout(() => {
        if (loginUsername) {
            loginUsername.value = '';
            loginUsername.setAttribute('value', '');
        }
        if (loginPassword) {
            loginPassword.value = '';
            loginPassword.setAttribute('value', '');
        }
    }, 300);
    
    // 隐藏导航栏
    const sidebar = document.querySelector('.sidebar-nav');
    if (sidebar) {
        sidebar.style.display = 'none';
    }
    // 添加特殊类名以应用全屏样式
    document.body.classList.add('auth-page-active');
    // 更新URL hash
    window.location.hash = 'page-login';
    // 设置登录/注册按钮的事件监听器
    setupAuthEventListeners();
}

// 显示注册页面
function showRegisterPage() {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const registerPage = document.getElementById('page-register');
    if (registerPage) {
        registerPage.classList.add('active');
    }
    // 清空注册表单
    const registerUsername = document.getElementById('register-username');
    const registerPassword = document.getElementById('register-password');
    const registerEmail = document.getElementById('register-email');
    if (registerUsername) registerUsername.value = '';
    if (registerPassword) registerPassword.value = '';
    if (registerEmail) registerEmail.value = '';
    // 隐藏导航栏
    const sidebar = document.querySelector('.sidebar-nav');
    if (sidebar) {
        sidebar.style.display = 'none';
    }
    // 添加特殊类名以应用全屏样式
    document.body.classList.add('auth-page-active');
    // 更新URL hash
    window.location.hash = 'page-register';
    // 设置登录/注册按钮的事件监听器
    setupAuthEventListeners();
}

// 显示主应用
function showMainApp() {
    // 确保所有认证页面都被隐藏
    document.querySelectorAll('.page').forEach(page => {
        if (page.id === 'page-login' || page.id === 'page-register') {
            page.classList.remove('active');
        }
    });
    
    const loginPage = document.getElementById('page-login');
    const registerPage = document.getElementById('page-register');
    if (loginPage) {
        loginPage.classList.remove('active');
    }
    if (registerPage) {
        registerPage.classList.remove('active');
    }
    
    // 移除全屏样式类
    document.body.classList.remove('auth-page-active');
    
    // 显示导航栏
    const sidebar = document.querySelector('.sidebar-nav');
    if (sidebar) {
        sidebar.style.display = 'block';
    }
    
    // 切换到默认页面
    const hash = window.location.hash.replace('#page-', '');
    if (hash && ['key-content', 'prompt', 'chat', 'settings'].includes(hash)) {
        switchPage(hash);
    } else {
        // 清除登录/注册相关的 hash
        if (hash === 'login' || hash === 'register') {
            window.location.hash = 'page-key-content';
        } else {
            switchPage('key-content');
        }
    }
}

// 加载配置
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/config/key-content`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            clearToken();
            showLoginPage();
            return;
        }
        if (!response.ok) {
            throw new Error('加载关键内容失败');
        }
        state.config = { key_content: await response.json() };
        renderKeyContentInputs();
        await loadPromptTemplates();
    } catch (error) {
        console.error('加载配置失败:', error);
        showError('加载配置失败，请检查后端服务是否运行');
    }
}

// 加载 Prompt 模板
async function loadPromptTemplates() {
    try {
        const response = await fetch(`${API_BASE}/config/prompt-templates`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            clearToken();
            showLoginPage();
            return;
        }
        if (!response.ok) {
            throw new Error('加载 Prompt 模板失败');
        }
        state.promptTemplates = await response.json();
    } catch (error) {
        console.error('加载 Prompt 模板失败:', error);
    }
}

// 加载 LLM 配置
async function loadLLMConfig() {
    try {
        const response = await fetch(`${API_BASE}/config/llm`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            clearToken();
            showLoginPage();
            return;
        }
        if (!response.ok) {
            throw new Error('加载 LLM 配置失败');
        }
        const data = await response.json();
        
        const apiBaseUrlInput = document.getElementById('llm-api-base-url');
        const modelNameInput = document.getElementById('llm-model-name');
        const apiKeyInput = document.getElementById('llm-api-key');
        const enableWebSearchCheckbox = document.getElementById('llm-enable-web-search');
        const enableReasoningCheckbox = document.getElementById('llm-enable-reasoning');
        
        if (apiBaseUrlInput) {
            apiBaseUrlInput.setAttribute('autocomplete', 'off');
            apiBaseUrlInput.setAttribute('data-lpignore', 'true');
            apiBaseUrlInput.setAttribute('data-form-type', 'other');
            apiBaseUrlInput.value = data.api_base_url || '';
        }
        if (modelNameInput) {
            // 设置值之前，确保输入框有正确的autocomplete属性
            modelNameInput.setAttribute('autocomplete', 'off');
            modelNameInput.setAttribute('data-lpignore', 'true');
            modelNameInput.setAttribute('data-form-type', 'other');
            modelNameInput.value = data.model_name || '';
        }
        // API Key 不显示实际值，只显示是否已设置
        if (apiKeyInput) {
            if (data.api_key_set) {
                apiKeyInput.placeholder = 'API Key 已设置（输入新值可更新）';
            } else {
                apiKeyInput.placeholder = 'sk-...';
            }
        }
        // 设置高级功能开关
        if (enableWebSearchCheckbox) {
            enableWebSearchCheckbox.checked = data.enable_web_search || false;
        }
        if (enableReasoningCheckbox) {
            enableReasoningCheckbox.checked = data.enable_reasoning || false;
        }
    } catch (error) {
        console.error('加载 LLM 配置失败:', error);
    }
}

// 检查 API Key 是否已设置
async function checkAPIKey() {
    try {
        const response = await fetch(`${API_BASE}/config/llm`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            return false;
        }
        if (!response.ok) {
            return false;
        }
        const data = await response.json();
        return data.api_key_set;
    } catch (error) {
        console.error('检查 API Key 失败:', error);
        return false;
    }
}

// 加载对话列表
async function loadConversations() {
    try {
        const response = await fetch(`${API_BASE}/conversations`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            clearToken();
            showLoginPage();
            return;
        }
        const data = await response.json();
        state.conversations = data.conversations;
        state.currentConversationId = data.current_conversation_id;
        renderChatConversationSelector();
        if (state.currentConversationId) {
            await loadConversationMessages(state.currentConversationId);
        }
    } catch (error) {
        console.error('加载对话失败:', error);
    }
}

// 渲染关键内容输入框
function renderKeyContentInputs() {
    const container = document.getElementById('key-content-inputs');
    if (!container) return;
    
    container.innerHTML = '';
    
    const keyContent = state.config?.key_content || {};
    for (const [key, value] of Object.entries(keyContent)) {
        const item = document.createElement('div');
        item.className = 'key-content-item';
        item.dataset.key = key;
        item.innerHTML = `
            <div class="item-header">
                <input type="text" class="item-name-input" value="${escapeHtml(key)}" data-key="${key}" placeholder="条目名称">
                <button class="btn-delete-item" data-key="${key}" title="删除条目">🗑️</button>
            </div>
            <textarea class="text-area" data-key="${key}" placeholder="请输入内容">${escapeHtml(value || '')}</textarea>
        `;
        container.appendChild(item);
    }
}

// 渲染 Prompt 输入框 - 支持多个variables
function renderPromptInputs() {
    const container = document.getElementById('prompt-inputs');
    if (!container) return;
    
    container.innerHTML = '';
    
    const promptTemplates = state.promptTemplates || {};
    const keyContent = state.config?.key_content || {};
    const keyContentKeys = Object.keys(keyContent);
    
    for (const [promptKey, promptData] of Object.entries(promptTemplates)) {
        const template = promptData.template || '';
        
        // 兼容旧数据格式：如果有variable_key，转换为variables数组
        let variables = [];
        if (promptData.variables && Array.isArray(promptData.variables)) {
            // 新格式：使用variables数组
            variables = promptData.variables;
        } else if (promptData.variable_key) {
            // 旧格式：转换为新格式
            variables = [{name: 'variable1', key_content_key: promptData.variable_key}];
        } else {
            // 默认：至少有一个variable（命名为variable1）
            variables = [{name: 'variable1', key_content_key: ''}];
        }
        
        const item = document.createElement('div');
        item.className = 'key-content-item prompt-item';
        item.dataset.key = promptKey;
        
        // 构建variables HTML
        const variablesHtml = variables.map((variable, index) => {
            const varName = variable.name || `variable${index + 1}`;
            const varKeyContentKey = variable.key_content_key || '';
            return `
                <div class="variable-item" data-variable-index="${index}">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                        <input type="text" class="variable-name-input" value="${escapeHtml(varName)}" placeholder="变量名（如：variable1）" style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <select class="variable-key-select" style="flex: 2; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <option value="">请选择引用的关键内容条目</option>
                            ${keyContentKeys.map(k => `<option value="${escapeHtml(k)}" ${k === varKeyContentKey ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
                        </select>
                        <button class="btn-delete-variable" data-variable-index="${index}" title="删除变量" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
        
        item.innerHTML = `
            <div class="item-header">
                <input type="text" class="item-name-input" value="${escapeHtml(promptKey)}" data-key="${promptKey}" placeholder="Prompt 名称">
                <button class="btn-delete-item" data-key="${promptKey}" title="删除条目">🗑️</button>
            </div>
            <div class="prompt-item-config">
                <label style="display: block; margin-bottom: 10px; font-weight: 600;">引用关键内容：</label>
                <div class="variables-container" data-key="${promptKey}">
                    ${variablesHtml}
                </div>
                <button class="btn-add-variable" data-key="${promptKey}" style="margin-top: 10px; padding: 8px 15px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">➕ 添加变量</button>
            </div>
            <textarea class="text-area" data-key="${promptKey}" placeholder="在此输入 Prompt 模板，可以使用 {variable1}, {variable2} 等作为占位符">${escapeHtml(template)}</textarea>
            <small style="color: #777; font-size: 12px;">提示: 使用 {变量名} 作为变量占位符，系统会自动替换为上面选择的关键内容</small>
        `;
        container.appendChild(item);
    }
}

// 加载 Prompt 选择器（第三个页面）
function loadPromptSelector() {
    const selector = document.getElementById('chat-prompt-selector');
    if (!selector) return;
    
    selector.innerHTML = '<option value="">请选择要使用的 Prompt</option>';
    
    const promptTemplates = state.promptTemplates || {};
    
    for (const promptKey of Object.keys(promptTemplates)) {
        const option = document.createElement('option');
        option.value = promptKey;
        option.textContent = `${promptKey} 的Prompt模板`;
        selector.appendChild(option);
    }
}

// 渲染对话选择器（第三个页面）- 改为列表显示
function renderChatConversationSelector() {
    const listContainer = document.getElementById('conversation-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    const conversationIds = Object.keys(state.conversations);
    if (conversationIds.length === 0) {
        listContainer.innerHTML = '<div class="conversation-empty">暂无对话</div>';
        return;
    }
    
    // 按创建时间排序（旧的在上，新的在下）
    const sortedIds = conversationIds.sort((a, b) => {
        const timeA = state.conversations[a].created_at || a;
        const timeB = state.conversations[b].created_at || b;
        return timeA.localeCompare(timeB);
    });
    
    // 统计同名对话，用于添加版本号（不修改原始数据，使用临时变量）
    const nameCounts = {};
    const nameVersions = {};
    const displayNames = {}; // 临时存储显示名称
    
    // 第一遍：统计每个名称出现的次数
    sortedIds.forEach(id => {
        const name = state.conversations[id].name || `对话_${id}`;
        nameCounts[name] = (nameCounts[name] || 0) + 1;
    });
    
    // 第二遍：为同名对话分配版本号
    sortedIds.forEach(id => {
        const name = state.conversations[id].name || `对话_${id}`;
        if (nameCounts[name] > 1) {
            if (!nameVersions[name]) {
                nameVersions[name] = 0;
            }
            nameVersions[name]++;
            const version = nameVersions[name];
            // 第一个不加版本号，后续加v2, v3...
            if (version === 1) {
                // 第一个，不加版本号
                displayNames[id] = name;
            } else {
                displayNames[id] = `${name} v${version}`;
            }
        } else {
            displayNames[id] = name;
        }
    });
    
    // 渲染列表项
    sortedIds.forEach(id => {
        const conversation = state.conversations[id];
        const displayName = displayNames[id] || conversation.name || `对话_${id}`;
        
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.conversationId = id;
        if (id === state.currentConversationId) {
            item.classList.add('active');
        }
        item.textContent = displayName;
        
        // 点击选择对话
        item.addEventListener('click', async () => {
            try {
                await fetch(`${API_BASE}/conversations/${id}/select`, {
                    method: 'PUT',
                    headers: getAuthHeaders()
                });
                state.currentConversationId = id;
                await loadConversationMessages(id);
                renderChatConversationSelector(); // 重新渲染以更新active状态
                const nameInput = document.getElementById('conversation-name');
                if (nameInput) {
                    nameInput.value = conversation.name || '';
                }
            } catch (error) {
                console.error('选择对话失败:', error);
            }
        });
        
        listContainer.appendChild(item);
    });
    
    // 更新对话名称输入框
    if (state.currentConversationId && state.conversations[state.currentConversationId]) {
        const nameInput = document.getElementById('conversation-name');
        if (nameInput) {
            nameInput.value = state.conversations[state.currentConversationId].name || '';
        }
    }
}

// 更新关键内容显示
function updateKeyContentDisplay() {
    const display = document.getElementById('key-content-display');
    if (!display) return;
    
    const keyContent = state.config?.key_content || {};
    const text = Object.entries(keyContent)
        .filter(([k, v]) => v)
        .map(([k, v]) => `**${k}:**\n${v}`)
        .join('\n\n');
    display.value = text;
}

// 更新 Prompt 项的名称显示（加上"的Prompt模板"）
function updatePromptItemLabel(item) {
    // 已删除 label，此函数保留以兼容现有代码，但不执行任何操作
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 自动保存关键内容
const autoSaveKeyContent = debounce(async () => {
    const keyContent = {};
    document.querySelectorAll('#key-content-inputs .key-content-item').forEach(item => {
        const nameInput = item.querySelector('.item-name-input');
        const textarea = item.querySelector('textarea[data-key]');
        if (nameInput && textarea) {
            const name = nameInput.value.trim();
            if (name) {
                keyContent[name] = textarea.value;
            }
        }
    });
    
        try {
            const response = await fetch(`${API_BASE}/config/key-content`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ key_content: keyContent })
            });
        
        if (response.ok) {
            state.config.key_content = keyContent;
            updateKeyContentDisplay();
            // 重新渲染第二个页面，更新引用选项
            if (document.getElementById('page-prompt').classList.contains('active')) {
                renderPromptInputs();
            }
            showAutoSaveSuccess('关键内容已自动保存');
        }
    } catch (error) {
        console.error('自动保存失败:', error);
    }
}, 1500); // 1.5秒后保存

// 保存 Prompt 模板的核心函数（不防抖）
async function savePromptTemplates() {
    console.log('[DEBUG] 开始保存 Prompt 模板...');
    const promptTemplates = {};
    const items = document.querySelectorAll('#prompt-inputs .key-content-item');
    console.log('[DEBUG] 找到', items.length, '个 Prompt 条目');
    
    items.forEach((item, index) => {
        const nameInput = item.querySelector('.item-name-input');
        const textarea = item.querySelector('textarea[data-key]');
        const variablesContainer = item.querySelector('.variables-container');
        
        console.log(`[DEBUG] 条目 ${index}:`, {
            hasNameInput: !!nameInput,
            hasTextarea: !!textarea,
            hasVariablesContainer: !!variablesContainer
        });
        
        if (nameInput && textarea && variablesContainer) {
            const name = nameInput.value.trim();
            const template = textarea.value.trim();
            
            // 收集所有variables
            const variables = [];
            const variableItems = variablesContainer.querySelectorAll('.variable-item');
            console.log(`[DEBUG] 条目 ${index} "${name}": 找到 ${variableItems.length} 个 variables`);
            
            variableItems.forEach((varItem, varIndex) => {
                const varNameInput = varItem.querySelector('.variable-name-input');
                const varKeySelect = varItem.querySelector('.variable-key-select');
                if (varNameInput && varKeySelect) {
                    const varName = varNameInput.value.trim() || 'variable';
                    const keyContentKey = varKeySelect.value.trim();
                    variables.push({
                        name: varName,
                        key_content_key: keyContentKey
                    });
                    console.log(`[DEBUG] Variable ${varIndex}: name="${varName}", key="${keyContentKey}"`);
                } else {
                    console.warn(`[DEBUG] Variable ${varIndex}: 缺少输入框或选择器`);
                }
            });
            
            if (name) {
                promptTemplates[name] = {
                    template: template,
                    variables: variables
                };
                console.log(`[DEBUG] 已添加 Prompt: "${name}"，包含 ${variables.length} 个 variables`);
            } else {
                console.warn(`[DEBUG] 条目 ${index}: 名称为空，跳过`);
            }
        } else {
            console.warn(`[DEBUG] 条目 ${index}: 缺少必要的元素`);
        }
    });
    
    console.log('[DEBUG] 准备保存的 Prompt 模板:', promptTemplates);
    
    try {
        const response = await fetch(`${API_BASE}/config/prompt-templates`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ prompt_templates: promptTemplates })
        });
        
        console.log('[DEBUG] 保存响应状态:', response.status);
        
        if (response.ok) {
            state.promptTemplates = promptTemplates;
            // 更新第三个页面的选择器
            loadPromptSelector();
            showAutoSaveSuccess('Prompt 模板已自动保存');
            console.log('[DEBUG] 保存成功！');
        } else if (response.status === 401) {
            console.error('[DEBUG] 认证失败，需要重新登录');
            clearToken();
            showLoginPage();
        } else {
            const errorText = await response.text();
            console.error('[DEBUG] 保存失败，状态码:', response.status, '错误信息:', errorText);
            showError('保存失败: ' + errorText);
        }
    } catch (error) {
        console.error('[DEBUG] 自动保存异常:', error);
        showError('保存失败: ' + error.message);
    }
}

// 自动保存 Prompt 模板 - 支持多个variables（带防抖，用于输入变化）
const autoSavePromptTemplates = debounce(savePromptTemplates, 1500); // 1.5秒后保存

// 显示自动保存成功提示（更轻量的提示）
function showAutoSaveSuccess(message) {
    // 移除之前的提示
    const existing = document.querySelector('.auto-save-indicator');
    if (existing) {
        existing.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.className = 'auto-save-indicator';
    indicator.textContent = '✓ ' + message;
    document.body.insertBefore(indicator, document.body.firstChild);
    
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
    }, 2000);
}

// 加载对话消息
async function loadConversationMessages(conversationId) {
    try {
        const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            clearToken();
            showLoginPage();
            return;
        }
        if (!response.ok) {
            throw new Error('加载消息失败');
        }
        const data = await response.json();
        renderMessages(data.conversation.messages);
    } catch (error) {
        console.error('加载消息失败:', error);
    }
}

// 渲染消息
function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="info-message">👈 请先选择一个 Prompt，然后点击「发送 Prompt 给大模型」开始</div>';
        return;
    }
    
    container.innerHTML = '';
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.role}`;
        
        // 如果是助手回复，使用 Markdown 渲染；如果是用户消息，使用纯文本（转义HTML）
        let contentHtml;
        if (msg.role === 'assistant') {
            // 使用 marked.js 渲染 Markdown
            try {
                contentHtml = marked.parse(msg.content || '');
            } catch (e) {
                console.error('Markdown 渲染错误:', e);
                contentHtml = escapeHtml(msg.content || '');
            }
        } else {
            // 用户消息保持纯文本
            contentHtml = escapeHtml(msg.content || '');
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">${contentHtml}</div>
            ${msg.prompt_key ? `<div class="message-meta">Prompt: ${msg.prompt_key}</div>` : ''}
        `;
        container.appendChild(messageDiv);
    });
    
    // 滚动到底部
    container.scrollTop = container.scrollHeight;
}

// 设置事件监听器
function setupEventListeners() {
    // 添加关键内容条目 - 使用事件委托避免重复绑定
    const addKeyContentItemBtn = document.getElementById('add-key-content-item');
    if (addKeyContentItemBtn) {
        // 移除旧的事件监听器（通过克隆节点）
        const newBtn = addKeyContentItemBtn.cloneNode(true);
        addKeyContentItemBtn.parentNode.replaceChild(newBtn, addKeyContentItemBtn);
        newBtn.addEventListener('click', () => {
            const container = document.getElementById('key-content-inputs');
            if (!container) return;
            
            const newKey = `新条目_${Date.now()}`;
            const item = document.createElement('div');
            item.className = 'key-content-item';
            item.dataset.key = newKey;
            item.innerHTML = `
                <div class="item-header">
                    <input type="text" class="item-name-input" value="${newKey}" data-key="${newKey}" placeholder="条目名称">
                    <button class="btn-delete-item" data-key="${newKey}" title="删除条目">🗑️</button>
                </div>
                <textarea class="text-area" data-key="${newKey}" placeholder="请输入内容"></textarea>
            `;
            container.appendChild(item);
            
            // 绑定删除按钮事件
            item.querySelector('.btn-delete-item').addEventListener('click', function() {
                if (confirm('确定要删除这个条目吗？')) {
                    item.remove();
                    autoSaveKeyContent();
                }
            });
            
            // 新添加的条目也会自动保存（通过事件委托）
        });
    }
    
    // 删除关键内容条目
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-item') && e.target.closest('#key-content-inputs')) {
            const item = e.target.closest('.key-content-item');
            if (item && confirm('确定要删除这个条目吗？')) {
                item.remove();
                // 删除后自动保存
                autoSaveKeyContent();
            }
        }
    });
    
    // 监听关键内容变化，自动保存
    const keyContentContainer = document.getElementById('key-content-inputs');
    if (keyContentContainer) {
        // 使用事件委托监听所有输入变化
        keyContentContainer.addEventListener('input', (e) => {
            if (e.target.matches('textarea[data-key], .item-name-input')) {
                autoSaveKeyContent();
            }
        });
        
        // 监听删除操作，删除后也自动保存
        keyContentContainer.addEventListener('DOMNodeRemoved', () => {
            autoSaveKeyContent();
        });
    }
    
    // 保留手动保存按钮（可选，用于立即保存）
    const saveKeyContentBtn = document.getElementById('save-key-content');
    if (saveKeyContentBtn) {
        saveKeyContentBtn.addEventListener('click', async () => {
            const keyContent = {};
            document.querySelectorAll('#key-content-inputs .key-content-item').forEach(item => {
                const nameInput = item.querySelector('.item-name-input');
                const textarea = item.querySelector('textarea[data-key]');
                if (nameInput && textarea) {
                    const name = nameInput.value.trim();
                    if (name) {
                        keyContent[name] = textarea.value;
                    }
                }
            });
            
            try {
                const response = await fetch(`${API_BASE}/config/key-content`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ key_content: keyContent })
                });
                
                if (response.ok) {
                    state.config.key_content = keyContent;
                    updateKeyContentDisplay();
                    // 重新渲染第二个页面，更新引用选项
                    if (document.getElementById('page-prompt').classList.contains('active')) {
                        renderPromptInputs();
                    }
                    showSuccess('关键内容已保存！');
                } else {
                    if (response.status === 401) {
                        clearToken();
                        showLoginPage();
                    } else {
                        showError('保存失败');
                    }
                }
            } catch (error) {
                console.error('保存失败:', error);
                showError('保存失败，请检查网络连接');
            }
        });
    }
    
    // 添加 Prompt 模板条目 - 支持多个variables
    const addPromptItemBtn = document.getElementById('add-prompt-item');
    if (addPromptItemBtn) {
        // 移除旧的事件监听器（通过克隆节点）
        const newBtn = addPromptItemBtn.cloneNode(true);
        addPromptItemBtn.parentNode.replaceChild(newBtn, addPromptItemBtn);
        newBtn.addEventListener('click', () => {
            const container = document.getElementById('prompt-inputs');
            if (!container) return;
            
            const newKey = `新Prompt_${Date.now()}`;
            const keyContent = state.config?.key_content || {};
            const keyContentKeys = Object.keys(keyContent);
            
            const item = document.createElement('div');
            item.className = 'key-content-item prompt-item';
            item.dataset.key = newKey;
            
            // 默认创建一个variable（命名为variable1）
            const defaultVariableHtml = `
                <div class="variable-item" data-variable-index="0">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                        <input type="text" class="variable-name-input" value="variable1" placeholder="变量名（如：variable1）" style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <select class="variable-key-select" style="flex: 2; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <option value="">请选择引用的关键内容条目</option>
                            ${keyContentKeys.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
                        </select>
                        <button class="btn-delete-variable" data-variable-index="0" title="删除变量" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                    </div>
                </div>
            `;
            
            item.innerHTML = `
                <div class="item-header">
                    <input type="text" class="item-name-input" value="${newKey}" data-key="${newKey}" placeholder="Prompt 名称">
                    <button class="btn-delete-item" data-key="${newKey}" title="删除条目">🗑️</button>
                </div>
                <div class="prompt-item-config">
                    <label style="display: block; margin-bottom: 10px; font-weight: 600;">引用关键内容：</label>
                    <div class="variables-container" data-key="${newKey}">
                        ${defaultVariableHtml}
                    </div>
                    <button class="btn-add-variable" data-key="${newKey}" style="margin-top: 10px; padding: 8px 15px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">➕ 添加变量</button>
                </div>
                <textarea class="text-area" data-key="${newKey}" placeholder="在此输入 Prompt 模板，可以使用 {variable1}, {variable2} 等作为占位符"></textarea>
                <small style="color: #777; font-size: 12px;">提示: 使用 {变量名} 作为变量占位符，系统会自动替换为上面选择的关键内容</small>
            `;
            container.appendChild(item);
            
            // 绑定删除按钮事件
            item.querySelector('.btn-delete-item').addEventListener('click', function() {
                if (confirm('确定要删除这个 Prompt 模板吗？')) {
                    item.remove();
                    autoSavePromptTemplates();
                }
            });
        });
    }
    
    // 添加variable按钮事件处理（使用事件委托，防止重复绑定）
    // 使用一个标志来确保只绑定一次
    if (!window._variableEventBound) {
        document.addEventListener('click', (e) => {
            // 检查点击的是按钮本身或其子元素
            const addBtn = e.target.closest('.btn-add-variable');
            if (addBtn) {
                console.log('[DEBUG] 点击了添加variable按钮');
                e.preventDefault();
                e.stopPropagation();
                
                const promptKey = addBtn.dataset.key;
                console.log('[DEBUG] Prompt Key:', promptKey);
                const variablesContainer = addBtn.previousElementSibling;
                if (!variablesContainer || !variablesContainer.classList.contains('variables-container')) {
                    console.error('[DEBUG] 找不到variables-container');
                    return;
                }
                console.log('[DEBUG] 找到variables-container');
                
                const keyContent = state.config?.key_content || {};
                const keyContentKeys = Object.keys(keyContent);
                const currentVariableCount = variablesContainer.querySelectorAll('.variable-item').length;
                
                const newVariableHtml = `
                    <div class="variable-item" data-variable-index="${currentVariableCount}">
                        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                            <input type="text" class="variable-name-input" value="variable${currentVariableCount + 1}" placeholder="变量名（如：variable1）" style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <select class="variable-key-select" style="flex: 2; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                                <option value="">请选择引用的关键内容条目</option>
                                ${keyContentKeys.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
                            </select>
                            <button class="btn-delete-variable" data-variable-index="${currentVariableCount}" title="删除变量" style="padding: 6px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
                        </div>
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newVariableHtml;
                const newVariableElement = tempDiv.firstElementChild;
                variablesContainer.appendChild(newVariableElement);
                
                // 等待DOM更新后立即保存（不使用防抖），因为这是结构性变化
                setTimeout(() => {
                    console.log('[DEBUG] 添加variable后触发保存');
                    savePromptTemplates();
                }, 100);
            }
        });
        window._variableEventBound = true;
    }
    
    // 删除variable按钮事件处理（使用事件委托）
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-variable')) {
            console.log('[DEBUG] 点击了删除variable按钮');
            const variableItem = e.target.closest('.variable-item');
            if (variableItem) {
                const variablesContainer = variableItem.closest('.variables-container');
                const variableCount = variablesContainer.querySelectorAll('.variable-item').length;
                console.log('[DEBUG] 当前variable数量:', variableCount);
                if (variableCount <= 1) {
                    showError('至少需要保留一个变量');
                    return;
                }
                variableItem.remove();
                console.log('[DEBUG] variable已删除');
                // 重新编号
                variablesContainer.querySelectorAll('.variable-item').forEach((item, index) => {
                    item.dataset.variableIndex = index;
                    const deleteBtn = item.querySelector('.btn-delete-variable');
                    if (deleteBtn) {
                        deleteBtn.dataset.variableIndex = index;
                    }
                });
                // 等待DOM更新后立即保存（不使用防抖），因为这是结构性变化
                setTimeout(() => {
                    console.log('[DEBUG] 删除variable后触发保存');
                    savePromptTemplates();
                }, 100);
            } else {
                console.error('[DEBUG] 找不到variable-item');
            }
        }
    });
    
    // 删除 Prompt 模板条目
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-item') && e.target.closest('#prompt-inputs')) {
            const item = e.target.closest('.key-content-item');
            if (item && confirm('确定要删除这个 Prompt 模板吗？')) {
                item.remove();
                // 删除后自动保存
                autoSavePromptTemplates();
            }
        }
    });
    
    // 监听 Prompt 项名称输入，实时更新标签
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('item-name-input') && e.target.closest('#prompt-inputs')) {
            const item = e.target.closest('.key-content-item');
            updatePromptItemLabel(item);
        }
    });
    
    // 监听 Prompt 模板变化，自动保存（使用全局事件委托，确保始终工作）
    // 使用一个标志来确保只绑定一次
    if (!window._promptAutoSaveBound) {
        // 监听输入变化
        document.addEventListener('input', (e) => {
            // 检查是否在prompt-inputs容器内
            if (e.target.closest('#prompt-inputs')) {
                if (e.target.matches('textarea[data-key], .item-name-input, .variable-name-input')) {
                    autoSavePromptTemplates();
                }
            }
        });
        
        // 监听下拉框变化
        document.addEventListener('change', (e) => {
            // 检查是否在prompt-inputs容器内
            if (e.target.closest('#prompt-inputs')) {
                if (e.target.matches('.variable-key-select')) {
                    autoSavePromptTemplates();
                }
            }
        });
        
        window._promptAutoSaveBound = true;
    }
    
    // 保留手动保存按钮（可选，用于立即保存）- 支持多个variables
    const savePromptsBtn = document.getElementById('save-prompts');
    if (savePromptsBtn) {
        savePromptsBtn.addEventListener('click', async () => {
            const promptTemplates = {};
            document.querySelectorAll('#prompt-inputs .key-content-item').forEach(item => {
                const nameInput = item.querySelector('.item-name-input');
                const textarea = item.querySelector('textarea[data-key]');
                const variablesContainer = item.querySelector('.variables-container');
                
                if (nameInput && textarea && variablesContainer) {
                    const name = nameInput.value.trim();
                    const template = textarea.value.trim();
                    
                    // 收集所有variables
                    const variables = [];
                    const variableItems = variablesContainer.querySelectorAll('.variable-item');
                    variableItems.forEach(varItem => {
                        const varNameInput = varItem.querySelector('.variable-name-input');
                        const varKeySelect = varItem.querySelector('.variable-key-select');
                        if (varNameInput && varKeySelect) {
                            const varName = varNameInput.value.trim() || 'variable';
                            const keyContentKey = varKeySelect.value.trim();
                            variables.push({
                                name: varName,
                                key_content_key: keyContentKey
                            });
                        }
                    });
                    
                    if (name) {
                        promptTemplates[name] = {
                            template: template,
                            variables: variables
                        };
                    }
                }
            });
            
            try {
                const response = await fetch(`${API_BASE}/config/prompt-templates`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ prompt_templates: promptTemplates })
                });
                
                if (response.ok) {
                    state.promptTemplates = promptTemplates;
                    showSuccess('Prompt 模板已保存！');
                    // 重新渲染以确保名称显示正确（加上"的Prompt模板"）
                    renderPromptInputs();
                    // 更新第三个页面的选择器
                    loadPromptSelector();
                } else {
                    showError('保存失败');
                }
            } catch (error) {
                console.error('保存失败:', error);
                showError('保存失败，请检查网络连接');
            }
        });
    }
    
    // 保存 LLM 配置
    const saveLLMConfigBtn = document.getElementById('save-llm-config');
    if (saveLLMConfigBtn) {
        saveLLMConfigBtn.addEventListener('click', async () => {
            const apiBaseUrl = document.getElementById('llm-api-base-url').value.trim();
            const modelName = document.getElementById('llm-model-name').value.trim();
            const apiKeyInput = document.getElementById('llm-api-key');
            const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
            const enableWebSearch = document.getElementById('llm-enable-web-search')?.checked || false;
            const enableReasoning = document.getElementById('llm-enable-reasoning')?.checked || false;
            
            // 检查必填项（Base URL 和 Model Name）
            if (!apiBaseUrl || !modelName) {
                showError('请填写 Base URL 和 Model Name');
                return;
            }
            
            // 如果 API Key 为空，需要检查是否已经保存过
            let finalApiKey = apiKey;
            if (!apiKey) {
                // 尝试从服务器获取现有的 API Key 状态
                try {
                    const checkResponse = await fetch(`${API_BASE}/config/llm`, {
                        headers: getAuthHeaders()
                    });
                    if (checkResponse.ok) {
                        const checkData = await checkResponse.json();
                        if (!checkData.api_key_set) {
                            showError('请填写 API Key（首次保存必须输入）');
                            return;
                        }
                        // 如果已有 API Key，使用特殊标记表示保留原有值
                        finalApiKey = '__KEEP_EXISTING__';
                    }
                } catch (error) {
                    console.error('检查现有配置失败:', error);
                    showError('无法检查现有配置，请重新输入 API Key');
                    return;
                }
            }
            
            try {
                const response = await fetch(`${API_BASE}/config/llm`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        api_base_url: apiBaseUrl,
                        model_name: modelName,
                        api_key: finalApiKey,
                        enable_web_search: enableWebSearch,
                        enable_reasoning: enableReasoning
                    })
                });
                
                if (response.ok) {
                    showSuccess('LLM 配置已保存！');
                    // 清空 API Key 输入框（出于安全考虑）
                    if (apiKeyInput) {
                        apiKeyInput.value = '';
                        apiKeyInput.placeholder = 'API Key 已保存（输入新值可更新）';
                    }
                } else {
                    const error = await response.json();
                    showError(error.detail || '保存失败');
                }
            } catch (error) {
                console.error('保存失败:', error);
                showError('保存失败，请检查网络连接');
            }
        });
    }
    
    // 新建对话（第三个页面）
    const newConversationBtn = document.getElementById('new-conversation');
    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', async () => {
            try {
                console.log('[DEBUG] 开始创建新对话');
                const response = await fetch(`${API_BASE}/conversations`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({})
                });
                
                console.log('[DEBUG] 创建对话响应状态:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('[DEBUG] 创建对话成功:', data);
                    await loadConversations();
                    state.currentConversationId = data.conversation_id;
                    renderChatConversationSelector();
                    renderMessages([]);
                    showSuccess('新对话已创建');
                } else {
                    const errorData = await response.json().catch(() => ({ detail: '未知错误' }));
                    console.error('[DEBUG] 创建对话失败，状态码:', response.status, '错误:', errorData);
                    showError('创建对话失败: ' + (errorData.detail || '服务器错误'));
                }
            } catch (error) {
                console.error('[DEBUG] 创建对话异常:', error);
                showError('创建对话失败: ' + error.message);
            }
        });
    }
    
    // 选择对话（第三个页面）- 现在通过列表项点击事件处理，见 renderChatConversationSelector()
    
    // 更新对话名称（第三个页面）
    const conversationNameInput = document.getElementById('conversation-name');
    if (conversationNameInput) {
        conversationNameInput.addEventListener('blur', async (e) => {
            const name = e.target.value.trim();
            if (state.currentConversationId && name) {
                try {
                    await fetch(`${API_BASE}/conversations/${state.currentConversationId}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ name })
                    });
                    await loadConversations();
                    renderChatConversationSelector();
                } catch (error) {
                    console.error('更新对话名称失败:', error);
                }
            }
        });
    }
    
    // 发送 Prompt 给大模型（第三个页面）- 使用事件委托避免重复绑定
    const sendPromptBtn = document.getElementById('send-prompt-btn');
    if (sendPromptBtn) {
        // 移除旧的事件监听器（通过克隆节点）
        const newSendPromptBtn = sendPromptBtn.cloneNode(true);
        sendPromptBtn.parentNode.replaceChild(newSendPromptBtn, sendPromptBtn);
        newSendPromptBtn.addEventListener('click', async () => {
            const selector = document.getElementById('chat-prompt-selector');
            const promptKey = selector.value;
            
            if (!promptKey) {
                showError('请先选择一个 Prompt');
                return;
            }
            
            // 检查 API Key 是否已设置
            const hasApiKey = await checkAPIKey();
            if (!hasApiKey) {
                showError('⚠️ 未检测到 API Key。请在「设置」页面输入并保存您的 LLM API Key 后再试。');
                return;
            }
            
            // 如果没有对话，先创建一个
            if (!state.currentConversationId) {
                try {
                    const response = await fetch(`${API_BASE}/conversations`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({})
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        await loadConversations();
                        state.currentConversationId = data.conversation_id;
                        renderChatConversationSelector();
                    }
                } catch (error) {
                    console.error('创建对话失败:', error);
                    showError('创建对话失败，请重试');
                    return;
                }
            }
            
            newSendPromptBtn.disabled = true;
            newSendPromptBtn.textContent = '发送中...';
            
            const container = document.getElementById('messages-container');
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message assistant';
            loadingDiv.innerHTML = '<div class="message-content loading">正在发送 Prompt 给大模型...</div>';
            if (container && container.children.length === 1 && container.children[0].classList.contains('info-message')) {
                container.innerHTML = '';
            }
            if (container) {
                container.appendChild(loadingDiv);
                container.scrollTop = container.scrollHeight;
            }
            
            try {
                const response = await fetch(`${API_BASE}/chat/send-prompt`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ prompt_key: promptKey })
                });
                
                if (response.ok) {
                    loadingDiv.remove();
                    
                    // 检查响应类型
                    const contentType = response.headers.get('content-type');
                    console.log('[DEBUG] Prompt响应Content-Type:', contentType);
                    
                    // 清空info消息
                    if (container && container.children.length === 1 && container.children[0].classList.contains('info-message')) {
                        container.innerHTML = '';
                    }
                    
                    // 创建助手消息容器（立即创建，确保可见）
                    const assistantMsgDiv = document.createElement('div');
                    assistantMsgDiv.className = 'message assistant';
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'message-content';
                    contentDiv.textContent = ''; // 初始为空
                    assistantMsgDiv.appendChild(contentDiv);
                    if (container) {
                        container.appendChild(assistantMsgDiv);
                        container.scrollTop = container.scrollHeight;
                    }
                    console.log('[DEBUG] 已创建Prompt助手消息容器');
                    
                    // 检查是否是流式响应
                    if (contentType && contentType.includes('text/event-stream')) {
                        console.log('[DEBUG] 检测到Prompt流式响应，开始接收...');
                        // 接收流式响应
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        let fullContent = '';
                        let hasError = false;
                        let hasReceivedData = false;
                        
                        try {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) {
                                    console.log('[DEBUG] Prompt流式响应读取完成，总长度:', fullContent.length);
                                    break;
                                }
                                
                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || ''; // 保留最后一个不完整的行
                                
                                for (const line of lines) {
                                    if (line.trim() === '') continue; // 跳过空行
                                    
                                    if (line.startsWith('data: ')) {
                                        const dataStr = line.slice(6).trim();
                                        if (dataStr) {
                                            try {
                                                const data = JSON.parse(dataStr);
                                                console.log('[DEBUG] 收到Prompt SSE数据:', data);
                                                hasReceivedData = true;
                                                
                                                if (data.error) {
                                                    // 错误处理
                                                    hasError = true;
                                                    console.log('[DEBUG] 收到Prompt错误:', data.error);
                                                    contentDiv.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
                                                    showError(data.error);
                                                    // 标记需要退出外层循环
                                                    throw new Error('STREAM_ERROR'); // 使用异常来退出所有循环
                                                } else if (data.content !== undefined) {
                                                    if (data.done) {
                                                        // 完成，使用Markdown渲染完整内容
                                                        const finalContent = data.full_content || fullContent;
                                                        console.log('[DEBUG] Prompt流式响应完成，总长度:', finalContent.length);
                                                        try {
                                                            contentDiv.innerHTML = marked.parse(finalContent);
                                                        } catch (e) {
                                                            contentDiv.innerHTML = escapeHtml(finalContent);
                                                        }
                                                        // 重新加载对话以更新状态
                                                        await loadConversations();
                                                        state.currentConversationId = state.currentConversationId || Object.keys(state.conversations)[0];
                                                        renderChatConversationSelector();
                                                        // 更新名称输入框
                                                        const nameInput = document.getElementById('conversation-name');
                                                        if (nameInput && state.currentConversationId && state.conversations[state.currentConversationId]) {
                                                            nameInput.value = state.conversations[state.currentConversationId].name || '';
                                                        }
                                                        showSuccess('Prompt 已发送并收到回复！');
                                                    } else if (data.content) {
                                                        // 追加内容（只有非空内容才追加）
                                                        fullContent += data.content;
                                                        console.log('[DEBUG] Prompt更新内容，当前长度:', fullContent.length);
                                                        // 实时更新显示（使用Markdown渲染）
                                                        try {
                                                            contentDiv.innerHTML = marked.parse(fullContent);
                                                        } catch (e) {
                                                            contentDiv.textContent = fullContent;
                                                        }
                                                        if (container) {
                                                            container.scrollTop = container.scrollHeight;
                                                        }
                                                    }
                                                }
                                            } catch (e) {
                                                console.error('[DEBUG] 解析Prompt SSE数据失败:', e, '数据:', dataStr);
                                            }
                                        }
                                    }
                                }
                                
                                if (hasError) break;
                            }
                        } catch (error) {
                            console.error('[DEBUG] 读取Prompt流式响应失败:', error);
                            if (!hasError) {
                                contentDiv.innerHTML = `<div class="error-message">接收响应失败: ${escapeHtml(error.message)}</div>`;
                                showError('接收响应失败: ' + error.message);
                            }
                        }
                    } else {
                        // 非流式响应（回退方案）
                        console.log('[DEBUG] Prompt非流式响应，使用JSON解析');
                        const data = await response.json();
                        const messageContent = data.message?.content || '';
                        if (messageContent) {
                            try {
                                contentDiv.innerHTML = marked.parse(messageContent);
                            } catch (e) {
                                contentDiv.innerHTML = escapeHtml(messageContent);
                            }
                            await loadConversations();
                            renderChatConversationSelector();
                            showSuccess('Prompt 已发送并收到回复！');
                        }
                    }
                } else {
                    loadingDiv.remove();
                    const error = await response.json();
                    const errorMsg = error.detail || '发送失败';
                    // 检查是否是API Key未设置的问题
                    if (errorMsg.includes('未检测到 API Key') || errorMsg.includes('未设置 API Key')) {
                        showError(errorMsg + ' 请前往「设置」页面输入并保存 API Key。');
                    } else if (errorMsg.includes('余额不足') || errorMsg.includes('配额已用完')) {
                        showError(errorMsg + ' 请前往「设置」页面检查 API Key 配置。');
                    } else if (errorMsg.includes('API Key 无效') || errorMsg.includes('未授权')) {
                        showError(errorMsg + ' 请前往「设置」页面检查并更新 API Key。');
                    } else {
                        showError(errorMsg);
                    }
                }
            } catch (error) {
                console.error('发送失败:', error);
                if (loadingDiv.parentNode) loadingDiv.remove();
                showError('⚠️ 发送失败，请检查网络连接。如果问题持续，请前往「设置」页面确认 API Key 已正确输入并保存。');
            } finally {
                newSendPromptBtn.disabled = false;
                newSendPromptBtn.textContent = '🚀 发送 Prompt 给大模型';
            }
        });
    }
    
    // 发送消息 - 使用克隆节点避免重复绑定
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        // 移除旧的事件监听器（通过克隆节点）
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        newSendBtn.addEventListener('click', sendMessage);
    }
    
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        // 移除旧的事件监听器（通过克隆节点）
        const newChatInput = chatInput.cloneNode(true);
        newChatInput.value = chatInput.value; // 保留当前输入的值
        chatInput.parentNode.replaceChild(newChatInput, chatInput);
        newChatInput.addEventListener('keydown', (e) => {
            // 按回车键发送（Shift+Enter 换行）
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!state.currentConversationId) {
        showError('请先发送一个 Prompt 给大模型');
        return;
    }
    
    // 检查 API Key 是否已设置
    try {
        const configResponse = await fetch(`${API_BASE}/config/llm`, {
            headers: getAuthHeaders()
        });
        if (configResponse.status === 401) {
            clearToken();
            showLoginPage();
            return;
        }
        const configData = await configResponse.json();
        if (!configData.api_key_set) {
            showError('⚠️ 未检测到 API Key。请在「设置」页面输入并保存您的 LLM API Key 后再试。');
            return;
        }
    } catch (error) {
        console.error('检查配置失败:', error);
    }
    
    // 添加用户消息到界面
    const container = document.getElementById('messages-container');
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message user';
    userMsgDiv.innerHTML = `<div class="message-content">${escapeHtml(message)}</div>`;
    container.appendChild(userMsgDiv);
    container.scrollTop = container.scrollHeight;
    
    input.value = '';
    input.disabled = true;
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';
    
    // 显示加载提示
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.innerHTML = '<div class="message-content loading">正在处理...</div>';
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    
    try {
        const response = await fetch(`${API_BASE}/conversations/${state.currentConversationId}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            loadingDiv.remove();
            
            // 检查响应类型
            const contentType = response.headers.get('content-type');
            console.log('[DEBUG] 响应Content-Type:', contentType);
            
            // 创建助手消息容器（立即创建，确保可见）
            const assistantMsgDiv = document.createElement('div');
            assistantMsgDiv.className = 'message assistant';
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = ''; // 初始为空，等待流式数据
            assistantMsgDiv.appendChild(contentDiv);
            container.appendChild(assistantMsgDiv);
            container.scrollTop = container.scrollHeight;
            console.log('[DEBUG] 已创建助手消息容器');
            
            // 检查是否是流式响应
            if (contentType && contentType.includes('text/event-stream')) {
                console.log('[DEBUG] 检测到流式响应，开始接收...');
                // 接收流式响应
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullContent = '';
                let hasError = false;
                let hasReceivedData = false;
                
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            console.log('[DEBUG] 流式响应读取完成，总长度:', fullContent.length);
                            if (!hasReceivedData && fullContent.length === 0) {
                                // 没有收到任何数据，可能是错误
                                contentDiv.innerHTML = '<div class="error-message">未收到响应数据</div>';
                            }
                            break;
                        }
                        
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ''; // 保留最后一个不完整的行
                        
                        for (const line of lines) {
                            if (line.trim() === '') continue; // 跳过空行
                            
                            if (line.startsWith('data: ')) {
                                const dataStr = line.slice(6).trim();
                                if (dataStr) {
                                    try {
                                        const data = JSON.parse(dataStr);
                                        console.log('[DEBUG] 收到SSE数据:', data);
                                        hasReceivedData = true;
                                        
                                        if (data.error) {
                                            // 错误处理
                                            hasError = true;
                                            console.log('[DEBUG] 收到错误:', data.error);
                                            contentDiv.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
                                            showError(data.error);
                                            // 标记需要退出外层循环
                                            throw new Error('STREAM_ERROR'); // 使用异常来退出所有循环
                                        } else if (data.content !== undefined) {
                                            if (data.done) {
                                                // 完成，使用Markdown渲染完整内容
                                                const finalContent = data.full_content || fullContent;
                                                console.log('[DEBUG] 流式响应完成，总长度:', finalContent.length);
                                                try {
                                                    contentDiv.innerHTML = marked.parse(finalContent);
                                                } catch (e) {
                                                    console.error('Markdown渲染错误:', e);
                                                    contentDiv.innerHTML = escapeHtml(finalContent);
                                                }
                                                // 重新加载对话以更新状态
                                                await loadConversations();
                                                renderChatConversationSelector();
                                            } else if (data.content) {
                                                // 追加内容（只有非空内容才追加）
                                                fullContent += data.content;
                                                console.log('[DEBUG] 更新内容，当前长度:', fullContent.length);
                                                // 实时更新显示（使用Markdown渲染）
                                                try {
                                                    contentDiv.innerHTML = marked.parse(fullContent);
                                                } catch (e) {
                                                    contentDiv.textContent = fullContent;
                                                }
                                                container.scrollTop = container.scrollHeight;
                                            }
                                        }
                                    } catch (e) {
                                        console.error('[DEBUG] 解析SSE数据失败:', e, '数据:', dataStr);
                                    }
                                }
                            }
                        }
                        
                        if (hasError) break;
                    }
                } catch (error) {
                    console.error('[DEBUG] 读取流式响应失败:', error);
                    if (!hasError) {
                        contentDiv.innerHTML = `<div class="error-message">接收响应失败: ${escapeHtml(error.message)}</div>`;
                        showError('接收响应失败: ' + error.message);
                    }
                }
            } else {
                // 非流式响应（回退方案）
                console.log('[DEBUG] 非流式响应，使用JSON解析');
                const data = await response.json();
                const messageContent = data.message?.content || '';
                if (messageContent) {
                    try {
                        contentDiv.innerHTML = marked.parse(messageContent);
                    } catch (e) {
                        contentDiv.innerHTML = escapeHtml(messageContent);
                    }
                    await loadConversations();
                    renderChatConversationSelector();
                }
            }
        } else {
            loadingDiv.remove();
            const errorData = await response.json();
            const errorMsg = errorData.detail || '发送失败';
            // 检查是否是API Key未设置的问题
            if (errorMsg.includes('未检测到 API Key') || errorMsg.includes('未设置 API Key')) {
                showError(errorMsg + ' 请前往「设置」页面输入并保存 API Key。');
            } else if (errorMsg.includes('余额不足') || errorMsg.includes('配额已用完')) {
                showError(errorMsg + ' 请前往「设置」页面检查 API Key 配置。');
            } else if (errorMsg.includes('API Key 无效') || errorMsg.includes('未授权')) {
                showError(errorMsg + ' 请前往「设置」页面检查并更新 API Key。');
            } else {
                showError(errorMsg);
            }
        }
    } catch (error) {
        console.error('发送失败:', error);
        loadingDiv.remove();
        showError('⚠️ 发送失败，请检查网络连接。如果问题持续，请前往「设置」页面确认 API Key 已正确输入并保存。');
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        input.focus();
    }
}

// 设置认证相关事件监听器
function setupAuthEventListeners() {
    // 登录/注册标签切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`${tab}-form`).classList.add('active');
        });
    });
    
    // 登录按钮
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();
            const errorDiv = document.getElementById('login-error');
            if (errorDiv) errorDiv.style.display = 'none';
            
            if (!username || !password) {
                errorDiv.textContent = '请输入用户名和密码';
                errorDiv.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    saveToken(data.access_token);
                    state.user = { username: data.username, user_id: data.user_id };
                    // 显示用户信息
                    updateUserInfo();
                    // 初始化路由和事件监听器
                    initRouter();
                    setupEventListeners();
                    // 加载数据并切换到主页面
                    await loadConfig();
                    await loadConversations();
                    showMainApp();
                } else {
                    errorDiv.textContent = data.detail || '登录失败';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                errorDiv.textContent = '登录失败，请检查网络连接';
                errorDiv.style.display = 'block';
            }
        });
    }
    
    // 注册按钮（移除旧的事件监听器，避免重复绑定）
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        // 移除旧的事件监听器（如果存在）
        const newRegisterBtn = registerBtn.cloneNode(true);
        registerBtn.parentNode.replaceChild(newRegisterBtn, registerBtn);
        newRegisterBtn.addEventListener('click', async () => {
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const errorDiv = document.getElementById('register-error');
            if (errorDiv) errorDiv.style.display = 'none';
            
            if (!username || !password) {
                errorDiv.textContent = '请输入用户名和密码';
                errorDiv.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, email: email || null })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // 注册成功，显示成功消息并跳转到登录页面
                    errorDiv.style.display = 'none';
                    showSuccess('注册成功！请登录');
                    // 清空注册表单
                    document.getElementById('register-username').value = '';
                    document.getElementById('register-password').value = '';
                    document.getElementById('register-email').value = '';
                    // 延迟跳转到登录页面
                    setTimeout(() => {
                        showLoginPage();
                        // 自动填充用户名（如果可能）
                        const loginUsername = document.getElementById('login-username');
                        if (loginUsername) {
                            loginUsername.value = username;
                        }
                    }, 1500);
                } else {
                    errorDiv.textContent = data.detail || '注册失败';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                errorDiv.textContent = '注册失败，请检查网络连接';
                errorDiv.style.display = 'block';
            }
        });
    }
    
    // 登出按钮
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearToken();
            showLoginPage();
        });
    }
    
    // 登录页面底部的注册链接
    const goToRegisterLink = document.getElementById('go-to-register');
    if (goToRegisterLink) {
        goToRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterPage();
        });
    }
    
    // 注册页面底部的登录链接
    const goToLoginLink = document.getElementById('go-to-login');
    if (goToLoginLink) {
        goToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginPage();
        });
    }
}

// 更新用户信息显示
function updateUserInfo() {
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    if (userInfo && userName && state.user) {
        userName.textContent = state.user.username;
        userInfo.style.display = 'block';
    }
}

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.body.insertBefore(successDiv, document.body.firstChild);
    setTimeout(() => successDiv.remove(), 3000);
}

// 显示认证错误
function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
