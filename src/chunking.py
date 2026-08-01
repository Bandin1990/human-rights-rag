from __future__ import annotations

import re
from hashlib import sha1
from typing import Iterable

from .models import DocumentMetadata, PageText, TextChunk
from pythainlp.tokenize import word_tokenize


PARAGRAPH_SPLIT_RE = re.compile(r"\n\s*\n+")


def split_pages_into_chunks(
    pages: Iterable[PageText],
    document_metadata: DocumentMetadata,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> list[TextChunk]:
    if chunk_size <= 0:
        raise ValueError("chunk_size ต้องมากกว่า 0")
    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap ต้องอยู่ระหว่าง 0 และน้อยกว่า chunk_size")

    chunks: list[TextChunk] = []
    for page in pages:
        page_text = page.text.strip()
        if not page_text:
            continue
        page_chunks = _chunk_single_page(page_text, chunk_size, chunk_overlap)
        for order, text in enumerate(page_chunks, start=1):
            chunk_id = _chunk_id(document_metadata.document_id, page.page_number, order, text)
            metadata = document_metadata.to_dict() | {
                "page_number": page.page_number,
                "chunk_order": order,
            }
            chunks.append(
                TextChunk(
                    chunk_id=chunk_id,
                    document_id=document_metadata.document_id,
                    text=text,
                    metadata=metadata,
                )
            )
    return chunks


def _chunk_single_page(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    paragraphs = [p.strip() for p in PARAGRAPH_SPLIT_RE.split(text) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > chunk_size:
            if current:
                chunks.append(current.strip())
                current = ""
            chunks.extend(_split_long_text(paragraph, chunk_size, chunk_overlap))
            continue

        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            chunks.append(current.strip())
            overlap = _tail_overlap(current, chunk_overlap)
            current = f"{overlap}\n\n{paragraph}".strip() if overlap else paragraph

    if current:
        chunks.append(current.strip())
    return chunks


def _split_long_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    words = word_tokenize(text)
    chunks: list[str] = []
    current_words: list[str] = []
    current_length = 0
    
    i = 0
    while i < len(words):
        word = words[i]
        if len(word) > chunk_size and not current_words:
            chunks.append(word.strip())
            i += 1
            continue
            
        if current_length + len(word) <= chunk_size:
            current_words.append(word)
            current_length += len(word)
            i += 1
        else:
            if current_words:
                chunks.append("".join(current_words).strip())
            
            overlap_length = 0
            overlap_words: list[str] = []
            for w in reversed(current_words):
                if overlap_length + len(w) <= chunk_overlap:
                    overlap_words.insert(0, w)
                    overlap_length += len(w)
                else:
                    break
                    
            if not overlap_words and current_words:
                overlap_words = [current_words[-1]]
                overlap_length = len(current_words[-1])
                
            current_words = overlap_words
            current_length = overlap_length
            
    if current_words:
        chunk_str = "".join(current_words).strip()
        if chunk_str:
            chunks.append(chunk_str)
            
    return chunks


def _tail_overlap(text: str, overlap: int) -> str:
    if overlap <= 0:
        return ""
    words = word_tokenize(text)
    tail_words: list[str] = []
    tail_len = 0
    for w in reversed(words):
        if tail_len + len(w) <= overlap:
            tail_words.insert(0, w)
            tail_len += len(w)
        else:
            break
            
    if not tail_words and words:
        # Fallback to character overlap if word is too long
        return text[-overlap:].strip()
        
    return "".join(tail_words).strip()


def _chunk_id(document_id: str, page_number: int, order: int, text: str) -> str:
    digest = sha1(text.encode("utf-8")).hexdigest()[:12]
    return f"{document_id}:p{page_number}:c{order}:{digest}"
