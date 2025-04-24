@echo off
echo Starting Web Scraper Servers...

REM Set the project root directory
set PROJECT_DIR=%~dp0
cd %PROJECT_DIR%

REM Check if Python is installed
python --version > nul 2>&1
if errorlevel 1 (
    echo Python is not installed or not in PATH
    pause
    exit /b
)

REM Install Python dependencies globally
echo Installing Python dependencies...
cd backend
echo Installing core dependencies...
pip install fastapi uvicorn aiohttp beautifulsoup4 pydantic python-multipart lxml websockets python-jose validators
echo Installing additional dependencies...
pip install -r requirements.txt

REM Clear the screen
cls

REM Start backend server in a new window (from backend directory)
echo Starting backend server...
start cmd /k "cd %PROJECT_DIR%\backend && title Backend Server && python -m uvicorn app:app --host 0.0.0.0 --port 8001 --reload"

REM Start frontend server in a new window (from frontend directory)
echo Starting frontend server...
start cmd /k "cd %PROJECT_DIR%\frontend && title Frontend Server && python -m http.server 8000"

echo.
echo Servers are starting...
echo.
echo Frontend will be available at: http://localhost:8000
echo Backend will be available at: http://localhost:8001
echo.
echo If you see any errors in the server windows, please wait for all installations to complete.
echo To test the application:
echo 1. Open your browser to http://localhost:8000
echo 2. Enter a target URL to scan (e.g., https://example.com)
echo 3. Click "Start Scan" to begin
echo.
echo Press any key to stop all servers...
pause > nul

REM Kill the servers when user presses a key
taskkill /FI "WindowTitle eq Backend Server" /T /F
taskkill /FI "WindowTitle eq Frontend Server" /T /F

exit /b
