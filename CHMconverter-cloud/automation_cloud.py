#!/usr/bin/env python3
"""
Cloud-Native CHM to PDF Workflow Automation

This script uses Python libraries instead of external tools for cloud compatibility:
- PyCHM for CHM extraction (replaces archmage)
- WeasyPrint for HTML→PDF conversion (replaces wkhtmltopdf)
- Concurrent processing for speed optimization

Usage:
    python automation_cloud.py /path/to/your/file.chm [--output-dir OUTPUT_DIR]
"""

import os
import sys
import shutil
import argparse
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import tempfile
from typing import List, Tuple

# Cloud-native imports
import chm.chm as chm
from bs4 import BeautifulSoup
from weasyprint import HTML, CSS
from PyPDF2 import PdfMerger
import chardet

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Convert CHM file to PDF (Cloud-Native)')
    parser.add_argument('chm_file', help='Path to the CHM file to convert')
    parser.add_argument('--output-dir', help='Output directory for the final PDF', default='.')
    parser.add_argument('--max-workers', type=int, default=4, help='Maximum parallel workers')
    return parser.parse_args()

class CloudCHMExtractor:
    """Cloud-native CHM extractor using PyCHM."""
    
    def __init__(self, chm_file_path: str):
        self.chm_file_path = chm_file_path
        self.chm_file = None
        self.extraction_dir = "extractedCHM"
        
    def extract(self) -> bool:
        """Extract CHM file using PyCHM library."""
        logger.info(f"Extracting CHM file: {self.chm_file_path}")
        
        try:
            # Remove existing extraction directory
            if os.path.exists(self.extraction_dir):
                shutil.rmtree(self.extraction_dir)
            os.makedirs(self.extraction_dir, exist_ok=True)
            
            # Open CHM file
            self.chm_file = chm.CHMFile()
            if not self.chm_file.LoadCHM(self.chm_file_path):
                logger.error("Failed to load CHM file")
                return False
            
            # Extract all files
            self._extract_all_files()
            
            logger.info("CHM extraction completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to extract CHM file: {e}")
            return False
    
    def _extract_all_files(self):
        """Extract all files from CHM."""
        def callback(chm_file, ui, context):
            # Extract each file
            if ui.path.startswith('/'):
                relative_path = ui.path[1:]  # Remove leading slash
            else:
                relative_path = ui.path
                
            output_path = os.path.join(self.extraction_dir, relative_path)
            
            # Create directory if needed
            output_dir = os.path.dirname(output_path)
            os.makedirs(output_dir, exist_ok=True)
            
            # Extract file content
            status, content = self.chm_file.RetrieveObject(ui)
            if status == chm.CHM_RESOLVE_SUCCESS:
                try:
                    with open(output_path, 'wb') as f:
                        f.write(content)
                    logger.debug(f"Extracted: {relative_path}")
                except Exception as e:
                    logger.warning(f"Failed to extract {relative_path}: {e}")
            
            return chm.CHM_ENUMERATOR_CONTINUE
        
        # Enumerate and extract all files
        self.chm_file.EnumerateFiles(callback, None)
    
    def find_hhc_file(self) -> str:
        """Find the HHC file in the extracted directory."""
        logger.info("Searching for HHC file...")
        
        for root, _, files in os.walk(self.extraction_dir):
            for file in files:
                if file.lower().endswith('.hhc'):
                    hhc_path = os.path.join(root, file)
                    logger.info(f"HHC file found: {hhc_path}")
                    return hhc_path
        
        logger.error("HHC file not found in the extracted directory")
        return None

