#!/usr/bin/env python3
"""
CHM to PDF Workflow Automation

This script automates the entire workflow to convert a CHM file to PDF:
1. Extracts the CHM file using archmage
2. Locates the HHC file and creates orderHTM.py
3. Runs orderHTM.py to organize HTML files
4. Copies non-HTML files to the reorganized directory
5. Proceeds to the HTM-to-PDF conversion steps

Usage:
    python automation.py /path/to/your/file.chm [--output-dir OUTPUT_DIR]
"""

import os
import sys
import shutil
import subprocess
import glob
import argparse
import logging
from bs4 import BeautifulSoup
import PyPDF2

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Convert CHM file to PDF')
    parser.add_argument('chm_file', help='Path to the CHM file to convert')
    parser.add_argument('--output-dir', help='Output directory for the final PDF', default='.')
    return parser.parse_args()

def extract_chm(chm_file_path):
    """Extract CHM file using archmage."""
    logger.info(f"Extracting CHM file: {chm_file_path}")
    
    # Remove existing extractedCHM directory if it exists
    if os.path.exists('extractedCHM'):
        logger.info("Removing existing extractedCHM directory")
        shutil.rmtree('extractedCHM')
    
    # Extract the CHM file
    cmd = ['archmage', '-x', chm_file_path, 'extractedCHM']
    try:
        subprocess.run(cmd, check=True)
        logger.info("CHM extraction completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to extract CHM file: {e}")
        return False

def find_hhc_file():
    """Find the HHC file in the extractedCHM directory."""
    logger.info("Searching for HHC file...")
    
    for root, _, files in os.walk('extractedCHM'):
        for file in files:
            if file.lower().endswith('.hhc'):
                hhc_path = os.path.join(root, file)
                logger.info(f"HHC file found: {hhc_path}")
                return hhc_path
    
    logger.error("HHC file not found in the extractedCHM directory")
    return None

