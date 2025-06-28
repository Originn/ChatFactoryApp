#!/bin/bash
# DEBUG/UTILITY SCRIPT: This shell script converts HTML files to PDF using wkhtmltopdf

# Use environment variable for source directory if set, otherwise use default
if [ -n "$SOURCE_DIR" ]; then
    echo "Using SOURCE_DIR from environment: $SOURCE_DIR"
else
    export SOURCE_DIR="./reorganized"
    echo "Using default SOURCE_DIR: $SOURCE_DIR"
fi

PDF_DIR="./pdfs"

# Create PDF directory if it doesn't exist
mkdir -p "$PDF_DIR"

# Check if wkhtmltopdf is installed
if ! command -v wkhtmltopdf &> /dev/null; then
    echo "wkhtmltopdf not found. Please install wkhtmltopdf."
    exit 1
fi

# Process all HTM files
for file in "$SOURCE_DIR"/*.htm; do
    if [ -f "$file" ]; then
        filename=$(basename -- "$file")
        name="${filename%.*}"
        echo "Converting $filename to PDF..."
        wkhtmltopdf --debug-javascript --enable-local-file-access --load-error-handling ignore --load-media-error-handling ignore "$file" "$PDF_DIR/$name.pdf"
    fi
done

echo "Conversion complete."
