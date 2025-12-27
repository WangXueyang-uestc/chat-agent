# 修复 jose 包错误

## 问题
错误信息显示安装了错误的 `jose` 包（Python 2 版本），导致语法错误。

## 解决方法

在您的终端中执行以下命令（确保在 `torchgpu` 环境中）：

```bash
# 1. 激活环境（如果还没激活）
conda activate torchgpu

# 2. 卸载错误的 jose 包
pip uninstall -y jose

# 3. 安装正确的 python-jose 包
pip install "python-jose[cryptography]"

# 4. 确保其他依赖也已安装
pip install -r requirements.txt
```

## 验证

安装完成后，尝试运行：

```bash
cd backend
python main.py
```

如果还有问题，请检查是否还有其他冲突的包。

