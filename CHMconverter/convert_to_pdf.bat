@echo off
rem DEBUG/UTILITY SCRIPT: This batch file converts HTML files to PDF using wkhtmltopdf
cd /d "%~dp0"

rem Use environment variable for source directory if set, otherwise use default
if defined SOURCE_DIR (
    echo Using SOURCE_DIR from environment: %SOURCE_DIR%
) else (
    set "SOURCE_DIR=%~dp0reorganized"
    echo Using default SOURCE_DIR: %SOURCE_DIR%
)

set "PDF_DIR=%~dp0pdfs"

if not exist "%PDF_DIR%\" mkdir "%PDF_DIR%"

for /f "tokens=*" %%f in ('dir "%SOURCE_DIR%\*.htm" /b /a-d /od') do (
    if exist "C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe" (
        "C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe" --debug-javascript --enable-local-file-access --load-error-handling ignore --load-media-error-handling ignore "%SOURCE_DIR%\%%f" "%PDF_DIR%\%%~nf.pdf"
    ) else (
        echo wkhtmltopdf.exe not found. Please install wkhtmltopdf or check the path.
        exit /b
    )
)
echo Conversion complete.
