from src.ocr import get_ocr_status


def test_ocr_status_returns_actionable_message():
    status = get_ocr_status()

    assert isinstance(status.available, bool)
    assert status.message
