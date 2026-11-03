# ==========================================
# Infinite Forge - Realtime Auto Git Syncer
# 파일 수정 감지 시 3초 딜레이 후 자동 commit & push
# ==========================================

$targetDir = $PSScriptRoot
Set-Location $targetDir

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🔥 Infinite Forge 자동 GitHub 동기화 감시기 시작" -ForegroundColor Green
Write-Host "감시 경로: $targetDir" -ForegroundColor Yellow
Write-Host "파일 수정 후 저장하면 자동으로 커밋 및 푸시됩니다." -ForegroundColor Yellow
Write-Host "종료하려면 창을 닫거나 Ctrl+C를 누르세요." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan

# 파일 변경 감시기(FileSystemWatcher) 설정
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $targetDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.Filter = "*.*"

$debounceTimer = $null
$syncPending = $false
$lastSyncTime = [DateTime]::MinValue

function Push-Changes {
    try {
        Set-Location $targetDir
        $status = git status --porcelain 2>&1
        if ([string]::IsNullOrWhiteSpace($status)) {
            return
        }

        $nowStr = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Write-Host "`n[$nowStr] 🚀 파일 변경 감지! GitHub 동기화 시작..." -ForegroundColor Cyan

        git add .
        $commitMsg = "Auto sync update: $nowStr"
        $commitResult = git commit -m $commitMsg 2>&1
        Write-Host "  -> 커밋 완료: $commitMsg" -ForegroundColor Gray

        Write-Host "  -> GitHub 푸시 중..." -ForegroundColor DarkYellow
        $pushResult = git push origin main 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$nowStr] ✅ GitHub 푸시 성공! Render 자동 배포가 트리거되었습니다." -ForegroundColor Green
        } else {
            Write-Host "[$nowStr] ⚠️ 푸시 실패 또는 네트워크 오류: $pushResult" -ForegroundColor Red
        }
    } catch {
        Write-Host "오류 발생: $_" -ForegroundColor Red
    }
}

$action = {
    $path = $Event.SourceEventArgs.FullPath
    # .git 폴더나 임시 파일 변경은 무시
    if ($path -match "\\\.git" -or $path -match "\\node_modules" -or $path -match "\.tmp") {
        return
    }

    $global:syncPending = $true
    $global:lastChangeTime = [DateTime]::Now
}

Register-ObjectEvent $watcher 'Changed' -Action $action | Out-Null
Register-ObjectEvent $watcher 'Created' -Action $action | Out-Null
Register-ObjectEvent $watcher 'Deleted' -Action $action | Out-Null
Register-ObjectEvent $watcher 'Renamed' -Action $action | Out-Null

# 메인 루프 (Debounce 처리: 저장 연속 발생 시 3초 모아서 1번만 push)
$global:syncPending = $false
$global:lastChangeTime = [DateTime]::MinValue

while ($true) {
    Start-Sleep -Milliseconds 500
    if ($global:syncPending -and ([DateTime]::Now - $global:lastChangeTime).TotalSeconds -ge 3) {
        $global:syncPending = $false
        Push-Changes
    }
}
