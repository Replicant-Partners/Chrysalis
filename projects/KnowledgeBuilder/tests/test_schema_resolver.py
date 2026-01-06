"""Tests for Schema.org-based ground truth resolver."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

import pytest

from src.ground_truth.schema_resolver import (
    SchemaResolver,
    SchemaType,
    ResolvedEntity,
    SCHEMA_DEFINITIONS,
)


class TestSchemaType:
    """Tests for SchemaType enum."""

    def test_schema_type_values(self):
        """Verify Schema.org type URIs are correct."""
        assert SchemaType.PERSON.value == "schema:Person"
        assert SchemaType.ORGANIZATION.value == "schema:Organization"
        assert SchemaType.PLACE.value == "schema:Place"
        assert SchemaType.PRODUCT.value == "schema:Product"
        assert SchemaType.CREATIVE_WORK.value == "schema:CreativeWork"
        assert SchemaType.EVENT.value == "schema:Event"
        assert SchemaType.THING.value == "schema:Thing"

    def test_all_types_have_definitions(self):
        """Every SchemaType should have a definition."""
        for schema_type in SchemaType:
            assert schema_type in SCHEMA_DEFINITIONS


class TestSchemaDefinitions:
    """Tests for schema definitions."""

    def test_person_schema_has_required_attrs(self):
        """Person schema should have name and description as mandatory."""
        person_schema = SCHEMA_DEFINITIONS[SchemaType.PERSON]
        assert "name" in person_schema.mandatory_attrs
        assert "description" in person_schema.mandatory_attrs

    def test_person_schema_has_optional_attrs(self):
        """Person schema should have common optional attributes."""
        person_schema = SCHEMA_DEFINITIONS[SchemaType.PERSON]
        assert "birthDate" in person_schema.optional_attrs
        assert "occupation" in person_schema.optional_attrs
        assert "affiliation" in person_schema.optional_attrs

    def test_organization_schema_has_search_hints(self):
        """Organization schema should have search hints."""
        org_schema = SCHEMA_DEFINITIONS[SchemaType.ORGANIZATION]
        assert len(org_schema.search_hints) > 0
        assert "company" in org_schema.search_hints


class TestSchemaResolver:
    """Tests for SchemaResolver class."""

    @pytest.fixture
    def resolver(self, tmp_path):
        """Create a resolver with temporary cache."""
        cache_path = str(tmp_path / "schema_cache.db")
        return SchemaResolver(cache_path=cache_path)

    def test_resolve_person_with_type_hint(self, resolver):
        """Resolve with explicit Person type hint."""
        entity = resolver.resolve("Satya Nadella", type_hint="Person")
        
        assert entity.schema_type == SchemaType.PERSON
        assert entity.confidence >= 0.90  # High confidence with explicit hint
        assert entity.name == "Satya Nadella"
        assert "name" in entity.mandatory_attrs
        assert "birthDate" in entity.optional_attrs

    def test_resolve_organization_with_type_hint(self, resolver):
        """Resolve with explicit Organization type hint."""
        entity = resolver.resolve("Microsoft", type_hint="Organization")
        
        assert entity.schema_type == SchemaType.ORGANIZATION
        assert entity.confidence >= 0.90
        assert "foundingDate" in entity.optional_attrs

    def test_resolve_infers_person_from_keywords(self, resolver):
        """Infer Person type from context keywords."""
        entity = resolver.resolve("John Smith", context="CEO and founder of TechCorp")
        
        assert entity.schema_type == SchemaType.PERSON
        assert entity.confidence >= 0.5

    def test_resolve_infers_organization_from_keywords(self, resolver):
        """Infer Organization type from context keywords."""
        entity = resolver.resolve("TechCorp", context="A software company founded in 2020")
        
        assert entity.schema_type == SchemaType.ORGANIZATION
        assert entity.confidence >= 0.5

    def test_resolve_defaults_to_thing(self, resolver):
        """Unknown entities default to Thing type."""
        entity = resolver.resolve("XYZ123ABC", type_hint=None, context=None)
        
        assert entity.schema_type == SchemaType.THING
        assert entity.confidence < 0.5  # Low confidence for default

    def test_resolve_caches_result(self, resolver):
        """Resolved entities should be cached."""
        # First resolution
        entity1 = resolver.resolve("Test Entity", type_hint="Person")
        
        # Second resolution should hit cache
        entity2 = resolver.resolve("Test Entity")
        
        assert entity1.schema_type == entity2.schema_type
        assert entity1.confidence == entity2.confidence
        assert entity2.cached_at is not None

    def test_build_search_query(self, resolver):
        """Search query should include entity name and hints."""
        entity = resolver.resolve("Albert Einstein", type_hint="Person")
        query = resolver.build_search_query(entity)
        
        assert "Albert Einstein" in query
        # Should include some search hints
        assert len(query) > len("Albert Einstein")

    def test_resolved_entity_to_dict(self, resolver):
        """ResolvedEntity should serialize to dict."""
        entity = resolver.resolve("Test", type_hint="Person")
        data = entity.to_dict()
        
        assert data["name"] == "Test"
        assert data["schema_type"] == "schema:Person"
        assert "mandatory_attrs" in data
        assert "optional_attrs" in data

    def test_resolved_entity_from_dict(self, resolver):
        """ResolvedEntity should deserialize from dict."""
        entity = resolver.resolve("Test", type_hint="Person")
        data = entity.to_dict()
        
        restored = ResolvedEntity.from_dict(data)
        
        assert restored.name == entity.name
        assert restored.schema_type == entity.schema_type
        assert restored.confidence == entity.confidence


class TestTypeInference:
    """Tests for type inference logic."""

    @pytest.fixture
    def resolver(self, tmp_path):
        cache_path = str(tmp_path / "schema_cache.db")
        return SchemaResolver(cache_path=cache_path)

    @pytest.mark.parametrize("hint,expected_type", [
        ("person", SchemaType.PERSON),
        ("Person", SchemaType.PERSON),
        ("PERSON", SchemaType.PERSON),
        ("ceo", SchemaType.PERSON),
        ("founder", SchemaType.PERSON),
        ("company", SchemaType.ORGANIZATION),
        ("corporation", SchemaType.ORGANIZATION),
        ("startup", SchemaType.ORGANIZATION),
        ("city", SchemaType.PLACE),
        ("country", SchemaType.PLACE),
        ("product", SchemaType.PRODUCT),
        ("software", SchemaType.PRODUCT),
        ("book", SchemaType.CREATIVE_WORK),
        ("film", SchemaType.CREATIVE_WORK),
        ("conference", SchemaType.EVENT),
        ("summit", SchemaType.EVENT),
    ])
    def test_type_hint_aliases(self, resolver, hint, expected_type):
        """Various type hints should map to correct Schema.org types."""
        entity = resolver.resolve("Test Entity", type_hint=hint)
        assert entity.schema_type == expected_type

    @pytest.mark.parametrize("context,expected_type", [
        ("A famous scientist and researcher", SchemaType.PERSON),
        ("A multinational corporation", SchemaType.ORGANIZATION),
        ("A beautiful city in Europe", SchemaType.PLACE),
        ("A new software application", SchemaType.PRODUCT),
        ("A bestselling novel", SchemaType.CREATIVE_WORK),
        ("An annual technology conference", SchemaType.EVENT),
    ])
    def test_context_inference(self, resolver, context, expected_type):
        """Context should influence type inference."""
        entity = resolver.resolve("Unknown Entity", context=context)
        assert entity.schema_type == expected_type
