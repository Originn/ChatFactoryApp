# TEST SCRIPT: Cloud-native dependency checker
# This script validates that all cloud-native dependencies are properly installed

import sys
import subprocess
import os

def check_python_package(package_name, import_name=None):
    """Check if a Python package is installed."""
    try:
        if import_name:
            __import__(import_name)
        else:
            __import__(package_name)
        print(f"[OK] {package_name} is installed")
        return True
    except ImportError:
        print(f"[MISSING] {package_name} is NOT installed")
        return False

def check_weasyprint_dependencies():
    """Check WeasyPrint system dependencies."""
    try:
        from weasyprint import HTML
        test_html = HTML(string='<h1>Test</h1>')
        print("[OK] WeasyPrint is working correctly")
        return True
    except Exception as e:
        print(f"[ERROR] WeasyPrint has issues: {e}")
        return False

def check_pychm_dependencies():
    """Check PyCHM dependencies."""
    try:
        import chm.chm as chm
        print("[OK] PyCHM is working correctly")
        return True
    except Exception as e:
        print(f"[ERROR] PyCHM has issues: {e}")
        print("       Note: PyCHM requires chmlib system library")
        return False

def main():
    """Run all cloud-native dependency checks."""
    print("Cloud-Native CHM Converter Dependency Check")
    print("=" * 50)
    
    all_good = True
    
    # Check Python packages
    print("\n[PACKAGES] Checking Python packages...")
    packages = [
        ('beautifulsoup4', 'bs4'),
        ('PyPDF2', 'PyPDF2'),
        ('chardet', 'chardet'),
        ('pychm', 'chm'),
        ('weasyprint', 'weasyprint'),
        ('google-cloud-storage', 'google.cloud.storage')
    ]
    
    for package, import_name in packages:
        if not check_python_package(package, import_name):
            all_good = False
    
    # Check WeasyPrint functionality
    print("\n[WEASYPRINT] Testing WeasyPrint...")
    if not check_weasyprint_dependencies():
        all_good = False
    
    # Check PyCHM functionality  
    print("\n[PYCHM] Testing PyCHM...")
    if not check_pychm_dependencies():
        all_good = False
    
    # Check Python version
    print(f"\n[PYTHON] Python version: {sys.version}")
    
    print("\n" + "=" * 50)
    if all_good:
        print("[SUCCESS] All cloud-native dependencies are satisfied!")
        print("You can now run: python automation_cloud.py your_file.chm")
    else:
        print("[ERROR] Some dependencies are missing.")
        print("Please install missing components:")
        print("  pip install -r requirements.txt")
        print("\nNote for WeasyPrint on Windows:")
        print("  You may need to install GTK+ dependencies")
        print("  See: https://weasyprint.readthedocs.io/en/stable/install.html")
        print("\nNote for PyCHM:")
        print("  Requires chmlib system library")
        print("  Ubuntu/Debian: sudo apt-get install libchm-dev")
        print("  Windows: May require compilation or conda install")

if __name__ == "__main__":
    main()
