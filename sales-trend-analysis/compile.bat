@echo off
echo ================================================
echo Sales Trend Analysis - C Backend Compiler
echo ================================================

REM Try GCC first
where gcc >nul 2>nul
if %errorlevel%==0 (
    echo [INFO] Found GCC compiler.
    echo Compiling sales_engine.c to sales_engine.dll...
    gcc -shared -o sales_engine.dll -fPIC sales_engine.c
    if %errorlevel%==0 (
        echo [SUCCESS] DLL built successfully with GCC!
        exit /b 0
    ) else (
        echo [ERROR] GCC compilation failed.
        exit /b 1
    )
)

REM Try MSVC (cl.exe)
where cl >nul 2>nul
if %errorlevel%==0 (
    echo [INFO] Found MSVC compiler (cl.exe).
    echo Compiling sales_engine.c to sales_engine.dll...
    cl /LD sales_engine.c /Fe:sales_engine.dll
    if %errorlevel%==0 (
        echo [SUCCESS] DLL built successfully with MSVC!
        exit /b 0
    ) else (
        echo [ERROR] MSVC compilation failed.
        exit /b 1
    )
)

echo [ERROR] No C compiler found!
echo Please install MinGW-w64 (GCC) or Visual Studio C++ Build Tools.
echo Once installed, make sure it is added to your PATH.
exit /b 1
