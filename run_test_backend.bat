@echo off
REM Run test_backend.py with explicit Python interpreter path

set PYTHON_PATH=C:\Users\Anon\AppData\Roaming\Python\Python313\python.exe
if not exist "%PYTHON_PATH%" (
    echo Python interpreter not found at %PYTHON_PATH%
    pause
    exit /b
)

echo Running test_backend.py with Python at %PYTHON_PATH%
"%PYTHON_PATH%" test_backend.py

pause
