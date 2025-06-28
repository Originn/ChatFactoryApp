# DEBUG/UTILITY SCRIPT: This script processes HTML files to prepare them for PDF conversion
# It removes specific scripts, fixes image paths, and copies assets to a flat structure

import os
from bs4 import BeautifulSoup
import re
import chardet
import shutil

# Use relative path for compatibility with both Windows and Linux
html_directory_path = 'reorganized'

def copy_assets_to_flat_structure():
    """Copy all assets to a flat structure for easy access."""
    print("Copying assets to a flat structure...")
    
    # Find all non-HTML files in subdirectories
    for root, _, files in os.walk(html_directory_path):
        for file in files:
            if not file.lower().endswith(('.htm', '.html', '.hhc', '.hhk')):
                src_path = os.path.join(root, file)
                # Only copy files from subdirectories
                if root != html_directory_path:
                    dst_path = os.path.join(html_directory_path, file)
                    # Only copy if file doesn't already exist in destination
                    if not os.path.exists(dst_path):
                        try:
                            shutil.copy2(src_path, dst_path)
                            print(f"Copied {src_path} to {dst_path}")
                        except Exception as e:
                            print(f"Error copying {src_path}: {e}")
    
    print("Finished copying assets.")

def fix_image_paths(soup):
    """Fix paths in HTML to use simple filenames without paths."""
    # Process all image tags
    for img in soup.find_all('img'):
        if 'src' in img.attrs:
            # Extract just the filename from any path
            img['src'] = os.path.basename(img['src'])
    
    # Process all CSS references
    for link in soup.find_all('link', rel="stylesheet"):
        if 'href' in link.attrs:
            # Extract just the filename
            link['href'] = os.path.basename(link['href'])
    
    # Process all script references
    for script in soup.find_all('script'):
        if 'src' in script.attrs:
            # Extract just the filename
            script['src'] = os.path.basename(script['src'])
            
    return soup

def remove_show_framing(file_path, text_to_remove):
    """Process HTML file to prepare for PDF conversion."""
    # Detect file encoding
    with open(file_path, 'rb') as file:
        raw_data = file.read()
        encoding_result = chardet.detect(raw_data)
        encoding = encoding_result['encoding']
        
    # Read with detected encoding
    with open(file_path, 'r', encoding=encoding) as file:
        html_content = file.read()

    # Other replacements
    html_content = html_content.replace('ï¿½', ' ')
    html_content = html_content.replace(u'\xa0', ' ')
    html_content = html_content.replace('xe2', ' ')

    soup = BeautifulSoup(html_content, 'html.parser')

    # Fix image paths
    soup = fix_image_paths(soup)

    # Remove show framing script
    script_tag = soup.find('script', string=lambda x: x and text_to_remove in x)
    if script_tag:
        script_tag.decompose()

    # Write with UTF-8 encoding
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(str(soup))

# First, copy all assets to a flat structure
copy_assets_to_flat_structure()

# Get all HTM files
htm_files = [os.path.join(html_directory_path, f) for f in os.listdir(html_directory_path) if f.endswith('.htm') or f.endswith('.html')]

# Sort files based on the numbers prefixed in the filenames
htm_files_sorted = sorted(htm_files, key=lambda x: int(re.search(r'(\d+)_', os.path.basename(x)).group(1)))

for file_path in htm_files_sorted:
    remove_show_framing(file_path, 'show framing')
