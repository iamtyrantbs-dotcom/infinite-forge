# GitHub 배포 및 자동 동기화 스크립트 (Infinite Forge)

if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "오류: Git이 설치되어 있지 않습니다!" -ForegroundColor Red
    Write-Host "https://git-scm.com/ 에서 Git을 설치해주세요." -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Red
    Start-Sleep -Seconds 5
    exit
}

# 사용자 정보 확인
$userName = git config user.name
$userEmail = git config user.email

if ([string]::IsNullOrWhiteSpace($userName)) {
    $userName = Read-Host "Git 커밋자 이름(Name)을 입력하세요"
    git config --global user.name "$userName"
}

if ([string]::IsNullOrWhiteSpace($userEmail)) {
    $userEmail = Read-Host "Git 커밋자 이메일(Email)을 입력하세요"
    git config --global user.email "$userEmail"
}

# 저장소 초기화 여부 확인
if (!(Test-Path ".git")) {
    $repoUrl = Read-Host "새로 생성한 GitHub Repository URL을 입력하세요 (예: https://github.com/유저명/infinite-forge.git)"
    if ([string]::IsNullOrWhiteSpace($repoUrl)) {
        Write-Host "URL이 비어 있습니다. 종료합니다." -ForegroundColor Red
        Start-Sleep -Seconds 5
        exit
    }
    Write-Host "Git 저장소를 초기화합니다..." -ForegroundColor Cyan
    git init
    git branch -M main
    git remote add origin $repoUrl
}

Write-Host "변경사항을 추가하고 커밋합니다..." -ForegroundColor Cyan
git add .
$commitMessage = "Deploy update: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$commitOutput = git commit -m $commitMessage 2>&1

if ($commitOutput -match "nothing to commit") {
    Write-Host "새로운 변경사항이 없습니다." -ForegroundColor Yellow
} else {
    Write-Host $commitOutput -ForegroundColor Gray
}

Write-Host "GitHub(main 브랜치)로 푸시합니다..." -ForegroundColor Green
git push -u origin main

Write-Host "`n완료! 코드가 GitHub에 정상적으로 올라갔습니다." -ForegroundColor Green
Start-Sleep -Seconds 3
