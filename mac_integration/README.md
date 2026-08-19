# 💻 Mac 全局“划词朗读”配置指南

通过本配置，你在 Mac 电脑上的任意软件（如 **Word、PDF 阅读器、网页、微信、备忘录** 等）中，只要用鼠标选中文字，按下快捷键或右键点击，电脑就会立刻以逼真讲故事的语气朗读给你听。

---

## 方法 1：通过 Mac 自带的「快捷指令 (Shortcuts)」配置（推荐，只需 1 分钟）

1. 在 Mac 上打开 **「快捷指令」** App（系统自带）；
2. 点击右上角 **`+`（新建快捷指令）**；
3. 将名称命名为 **`🎙️ 朗读选中文本`**；
4. 在右侧搜索并添加以下操作：
   - 添加 **「获取当前所选内容」**（或者勾选右侧侧边栏中的“用作快速操作” -> “任何地方的文本”）；
   - 添加 **「运行 Shell 脚本」**，内容填入：
     ```bash
     /bin/bash "/Users/lewisloh/Desktop/LEWIS DATA/APP Builder/Reading App/mac_integration/read_selected.sh" "$1"
     ```
     （输入传递选择“作为参数”或“输入”即可）
5. 在快捷指令右侧详情中，勾选 **「添加到服务菜单」** 并点击 **「添加键盘快捷键」**（例如设置为 `Option + Space` 或 `Control + Shift + R`）。

---

## 方法 2：通过「自动操作 (Automator)」设置为右键服务

1. 打开 Mac 自带的 **「自动操作 (Automator)」**；
2. 新建一个 **「快速操作 (Quick Action)」**；
3. 设置“工作流程收到当前：**文本**，位于：**任何应用程序**”；
4. 从左侧拖入 **「运行 Shell 脚本 (Run Shell Script)」**；
5. Shell 选择 `/bin/bash`，传递输入选择 `作为自变量 (as arguments)`，脚本填入：
   ```bash
   /bin/bash "/Users/lewisloh/Desktop/LEWIS DATA/APP Builder/Reading App/mac_integration/read_selected.sh" "$@"
   ```
6. 按 `Command + S` 保存，命名为 **`🎙️ 听选中的故事`**。

### ✅ 完成！
现在你在任何软件里选中一段话：
- 鼠标右键点击 -> **服务 (Services)** -> **🎙️ 听选中的故事**；
- 或者直接按下你设置的快捷键！
