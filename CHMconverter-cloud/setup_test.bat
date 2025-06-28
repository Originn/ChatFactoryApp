@echo off
rem TEST SCRIPT: Quick setup and test for cloud-native CHM converter
echo Cloud-Native CHM Converter Setup
echo ================================
echo.

echo [1/3] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Checking dependencies...
python check_cloud_dependencies.py
if errorlevel 1 (
    echo ERROR: Dependency check failed
    pause
    exit /b 1
)

echo.
echo [3/3] Running functionality tests...
python test_functionality.py
if errorlevel 1 (
    echo WARNING: Some functionality tests failed
    echo You may still be able to use the converter with limitations
)

echo.
echo Setup complete! 
echo.
echo Usage: python automation_cloud.py your_file.chm --output-dir output/ --max-workers 4
echo.
pause
