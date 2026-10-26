# C/C++ & CUDA Smart Brace Wrap

在 C、C++ 或 CUDA 控制语句末尾按 **`{`**，自动用大括号包住后面连续的一段缩进更深的代码。支持嵌套、多条语句和还没写完的代码。

[下载最新安装包](https://github.com/zlxFTH/vscode-cpp-smart-brace-wrap/releases/latest) · [更新记录](CHANGELOG.md)

## 安装到其他电脑

适用于 Windows、macOS 和 Linux 上的 **VS Code 1.85 及以上版本**。安装不需要 Node.js、C++ 编译器或其他扩展。

1. 打开 [Releases](https://github.com/zlxFTH/vscode-cpp-smart-brace-wrap/releases/latest)，在 **Assets** 中下载 `cpp-smart-brace-wrap-版本号.vsix`。
2. 在 VS Code 中打开扩展面板，点击右上角 **… → 从 VSIX 安装… / Install from VSIX…**。
3. 选择下载的 `.vsix`；如果提示重载窗口，点击重载。
4. 打开 C、C++ 或 CUDA 文件即可使用。状态栏的语言模式应为 **C**、**C++** 或 **CUDA C++**。

也可以在命令行安装（替换为实际下载路径）：

```sh
code --install-extension cpp-smart-brace-wrap-0.1.3.vsix
```

Windows、macOS、Linux 使用同一个 VSIX 文件。更新时下载新版本并重复安装即可。这里通过 GitHub Releases 分发，尚未发布到 VS Code 扩展市场。

如果在 Remote SSH、WSL 或容器窗口中编辑代码，请在该窗口的扩展面板中确认此扩展已启用，并按 VS Code 提示安装到相应位置。

## 使用示例

例如在 `|` 处按 `{`：

```cpp
while (t--) |
    sol();
```

得到：

```cpp
while (t--) {
    sol();|
}
```

`|` 表示光标，不属于实际代码。一次撤销即可恢复。

包裹范围按当前控制语句的缩进确定，不要求代码已经补上分号。例如在内层 `if` 后按 `{`：

```cpp
for (int i = 0; i < m; i++)
    if (cut[i] != 1) |
        as
    aaa =
for (int i = 0; i < m; i++)
    cout << ans[i] << " \n"[i == m - 1];
```

得到：

```cpp
for (int i = 0; i < m; i++)
    if (cut[i] != 1) {
        as|
    }
    aaa =
for (int i = 0; i < m; i++)
    cout << ans[i] << " \n"[i == m - 1];
```

如果在第一个 `for` 后按 `{`，则 `if` 和 `aaa =` 都会被包进去，第二个 `for` 留在外面。同一缩进块中即使有多条完整语句，也会一起包裹。

## 生效条件

- 文件语言模式为 **C**（`c`）、**C++**（`cpp`）或 **CUDA C++**（`cuda-cpp`）。支持 `.c`、`.cpp`、`.cu`、`.cuh`，以及使用这些语言模式的头文件。
- 使用标准 `{` 按键（美式键盘为 `Shift+[`）。
- 单光标、没有选区，光标后到当前行末只有空白。
- 光标位于 `if (...)`、`if constexpr (...)`、`for (...)`、`while (...)`、`else` 或 `do` 后面。
- 后续行已有缩进更深的代码。遇到退回当前层或外层缩进的代码就停止；块内空行和注释会保留。

插件使用缩进确定整个代码块的范围，跨行调用、括号分组、原始字符串和注释不会在中间被切断。已有缩进与行尾格式会保留，末尾行内注释也会留在新代码块内。光标停在块内最后一段代码末尾，字符串里的 `$`、反斜杠和大括号会原样保留。

其他场景沿用 VS Code 原本的 `{` 输入行为，包括选区包裹、普通空代码块、其他语言及多光标。插件不改动全局输入命令。

## 设置

```json
"cppSmartBraceWrap.enabled": false
```

设置为 `false` 可以暂时关闭。也可以在扩展面板中禁用或卸载 **C/C++ & CUDA Smart Brace Wrap**。

## 边界

这是轻量的词法和缩进解析器，不会调用编译器，也不会执行或上传代码。缺少分号、未完成的赋值等情况仍可包裹；引号、注释或括号未闭合、括号不匹配、跨预处理指令、已有代码块等情况会保留原输入行为。它不展开宏，超过 2 MiB 的文件也会保留原输入行为。

安装了 Vim 等接管 `{` 按键的扩展时，可能需要在 VS Code 的键盘快捷方式中调整 `C/C++/CUDA: Insert Brace and Wrap Indented Block` 的按键优先级。

## 本地开发

开发需要 Node.js 22 或更新版本及 npm（CI 使用 Node.js 24）。

```sh
git clone https://github.com/zlxFTH/vscode-cpp-smart-brace-wrap.git
cd vscode-cpp-smart-brace-wrap
npm ci
npm test
npm run test:integration
npm run package
```

`npm run test:integration` 会下载独立 VS Code 并启动隔离的测试窗口。Linux 无桌面环境下使用 `xvfb-run -a npm run test:integration`。可用 `VSCODE_TEST_VERSION` 指定下载版本，或用 `VSCODE_EXECUTABLE_PATH` 指定现有的 VS Code 可执行文件。

`npm run package` 在项目目录生成 `.vsix`，只包含运行源码、扩展清单、许可证与文档；测试、开发依赖和本机测试数据不会进入安装包。

## 发布新版本

1. 修改代码和 `CHANGELOG.md`，运行测试。
2. 用 `npm version patch --no-git-tag-version` 更新 `package.json` 和锁文件（也可以选择 `minor` 或 `major`）。
3. 提交并推送代码，然后创建与 `package.json` 一致的版本标签，例如：

```sh
git add .
git commit -m "Release 0.1.4"
git push origin main
git tag v0.1.4
git push origin v0.1.4
```

GitHub Actions 会在 Windows、macOS 和 Linux 上运行解析器测试与 VS Code 集成测试；全部通过后打包 VSIX。推送版本标签还会自动创建 Release 并附上安装包，不需要配置额外的发布密钥。

扩展 ID：`local-tools.cpp-smart-brace-wrap`。没有运行时依赖。