class HTMLOrganizer:
    """Organizes HTML files based on HHC content."""
    
    def __init__(self, hhc_path: str):
        self.hhc_path = hhc_path
        self.extraction_dir = "extractedCHM"
        self.reorganized_dir = "reorganized"
    
    def organize(self) -> bool:
        """Organize HTML files based on HHC order."""
        logger.info("Organizing HTML files...")
        
        try:
            # Remove existing reorganized directory
            if os.path.exists(self.reorganized_dir):
                shutil.rmtree(self.reorganized_dir)
            os.makedirs(self.reorganized_dir, exist_ok=True)
            
            # Parse HHC content
            html_files_ordered = self._parse_hhc_file()
            
            # Copy files in order
            self._copy_files_in_order(html_files_ordered)
            
            # Copy non-HTML assets concurrently
            self._copy_assets()
            
            logger.info("HTML organization completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to organize HTML files: {e}")
            return False
    
    def _parse_hhc_file(self) -> List[str]:
        """Parse HHC file to get ordered list of HTML files."""
        with open(self.hhc_path, 'r', encoding='utf-8', errors='ignore') as f:
            hhc_content = f.read()
        
        soup = BeautifulSoup(hhc_content, 'html.parser')
        
        # Find all <param> tags with name="Local"
        html_files = []
        for param in soup.find_all('param', {'name': lambda x: x and x.lower() == 'local'}):
            if 'value' in param.attrs:
                filename = param['value'].split('#')[0]  # Remove fragment identifiers
                html_files.append(filename)
        
        return html_files
    
    def _copy_files_in_order(self, html_files: List[str]):
        """Copy HTML files in the specified order with numeric prefixes."""
        last_copied = None
        index = 1
        
        for filename in html_files:
            src_path = os.path.join(self.extraction_dir, filename)
            base_filename = os.path.basename(filename)
            
            if os.path.exists(src_path) and base_filename != last_copied:
                # Add numeric prefix
                new_filename = f"{index:04d}_{base_filename}"
                dst_path = os.path.join(self.reorganized_dir, new_filename)
                
                shutil.copy2(src_path, dst_path)
                logger.debug(f"Copied: {src_path} → {dst_path}")
                
                last_copied = base_filename
                index += 1
    
    def _copy_assets(self):
        """Copy non-HTML assets to reorganized directory."""
        logger.info("Copying assets...")
        
        def copy_file(src_dst_pair):
            src_path, dst_path = src_dst_pair
            try:
                os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                shutil.copy2(src_path, dst_path)
                return f"Copied: {src_path}"
            except Exception as e:
                return f"Error copying {src_path}: {e}"
        
        # Collect all non-HTML files
        asset_pairs = []
        for root, dirs, files in os.walk(self.extraction_dir):
            for file in files:
                if not file.lower().endswith(('.htm', '.html', '.hhc', '.hhk')):
                    src_path = os.path.join(root, file)
                    rel_path = os.path.relpath(root, self.extraction_dir)
                    
                    if rel_path == '.':
                        dst_path = os.path.join(self.reorganized_dir, file)
                    else:
                        dst_path = os.path.join(self.reorganized_dir, rel_path, file)
                    
                    asset_pairs.append((src_path, dst_path))
        
        # Copy assets in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = executor.map(copy_file, asset_pairs)
            for result in results:
                logger.debug(result)

