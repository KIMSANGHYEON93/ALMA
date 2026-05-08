import os
import tempfile


from alma.domain.ontology.importer import ImportProcessor, compute_file_hash


def test_compute_file_hash():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("# Test\nHello World")
        f.flush()
        h = compute_file_hash(f.name)
        assert len(h) == 64  # SHA256 hex
        # Same content = same hash
        h2 = compute_file_hash(f.name)
        assert h == h2
    os.unlink(f.name)


def test_compute_file_hash_changes():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("Version 1")
        f.flush()
        h1 = compute_file_hash(f.name)
    with open(f.name, "w") as f2:
        f2.write("Version 2")
    h2 = compute_file_hash(f.name)
    assert h1 != h2
    os.unlink(f.name)


def test_extract_headings_fallback():
    processor = ImportProcessor(
        ontology_service=None, pipeline=None, import_repo=None, extractor=None,
    )
    content = "# Title\n## Section 1\nSome text\n## Section 2\nMore text\n### Sub"
    extraction = processor._extract_headings(content, "test.md")
    assert len(extraction.node_candidates) == 4
    assert extraction.node_candidates[0].name == "Title"
    assert extraction.node_candidates[0].parent_category == "Concept"
    assert extraction.node_candidates[0].sub_type == "Topic"


def test_extract_headings_empty():
    processor = ImportProcessor(
        ontology_service=None, pipeline=None, import_repo=None, extractor=None,
    )
    extraction = processor._extract_headings("Just plain text", "test.md")
    assert len(extraction.node_candidates) == 0


def test_import_source_model_importable():
    from alma.models.models import ImportSource
    assert ImportSource.__tablename__ == "ontology_import_sources"
