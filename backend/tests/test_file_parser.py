from alma.domain.knowledge.parser import extract_text


def test_extract_txt():
    text = extract_text("test.txt", b"Hello World\nLine 2")
    assert "Hello World" in text
    assert "Line 2" in text


def test_extract_unsupported():
    import pytest

    with pytest.raises(ValueError, match="Unsupported"):
        extract_text("test.xlsx", b"data")


def test_extract_text_function():
    """txt 파일 UTF-8 디코딩"""
    korean = "한국어 테스트 문서입니다.".encode("utf-8")
    text = extract_text("doc.txt", korean)
    assert "한국어" in text