class HTMLProcessor:
    """Processes HTML files to prepare them for PDF conversion."""
    
    def __init__(self, html_dir: str):
        self.html_dir = html_dir
    
    def process_all(self, max_workers: int = 4) -> bool:
        """Process all HTML files in parallel."""
        logger.info("Processing HTML files...")
        
        try:
            # Get all HTML files
            html_files = self._get_html_files()
            
            # Copy assets to flat structure first
            self._copy_assets_to_flat_structure()
            
            # Process HTML files in parallel
            with ProcessPoolExecutor(max_workers=max_workers) as executor:
                results = executor.map(self._process_single_file, html_files)
                
            # Check results
            for result in results:
                if not result:
                    logger.warning("Some HTML files failed to process")
            
            logger.info("HTML processing completed")
            return True
            
        except Exception as e:
            logger.error(f"Failed to process HTML files: {e}")
            return False
    
    def _get_html_files(self) -> List[str]:
        """Get sorted list of HTML files."""
        html_files = []
        for file in os.listdir(self.html_dir):
            if file.lower().endswith(('.htm', '.html')):
                html_files.append(os.path.join(self.html_dir, file))
        
        # Sort by numeric prefix
        import re
        html_files.sort(key=lambda x: int(re.search(r'(\d+)_', os.path.basename(x)).group(1)))
        return html_files
    
    def _process_single_file(self, file_path: str) -> bool:
        """Process a single HTML file."""
        try:
            # Detect encoding
            with open(file_path, 'rb') as f:
                raw_data = f.read()
                encoding = chardet.detect(raw_data)['encoding']
            
            # Read and process content
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.read()
            
            # Clean content
            content = content.replace('ï¿½', ' ')
            content = content.replace('\xa0', ' ')
            content = content.replace('xe2', ' ')
            
            # Parse with BeautifulSoup
            soup = BeautifulSoup(content, 'html.parser')
            
            # Fix asset paths
            self._fix_asset_paths(soup)
            
            # Remove problematic scripts
            for script in soup.find_all('script', string=lambda x: x and 'show framing' in x):
                script.decompose()
            
            # Write back
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(str(soup))
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            return False
    
    def _fix_asset_paths(self, soup):
        """Fix asset paths to use simple filenames."""
        # Fix image sources
        for img in soup.find_all('img'):
            if 'src' in img.attrs:
                img['src'] = os.path.basename(img['src'])
        
        # Fix CSS links
        for link in soup.find_all('link', rel="stylesheet"):
            if 'href' in link.attrs:
                link['href'] = os.path.basename(link['href'])
        
        # Fix script sources
        for script in soup.find_all('script'):
            if 'src' in script.attrs:
                script['src'] = os.path.basename(script['src'])
    
    def _copy_assets_to_flat_structure(self):
        """Copy assets to flat structure for easy access."""
        for root, _, files in os.walk(self.html_dir):
            for file in files:
                if not file.lower().endswith(('.htm', '.html', '.hhc', '.hhk')):
                    src_path = os.path.join(root, file)
                    if root != self.html_dir:  # Only copy from subdirectories
                        dst_path = os.path.join(self.html_dir, file)
                        if not os.path.exists(dst_path):
                            try:
                                shutil.copy2(src_path, dst_path)
                            except Exception as e:
                                logger.warning(f"Error copying asset {src_path}: {e}")

