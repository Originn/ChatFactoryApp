#!/usr/bin/env python3
# TEST SCRIPT: Simple functionality test for cloud-native CHM converter
# This creates a minimal test to validate the core components work

import os
import tempfile
from pathlib import Path
import logging

# Configure logging for test
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_weasyprint():
    """Test WeasyPrint HTML to PDF conversion."""
    print("\n=== Testing WeasyPrint ===")
    try:
        from weasyprint import HTML
        
        # Create test HTML
        test_html = """
        <!DOCTYPE html>
        <html>
        <head><title>Test Document</title></head>
        <body>
            <h1>Test HTML to PDF</h1>
            <p>This is a test document for WeasyPrint.</p>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" alt="test">
        </body>
        </html>
        """
        
        # Convert to PDF
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            html_doc = HTML(string=test_html)
            html_doc.write_pdf(tmp.name)
            
            # Check if file was created
            if os.path.exists(tmp.name) and os.path.getsize(tmp.name) > 0:
                print("✅ WeasyPrint test PASSED")
                os.unlink(tmp.name)
                return True
            else:
                print("❌ WeasyPrint test FAILED - No PDF created")
                return False
                
    except Exception as e:
        print(f"❌ WeasyPrint test FAILED: {e}")
        return False

def test_pychm():
    """Test PyCHM basic functionality."""
    print("\n=== Testing PyCHM ===")
    try:
        import chm.chm as chm
        
        # Test basic CHM functionality (without actual CHM file)
        chm_file = chm.CHMFile()
        print("✅ PyCHM import and initialization PASSED")
        return True
        
    except Exception as e:
        print(f"❌ PyCHM test FAILED: {e}")
        print("   Note: You may need to install chmlib system library")
        return False

def test_beautifulsoup():
    """Test BeautifulSoup HTML parsing."""
    print("\n=== Testing BeautifulSoup ===")
    try:
        from bs4 import BeautifulSoup
        
        test_html = '<html><head><title>Test</title></head><body><p>Test</p></body></html>'
        soup = BeautifulSoup(test_html, 'html.parser')
        
        if soup.title.string == 'Test':
            print("✅ BeautifulSoup test PASSED")
            return True
        else:
            print("❌ BeautifulSoup test FAILED - Parsing issue")
            return False
            
    except Exception as e:
        print(f"❌ BeautifulSoup test FAILED: {e}")
        return False

def test_pdf_merger():
    """Test PyPDF2 merger functionality."""
    print("\n=== Testing PyPDF2 ===")
    try:
        from PyPDF2 import PdfMerger
        
        merger = PdfMerger()
        print("✅ PyPDF2 test PASSED")
        return True
        
    except Exception as e:
        print(f"❌ PyPDF2 test FAILED: {e}")
        return False

def test_concurrent_futures():
    """Test concurrent processing capability."""
    print("\n=== Testing Concurrent Processing ===")
    try:
        from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
        
        def test_function(x):
            return x * 2
        
        # Test ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(test_function, [1, 2, 3]))
            
        if results == [2, 4, 6]:
            print("✅ Concurrent processing test PASSED")
            return True
        else:
            print("❌ Concurrent processing test FAILED")
            return False
            
    except Exception as e:
        print(f"❌ Concurrent processing test FAILED: {e}")
        return False

def main():
    """Run all functionality tests."""
    print("Cloud-Native CHM Converter Functionality Test")
    print("=" * 50)
    
    tests = [
        test_beautifulsoup,
        test_pdf_merger,
        test_concurrent_futures,
        test_weasyprint,
        test_pychm
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"🎉 ALL TESTS PASSED ({passed}/{total})")
        print("The cloud-native CHM converter is ready to use!")
    else:
        print(f"⚠️  SOME TESTS FAILED ({passed}/{total} passed)")
        print("Please install missing dependencies before using the converter.")
        
        if not results[-1]:  # PyCHM failed
            print("\nPyCHM Installation Help:")
            print("  Ubuntu/Debian: sudo apt-get install libchm-dev")
            print("  Then: pip install pychm")
            
        if not results[-2]:  # WeasyPrint failed
            print("\nWeasyPrint Installation Help:")
            print("  See: https://weasyprint.readthedocs.io/en/stable/install.html")
            print("  May require system dependencies (GTK+, cairo, pango)")

if __name__ == "__main__":
    main()
