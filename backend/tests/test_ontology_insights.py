from alma.domain.ontology.analyzer import GraphAnalyzer
from alma.domain.ontology.models import GraphData


def _make_graph(n_nodes=5, edges=None):
    nodes = [
        {"id": str(i), "name": f"Node{i}", "type_id": "type1", "properties": {}}
        for i in range(n_nodes)
    ]
    if edges is None:
        edges = [
            {
                "id": f"e{i}",
                "source": str(i),
                "target": str((i + 1) % n_nodes),
                "type_id": "link1",
                "properties": {},
            }
            for i in range(n_nodes)
        ]
    return GraphData(nodes=nodes, edges=edges)


def test_hub_nodes():
    gd = _make_graph(5)
    analyzer = GraphAnalyzer(gd)
    hubs = analyzer.hub_nodes(top_n=3)
    assert len(hubs) > 0
    assert all("node_id" in h for h in hubs)


def test_isolated_nodes():
    gd = GraphData(
        nodes=[
            {"id": "1", "name": "A", "type_id": "t", "properties": {}},
            {"id": "2", "name": "B", "type_id": "t", "properties": {}},
            {"id": "3", "name": "Lonely", "type_id": "t", "properties": {}},
        ],
        edges=[
            {"id": "e1", "source": "1", "target": "2", "type_id": "l", "properties": {}},
        ],
    )
    analyzer = GraphAnalyzer(gd)
    isolated = analyzer.isolated_nodes()
    names = [n["name"] for n in isolated]
    assert "Lonely" in names


def test_empty_graph():
    gd = GraphData(nodes=[], edges=[])
    analyzer = GraphAnalyzer(gd)
    result = analyzer.full_analysis()
    assert result["hub_nodes"] == []
    assert result["isolated_nodes"] == []
    assert result["trends"]["total_nodes"] == 0


def test_conflicts_detection():
    gd = GraphData(
        nodes=[
            {"id": "1", "name": "A", "type_id": "t", "properties": {}},
            {"id": "2", "name": "B", "type_id": "t", "properties": {}},
        ],
        edges=[
            {
                "id": "e1",
                "source": "1",
                "target": "2",
                "type_id": "contradicts",
                "properties": {},
                "relation": "contradicts",
            },
        ],
    )
    analyzer = GraphAnalyzer(gd)
    conflicts = analyzer.conflicts()
    assert len(conflicts) == 1


def test_full_analysis_structure():
    gd = _make_graph(10)
    analyzer = GraphAnalyzer(gd)
    result = analyzer.full_analysis()
    assert "hub_nodes" in result
    assert "isolated_nodes" in result
    assert "strong_paths" in result
    assert "conflicts" in result
    assert "opportunities" in result
    assert "trends" in result
