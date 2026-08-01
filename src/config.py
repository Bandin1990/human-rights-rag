from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class AppConfig:
    documents_dir: Path = PROJECT_ROOT / "data" / "documents"
    chroma_dir: Path = PROJECT_ROOT / "data" / "chroma"
    metadata_path: Path = PROJECT_ROOT / "data" / "document_index.json"
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "1000"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "150"))
    embedding_model_name: str = os.getenv(
        "EMBEDDING_MODEL_NAME",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    )
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model_name: str = os.getenv("OLLAMA_MODEL_NAME", "qwen2.5:7b")
    chroma_collection_name: str = os.getenv(
        "CHROMA_COLLECTION_NAME", "thai_human_rights_documents"
    )

    def ensure_dirs(self) -> None:
        self.documents_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)


def get_config() -> AppConfig:
    config = AppConfig()
    config.ensure_dirs()
    return config