def create_order_htm_script(hhc_path):
    """Create the orderHTM.py script with the HHC content."""
    logger.info(f"Creating orderHTM.py script with content from: {hhc_path}")
    
    try:
        # Read the HHC file content
        with open(hhc_path, 'r', encoding='utf-8', errors='ignore') as f:
            hhc_content = f.read()
        
        # Create the orderHTM.py script
        script_content = f'''#!/usr/bin/env python3
from bs4 import BeautifulSoup
import os
import shutil

# Example sitemap content (you would load this from your actual sitemap file)
sitemap_content = """
{hhc_content}
"""

# Use BeautifulSoup to parse the sitemap content
soup = BeautifulSoup(sitemap_content, 'html.parser')

# Find all <param> tags with name="Local" case-insensitively and extract their value attributes
html_files_ordered = [param['value'] for param in soup.find_all('param', {{'name': lambda x: x and x.lower() == 'local'}})]

# Sanitize filenames to remove any fragment identifiers
html_files_ordered_sanitized = [filename.split('#')[0] for filename in html_files_ordered]

# ORIGINAL extraction directory 
original_extraction_directory = 'extractedCHM'

# NEW target directory for reorganization
target_directory = 'reorganized'

# Define the desired order
desired_order = html_files_ordered_sanitized 

# Generate full paths for existing files 
html_files_full_paths = [os.path.join(original_extraction_directory, filename) for filename in html_files_ordered_sanitized]
existing_html_files = [path for path in html_files_full_paths if os.path.exists(path)]

# Create the target directory if it doesn't exist
os.makedirs(target_directory, exist_ok=True)

# Copy files to the NEW target directory in the desired order without incrementing the index for duplicates
last_copied_filename = None
index = 1  # Initialize the index

for filename in desired_order:
    current_filename = os.path.join(original_extraction_directory, filename)
    # Get the base name for comparison to avoid copying the same file consecutively
    base_filename = os.path.basename(filename)

    if os.path.exists(current_filename) and base_filename != last_copied_filename:
        # Add the index as a prefix to the filename
        index_prefix = f"{{index:04d}}_"  # Pads the index with zeros, e.g., "0001"
        new_filename = index_prefix + base_filename
        desired_filepath = os.path.join(target_directory, new_filename)
        
        shutil.copyfile(current_filename, desired_filepath)
        print(f"Copied '{{current_filename}}' to '{{desired_filepath}}'")

        # Update the last_copied_filename and increment the index
        last_copied_filename = base_filename
        index += 1  # Increment only after copying a new unique file
    elif base_filename == last_copied_filename:
        print(f"Skipped duplicate file: {{current_filename}}")

print("File copying complete!")
'''
        
        # Write the script to disk
        script_path = 'orderHTM.py'
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(script_content)
        
        # Make the script executable
        os.chmod(script_path, 0o755)
        
        logger.info(f"Successfully created {script_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error creating orderHTM.py script: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def run_order_htm():
    """Run the orderHTM.py script."""
    logger.info("Running orderHTM.py...")
    
    # Remove existing reorganized directory if it exists
    if os.path.exists('reorganized'):
        logger.info("Removing existing reorganized directory")
        shutil.rmtree('reorganized')
    
    # Run the script
    try:
        subprocess.run(['python3', 'orderHTM.py'], check=True)
        logger.info("orderHTM.py executed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to run orderHTM.py: {e}")
        return False

def copy_non_htm_files():
    """Copy non-HTM files from extractedCHM to reorganized folder."""
    logger.info("Copying non-HTM files to reorganized folder...")
    
    try:
        # First, copy all direct files from extractedCHM to reorganized
        for file in os.listdir('extractedCHM'):
            src_path = os.path.join('extractedCHM', file)
            # Skip directories for now, we'll handle them separately
            if os.path.isfile(src_path) and not file.lower().endswith(('.htm', '.html', '.hhc', '.hhk')):
                dst_path = os.path.join('reorganized', file)
                shutil.copy2(src_path, dst_path)
                logger.debug(f"Copied direct file: {src_path} to {dst_path}")
        
        # Now handle files in subdirectories
        for root, dirs, files in os.walk('extractedCHM'):
            for file in files:
                if not file.lower().endswith(('.htm', '.html', '.hhc', '.hhk')):
                    src_path = os.path.join(root, file)
                    
                    # Get the relative path from extractedCHM
                    rel_path = os.path.relpath(root, 'extractedCHM')
                    
                    # Skip if it's a root file (already handled)
                    if rel_path == '.':
                        continue
                        
                    # Create the target directory structure
                    dst_dir = os.path.join('reorganized', rel_path)
                    os.makedirs(dst_dir, exist_ok=True)
                    
                    # Copy the file
                    dst_path = os.path.join(dst_dir, file)
                    shutil.copy2(src_path, dst_path)
                    logger.debug(f"Copied: {src_path} to {dst_path}")
        
        # Also copy subdirectories directly to ensure structure is maintained
        for item in os.listdir('extractedCHM'):
            src_path = os.path.join('extractedCHM', item)
            # Only process directories
            if os.path.isdir(src_path):
                dst_path = os.path.join('reorganized', item)
                if not os.path.exists(dst_path):
                    # Create the directory
                    os.makedirs(dst_path, exist_ok=True)
                    logger.debug(f"Created directory: {dst_path}")
        
        logger.info("Non-HTM files copied successfully")
        return True
    except Exception as e:
        logger.error(f"Error copying non-HTM files: {e}")
        return False

def run_remove_text():
    """Run the removeText.py script."""
    logger.info("Running removeText.py...")
    
    remove_text_path = 'removeText.py'
    if not os.path.exists(remove_text_path):
        logger.error(f"removeText.py not found: {remove_text_path}")
        return False
    
    try:
        # Run the script
        subprocess.run(['python3', 'removeText.py'], check=True)
        logger.info("removeText.py executed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to run removeText.py: {e}")
        return False

def run_convert_to_pdf():
    """Run the convert_to_pdf.bat file."""
    logger.info("Running PDF conversion...")
    
    pdfs_dir = 'pdfs'
    
    # Delete the PDFs folder if it exists
    if os.path.exists(pdfs_dir):
        logger.info(f"Removing existing PDFs directory: {pdfs_dir}")
        shutil.rmtree(pdfs_dir)
    
    # Get absolute path to reorganized directory
    reorganized_dir = os.path.abspath('reorganized')
    
    try:
        # Set environment variable for source directory
        os.environ['SOURCE_DIR'] = reorganized_dir
        logger.info(f"Set SOURCE_DIR environment variable to: {reorganized_dir}")
        
        # Run the appropriate script based on OS
        if os.name == 'nt':  # Windows
            logger.info("Running convert_to_pdf.bat on Windows")
            subprocess.run(['convert_to_pdf.bat'], shell=True, check=True, env=os.environ)
        else:  # Linux/Mac
            # Check if there's a shell version
            if os.path.exists('convert_to_pdf.sh'):
                logger.info("Running convert_to_pdf.sh on Unix")
                subprocess.run(['bash', 'convert_to_pdf.sh'], check=True, env=os.environ)
            else:
                logger.warning("convert_to_pdf.bat cannot be run directly on Unix. Trying with wine...")
                # Try with wine if available
                try:
                    subprocess.run(['wine', 'cmd', '/c', 'convert_to_pdf.bat'], check=True, env=os.environ)
                except (subprocess.SubprocessError, FileNotFoundError):
                    logger.error("Failed to run with wine. Please create a shell script version.")
                    return False
        
        logger.info("PDF conversion completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during PDF conversion: {e}")
        return False

def run_combine_pdfs(output_dir, chm_name):
    """Run the combinePDFs.py script."""
    logger.info("Running combinePDFs.py...")
    
    combine_pdfs_path = 'combinePDFs.py'
    if not os.path.exists(combine_pdfs_path):
        logger.error(f"combinePDFs.py not found: {combine_pdfs_path}")
        return False
    
    try:
        # Set environment variable for the PDF filename
        pdf_filename = f"{chm_name}.pdf"
        os.environ['PDF_FILENAME'] = pdf_filename
        
        # Run the script
        subprocess.run(['python3', 'combinePDFs.py'], check=True, env=os.environ)
        
        # Find the combined PDF
        combined_pdf = pdf_filename
        
        if not os.path.exists(combined_pdf):
            logger.error(f"Combined PDF file not found: {combined_pdf}")
            return False
        
        # Create the output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Copy the combined PDF to the output directory if different
        if output_dir != '.':
            output_pdf = os.path.join(output_dir, pdf_filename)
            shutil.copy2(combined_pdf, output_pdf)
            logger.info(f"Combined PDF copied to: {output_pdf}")
        else:
            logger.info(f"Combined PDF saved: {combined_pdf}")
        
        return True
    except Exception as e:
        logger.error(f"Error combining PDFs: {e}")
        return False

def main():
    """Main function to execute the workflow."""
    args = parse_arguments()
    
    # Validate the CHM file path
    chm_file_path = os.path.abspath(args.chm_file)
    if not os.path.exists(chm_file_path):
        logger.error(f"CHM file not found: {chm_file_path}")
        sys.exit(1)
    
    # Get the CHM file name (without extension) and output directory
    chm_name = os.path.splitext(os.path.basename(chm_file_path))[0]
    output_dir = os.path.abspath(args.output_dir)
    
    logger.info(f"Starting CHM to PDF conversion for: {chm_file_path}")
    logger.info(f"Output directory: {output_dir}")
    
    # Step 1: Extract CHM file
    if not extract_chm(chm_file_path):
        sys.exit(1)
    
    # Step 2: Find HHC file
    hhc_path = find_hhc_file()
    if not hhc_path:
        sys.exit(1)
    
    # Step 3: Create orderHTM.py script
    if not create_order_htm_script(hhc_path):
        sys.exit(1)
    
    # Step 4: Run orderHTM.py
    if not run_order_htm():
        sys.exit(1)
    
    # Step 5: Copy non-HTM files
    if not copy_non_htm_files():
        sys.exit(1)
    
    # Step 6: Run removeText.py
    if not run_remove_text():
        sys.exit(1)
    
    # Step 7: Run convert_to_pdf.bat
    if not run_convert_to_pdf():
        sys.exit(1)
    
    # Step 8: Run combinePDFs.py
    if not run_combine_pdfs(output_dir, chm_name):
        sys.exit(1)
    
    logger.info(f"CHM to PDF conversion completed successfully!")
    logger.info(f"Output PDF: {os.path.join(output_dir, chm_name + '.pdf')}")


if __name__ == "__main__":
    main()
