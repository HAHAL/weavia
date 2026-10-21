# Windows 打包

当前 macOS 机器没有 Windows SDK/NSIS，无法在本地可靠生成 Windows 安装包。请在 Windows 10/11 或 GitHub Actions Windows runner 上执行。

## 环境

- Node.js 20+
- pnpm
- Rust stable（MSVC toolchain）
- Visual Studio Build Tools（Desktop development with C++）
- WebView2 Runtime（Windows 10/11 通常已安装）

## 构建

PowerShell：

```powershell
$env:VITE_API_MODE="live"
$env:VITE_API_BASE_URL="http://8.160.172.21:8080"
pnpm install
pnpm tauri build --bundles nsis
```

产物：

```text
src-tauri\target\release\bundle\nsis\WEAVIA Desktop_0.1.0_x64-setup.exe
```

## 注意

- 这是 HTTP 测试地址，只用于客户短期验证。
- 正式交付改 HTTPS 域名并重新构建。
- 未签名安装包首次运行会被 SmartScreen 提示，需要“更多信息 → 仍要运行”。
