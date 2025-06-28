# CHM to PDF Converter

This directory contains a complete pipeline to convert CHM (Compiled HTML Help) files to PDF format.

## Prerequisites

1. **Python Dependencies**: Install required packages
   ```bash
   pip install -r requirements.txt
   ```

2. **External Tools**:
   - **archmage**: For CHM extraction
     ```bash
     pip install archmage
     ```
   - **wkhtmltopdf**: For HTML to PDF conversion
     - Windows: Download from https://wkhtmltopdf.org/downloads.html
     - Linux: `sudo apt-get install wkhtmltopdf`
     - macOS: `brew install wkhtmltopdf`

## Usage

```bash
python automation.py path/to/your/file.chm [--output-dir OUTPUT_DIR]
```

### Example:
```bash
python automation.py "C:\path\to\help.chm" --output-dir "C:\output"
```

## Pipeline Steps

The conversion process follows these steps:

1. **Extract CHM**: Uses archmage to extract CHM contents
2. **Find HHC**: Locates the HTML Help Contents file
3. **Generate orderHTM.py**: Creates script to organize HTML files based on TOC
4. **Reorganize Files**: Runs orderHTM.py to order files numerically
5. **Copy Assets**: Copies non-HTML files (images, CSS, etc.)
6. **Clean Text**: Runs removeText.py to prepare HTML for PDF conversion
7. **Convert to PDFs**: Uses wkhtmltopdf to convert each HTML to PDF
8. **Combine PDFs**: Merges all PDFs into a single document

## Output

The final PDF will be named after the original CHM file and saved in the specified output directory.

## Files in this directory

- `automation.py`: Main script that orchestrates the entire process
- `removeText.py`: Cleans HTML files and fixes asset paths
- `convert_to_pdf.bat/.sh`: Converts HTML files to PDF (Windows/Unix)
- `combinePDFs.py`: Merges individual PDFs into one file
- `requirements.txt`: Python dependencies

## Troubleshooting

- Ensure all prerequisites are installed
- Check that wkhtmltopdf is in your system PATH
- For Windows, the script expects wkhtmltopdf at: `C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe`
- For Unix systems, use the .sh version of the conversion script
