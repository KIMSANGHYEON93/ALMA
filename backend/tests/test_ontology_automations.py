import asyncio

import pytest

from alma.domain.ontology.action_planner import ActionPlanner


def test_action_planner_no_llm():
    """Without LLM, should return default plan."""

    class FakeInsight:
        insight_type = "isolated"
        title = "Node X is isolated"
        description = "No connections"
        evidence = {}

    class FakeAutomation:
        action_type = "suggest"
        config = {}

    planner = ActionPlanner(llm_router=None)
    result = asyncio.run(planner.plan(FakeInsight(), FakeAutomation()))
    assert result is not None
    assert result["action"] == "suggest"
    assert "params" in result


def test_ontology_automation_model_importable():
    from alma.models.models import OntologyAutomation, OntologyAutomationLog

    assert OntologyAutomation.__tablename__ == "ontology_automations"
    assert OntologyAutomationLog.__tablename__ == "ontology_automation_logs"
