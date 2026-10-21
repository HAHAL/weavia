$ErrorActionPreference = "Stop"
$env:VITE_API_MODE = "live"
$env:VITE_API_BASE_URL = "http://8.160.172.21:8080"
pnpm install
pnpm tauri build --bundles nsis
Write-Host "Installer: src-tauri\target\release\bundle\nsis\"
