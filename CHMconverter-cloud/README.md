# Cloud-Native CHM to PDF Converter

This version uses Python libraries instead of external executables for cloud deployment compatibility.

## Key Changes from Original
- **PyCHM** replaces `archmage` for CHM extraction
- **WeasyPrint** replaces `wkhtmltopdf` for HTML→PDF conversion
- Cloud storage ready (can easily switch to Google Cloud Storage)
- No subprocess calls to external tools

## Dependencies
```bash
pip install -r requirements.txt
```

## Local Testing
```bash
python automation_cloud.py path/to/your/file.chm [--output-dir OUTPUT_DIR]
```

## Cloud Deployment Notes
- Ready for Google Cloud Functions/Cloud Run
- Can easily integrate with Google Cloud Storage
- No external tool dependencies
- All processing in Python
