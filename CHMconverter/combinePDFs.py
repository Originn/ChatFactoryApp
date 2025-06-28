# DEBUG/UTILITY SCRIPT: This script combines multiple PDF files into a single PDF
# It sorts files by numeric prefix and merges them in order

import os
from PyPDF2 import PdfMerger
import re

pdfs_directory_path = 'pdfs'
pdf_files = [os.path.join(pdfs_directory_path, f) for f in os.listdir(pdfs_directory_path) if f.endswith('.pdf')]

# Sort files based on the numeric prefixes in the filenames
def extract_number(filename):
    # Try to extract number from pattern like '0001_filename.pdf'
    match = re.search(r'(\d+)_', os.path.basename(filename))
    if match:
        return int(match.group(1))
    
    # Try to extract number from beginning of filename
    match = re.search(r'^(\d+)', os.path.basename(filename))
    if match:
        return int(match.group(1))
    
    # If no numeric prefix, return a large number to place at the end
    return 999999

pdf_files_sorted = sorted(pdf_files, key=extract_number)

merger = PdfMerger()

for pdf in pdf_files_sorted:
    merger.append(pdf)

# Get the parent directory (project root)
pdfs_dir_path = './'
output_filename = os.environ.get('PDF_FILENAME', 'combined.pdf')
output_path = os.path.join(pdfs_dir_path, output_filename)
merger.write(output_path)
merger.close()

print(f'All PDF files have been merged into {output_path}.')
