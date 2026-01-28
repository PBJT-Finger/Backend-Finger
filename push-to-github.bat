@echo off
REM push-to-github.bat - Push Clean Architecture ke GitHub

echo ========================================
echo PUSHING TO GITHUB
echo ========================================
echo.

echo Checking Git remote...
git remote -v
echo.

echo Checking Git status...
git status
echo.

echo Adding all changes...
git add .
echo.

echo Committing changes...
git commit -m "feat: Implement Clean Architecture - Domain, Application, Infrastructure, Presentation layers with DI container"
echo.

echo Pushing to GitHub...
git push origin main
echo.

if %errorlevel% equ 0 (
    echo ========================================
    echo PUSH SUCCESSFUL!
    echo ========================================
) else (
    echo.
    echo Trying to push to 'master' branch...
    git push origin master
    
    if %errorlevel% equ 0 (
        echo ========================================
        echo PUSH SUCCESSFUL!
        echo ========================================
    ) else (
        echo ========================================
        echo PUSH FAILED - Check errors above
        echo ========================================
        pause
        exit /b 1
    )
)

echo.
echo View your changes at:
echo https://github.com/PBJT-Finger/Backend-Finger
echo.

pause