class CloudPDFConverter:
    """Cloud-native PDF converter using WeasyPrint."""
    
    def __init__(self, html_dir: str, output_dir: str):
        self.html_dir = html_dir
        self.output_dir = output_dir
        self.pdf_dir = "pdfs"
    
    def convert_all(self, max_workers: int = 4) -> bool:
        """Convert all HTML files to PDF in parallel."""
        logger.info("Converting HTML files to PDF...")
        
        try:
            # Create PDF directory
            if os.path.exists(self.pdf_dir):
                shutil.rmtree(self.pdf_dir)
            os.makedirs(self.pdf_dir, exist_ok=True)
            
            # Get HTML files
            html_files = self._get_html_files()
            
            # Convert in parallel
            with ProcessPoolExecutor(max_workers=max_workers) as executor:
                pdf_files = list(executor.map(self._convert_single_file, html_files))
            
            # Filter successful conversions
            successful_pdfs = [pdf for pdf in pdf_files if pdf]
            
            if not successful_pdfs:
                logger.error("No PDFs were successfully created")
                return False
            
            logger.info(f"Successfully converted {len(successful_pdfs)} HTML files to PDF")
            return True
            
        except Exception as e:
            logger.error(f"Failed to convert HTML files to PDF: {e}")
            return False
    
    def _get_html_files(self) -> List[str]:
        """Get sorted list of HTML files."""
        html_files = []
        for file in os.listdir(self.html_dir):
            if file.lower().endswith(('.htm', '.html')):
                html_files.append(os.path.join(self.html_dir, file))
        
        # Sort by numeric prefix
        import re
        html_files.sort(key=lambda x: int(re.search(r'(\d+)_', os.path.basename(x)).group(1)))
        return html_files
    
    def _convert_single_file(self, html_file: str) -> str:
        """Convert a single HTML file to PDF using WeasyPrint."""
        try:
            base_name = os.path.splitext(os.path.basename(html_file))[0]
            pdf_path = os.path.join(self.pdf_dir, f"{base_name}.pdf")
            
            # Convert using WeasyPrint
            html_doc = HTML(filename=html_file)
            html_doc.write_pdf(pdf_path)
            
            logger.debug(f"Converted: {html_file} → {pdf_path}")
            return pdf_path
            
        except Exception as e:
            logger.error(f"Failed to convert {html_file}: {e}")
            return None
    
    def combine_pdfs(self, chm_name: str) -> bool:
        """Combine all PDFs into a single file."""
        logger.info("Combining PDFs...")
        
        try:
            # Get all PDF files
            pdf_files = []
            for file in os.listdir(self.pdf_dir):
                if file.endswith('.pdf'):
                    pdf_files.append(os.path.join(self.pdf_dir, file))
            
            if not pdf_files:
                logger.error("No PDF files found to combine")
                return False
            
            # Sort by numeric prefix
            import re
            pdf_files.sort(key=lambda x: int(re.search(r'(\d+)_', os.path.basename(x)).group(1)))
            
            # Combine PDFs
            merger = PdfMerger()
            for pdf_file in pdf_files:
                try:
                    merger.append(pdf_file)
                except Exception as e:
                    logger.warning(f"Failed to add {pdf_file} to merger: {e}")
            
            # Write combined PDF
            output_filename = f"{chm_name}.pdf"
            output_path = os.path.join(self.output_dir, output_filename)
            
            os.makedirs(self.output_dir, exist_ok=True)
            merger.write(output_path)
            merger.close()
            
            logger.info(f"Combined PDF saved: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to combine PDFs: {e}")
            return False

def main():
    """Main function to execute the cloud-native workflow."""
    args = parse_arguments()
    
    # Validate CHM file
    chm_file_path = os.path.abspath(args.chm_file)
    if not os.path.exists(chm_file_path):
        logger.error(f"CHM file not found: {chm_file_path}")
        sys.exit(1)
    
    chm_name = os.path.splitext(os.path.basename(chm_file_path))[0]
    output_dir = os.path.abspath(args.output_dir)
    
    logger.info(f"Starting cloud-native CHM to PDF conversion for: {chm_file_path}")
    logger.info(f"Output directory: {output_dir}")
    logger.info(f"Max workers: {args.max_workers}")
    
    # Step 1: Extract CHM
    extractor = CloudCHMExtractor(chm_file_path)
    if not extractor.extract():
        sys.exit(1)
    
    # Step 2: Find HHC file
    hhc_path = extractor.find_hhc_file()
    if not hhc_path:
        sys.exit(1)
    
    # Step 3: Organize HTML files
    organizer = HTMLOrganizer(hhc_path)
    if not organizer.organize():
        sys.exit(1)
    
    # Step 4: Process HTML files
    processor = HTMLProcessor("reorganized")
    if not processor.process_all(args.max_workers):
        sys.exit(1)
    
    # Step 5: Convert to PDF
    converter = CloudPDFConverter("reorganized", output_dir)
    if not converter.convert_all(args.max_workers):
        sys.exit(1)
    
    # Step 6: Combine PDFs
    if not converter.combine_pdfs(chm_name):
        sys.exit(1)
    
    logger.info("Cloud-native CHM to PDF conversion completed successfully!")
    logger.info(f"Output PDF: {os.path.join(output_dir, chm_name + '.pdf')}")

if __name__ == "__main__":
    main()
