# TEST SCRIPT: This script validates that all dependencies are properly installed
# Run this before attempting CHM conversion to ensure everything is set up correctly

import sys
import subprocess
import os

def check_python_package(package_name):
    """Check if a Python package is installed."""
    try:
        __import__(package_name)
        print(f"[OK] {package_name} is installed")
        return True
    except ImportError:
        print(f"[MISSING] {package_name} is NOT installed")
        return False

def check_executable(exe_name, expected_paths=None):
    """Check if an executable is available."""
    # First try to run it directly (in PATH)
    try:
        subprocess.run([exe_name, '--version'], capture_output=True, check=True)
        print(f"[OK] {exe_name} is available in PATH")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    
    # If not in PATH, check expected paths
    if expected_paths:
        for path in expected_paths:
            if os.path.exists(path):
                print(f"[OK] {exe_name} found at: {path}")
                return True
    
    print(f"[MISSING] {exe_name} is NOT available")
    return False

def main():
    """Run all dependency checks."""
    print("CHM Converter Dependency Check")
    print("=" * 40)
    
    all_good = True
    
    # Check Python packages
    print("\n[PACKAGES] Checking Python packages...")
    packages = ['bs4', 'PyPDF2', 'chardet']
    for package in packages:
        if not check_python_package(package):
            all_good = False
    
    # Check external executables
    print("\n[TOOLS] Checking external tools...")
    
    # Check archmage
    if not check_executable('archmage'):
        all_good = False
    
    # Check wkhtmltopdf
    wkhtmltopdf_paths = []
    if os.name == 'nt':  # Windows
        wkhtmltopdf_paths = [
            r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe",
            r"C:\Program Files (x86)\wkhtmltopdf\bin\wkhtmltopdf.exe"
        ]
    
    if not check_executable('wkhtmltopdf', wkhtmltopdf_paths):
        all_good = False
    
    # Check Python interpreter
    print(f"\n[PYTHON] Python version: {sys.version}")
    
    print("\n" + "=" * 40)
    if all_good:
        print("[SUCCESS] All dependencies are satisfied!")
        print("You can now run: python automation.py your_file.chm")
    else:
        print("[ERROR] Some dependencies are missing.")
        print("Please install missing components before running the converter.")
        print("\nInstallation commands:")
        print("  pip install -r requirements.txt")
        print("  pip install archmage")
        print("  Download wkhtmltopdf from: https://wkhtmltopdf.org/downloads.html")

if __name__ == "__main__":
    main()
