# 원격 도구는 보안상 .vscode · .github 폴더에 직접 쓸 수 없어서, 이 스크립트로 한 번만 복사한다.
# 실행 (프로젝트 루트에서):
#   powershell -ExecutionPolicy Bypass -File _setup\install-config.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

New-Item -ItemType Directory -Force -Path "$root\.vscode", "$root\.github\workflows" | Out-Null
Copy-Item -Path "$PSScriptRoot\vscode\*" -Destination "$root\.vscode\" -Force
Copy-Item -Path "$PSScriptRoot\github\ci.yml" -Destination "$root\.github\workflows\ci.yml" -Force

Write-Host "완료: .vscode(추천 확장 · 설정 · F5 디버깅 · 작업)와 .github/workflows/ci.yml을 복사했습니다."
Write-Host "이제 _setup 폴더는 지워도 됩니다."
