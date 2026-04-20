"""Document file parsers — PDF and DOCX text extraction"""

import io
import logging

logger = logging.getLogger(__name__)


def extract_pdf_text(file_bytes: bytes) -> str:
    """PDF 파일에서 텍스트 추출 (pymupdf)"""
    import fitz  # pymupdf

    text_parts = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts).strip()


def extract_docx_text(file_bytes: bytes) -> str:
    """DOCX 파일에서 텍스트 추출 (python-docx)"""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    text_parts = []
    for para in doc.paragraphs:
        if para.text.strip():
            text_parts.append(para.text)
    return "\n".join(text_parts).strip()


def extract_text(filename: str, file_bytes: bytes) -> str:
    """파일 확장자에 따라 적절한 파서 선택"""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_pdf_text(file_bytes)
    elif lower.endswith(".docx"):
        return extract_docx_text(file_bytes)
    elif lower.endswith(".txt") or lower.endswith(".md") or lower.endswith(".markdown"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"Unsupported file type: {filename}")
