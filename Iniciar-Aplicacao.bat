@echo off
cd /d "%~dp0"
start "Levantamento de Erva Daninha" http://127.0.0.1:8000
py -m http.server 8000 --bind 127.0.0.1
