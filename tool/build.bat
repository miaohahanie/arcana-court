@echo off
REM 铭刻室桌面版 · 打包脚本（需先 pip install -r requirements.txt）
cd /d "%~dp0"
python -m PyInstaller --noconsole --onefile --name ArcanaScribe --add-data "ui;ui" server.py
echo.
echo 完成：dist\ArcanaScribe.exe（可复制到博客目录或任意位置使用）
pause
