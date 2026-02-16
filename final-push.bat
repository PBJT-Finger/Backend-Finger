@echo off
echo Finalizing Git setup...
git init
git remote remove origin 2>nul
git remote add origin https://github.com/PBJT-Finger/Backend-Finger.git
git branch -M main

echo Explicitly adding project files...
git add src/
git add prisma/
git add seeds/
git add package.json
git add .env.example
git add .gitignore
git add README.md
git add Dockerfile
git add docker-compose.yml
git add eslint.config.js
git add .prettierrc
git add .prettierignore

echo Creating clean commit...
git config user.name "User"
git config user.email "user@example.com"
git commit -m "Final clean project push"

echo Force pushing to GitHub...
git push -u origin main --force

echo Complete!
