import networkx as nx

from alma.domain.ontology.models import GraphData


class GraphAnalyzer:
    def __init__(self, graph_data: GraphData):
        self.G = nx.DiGraph()
        for node in graph_data.nodes:
            self.G.add_node(node["id"], **node)
        for edge in graph_data.edges:
            self.G.add_edge(edge["source"], edge["target"], **edge)

    def hub_nodes(self, top_n: int = 5) -> list[dict]:
        if self.G.number_of_nodes() == 0:
            return []
        centrality = nx.degree_centrality(self.G)
        sorted_nodes = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [
            {
                "node_id": nid,
                "name": self.G.nodes[nid].get("name", ""),
                "centrality": round(score, 3),
                "degree": self.G.degree(nid),
            }
            for nid, score in sorted_nodes
            if score > 0
        ]

    def isolated_nodes(self) -> list[dict]:
        return [
            {"node_id": nid, "name": self.G.nodes[nid].get("name", "")}
            for nid in self.G.nodes
            if self.G.degree(nid) <= 1
        ]

    def strong_paths(self, top_n: int = 5) -> list[dict]:
        if self.G.number_of_nodes() < 3:
            return []
        # Only check top nodes by degree to avoid O(n^2)
        top_nodes = sorted(
            self.G.nodes, key=lambda n: self.G.degree(n), reverse=True
        )[:20]
        paths = []
        for source in top_nodes:
            for target in top_nodes:
                if source == target:
                    continue
                try:
                    path = nx.shortest_path(self.G, source, target)
                    if len(path) >= 3:
                        paths.append(
                            {
                                "path": [
                                    self.G.nodes[n].get("name", "") for n in path
                                ],
                                "node_ids": path,
                                "length": len(path) - 1,
                            }
                        )
                except nx.NetworkXNoPath:
                    continue
        return paths[:top_n]

    def conflicts(self) -> list[dict]:
        return [
            {
                "source": self.G.nodes[u].get("name", ""),
                "target": self.G.nodes[v].get("name", ""),
                "source_id": u,
                "target_id": v,
            }
            for u, v, data in self.G.edges(data=True)
            if data.get("relation") == "contradicts"
        ]

    def opportunities(self, max_suggestions: int = 5) -> list[dict]:
        suggestions: list[dict] = []
        nodes_by_prop: dict[str, list] = {}
        for nid, data in self.G.nodes(data=True):
            key = str(data.get("type_id", ""))
            nodes_by_prop.setdefault(key, []).append(nid)

        for _key, node_ids in nodes_by_prop.items():
            if len(node_ids) < 2:
                continue
            for i, n1 in enumerate(node_ids):
                for n2 in node_ids[i + 1 :]:
                    if not self.G.has_edge(n1, n2) and not self.G.has_edge(n2, n1):
                        suggestions.append(
                            {
                                "node1": self.G.nodes[n1].get("name", ""),
                                "node2": self.G.nodes[n2].get("name", ""),
                                "node1_id": n1,
                                "node2_id": n2,
                            }
                        )
                        if len(suggestions) >= max_suggestions:
                            return suggestions
        return suggestions

    def growth_trends(self) -> dict:
        categories: dict[str, int] = {}
        for _, data in self.G.nodes(data=True):
            tid = str(data.get("type_id", "unknown"))
            categories[tid] = categories.get(tid, 0) + 1
        return {
            "total_nodes": self.G.number_of_nodes(),
            "total_edges": self.G.number_of_edges(),
            "by_type": categories,
            "density": round(nx.density(self.G), 4)
            if self.G.number_of_nodes() > 1
            else 0,
        }

    def full_analysis(self) -> dict:
        return {
            "hub_nodes": self.hub_nodes(),
            "isolated_nodes": self.isolated_nodes(),
            "strong_paths": self.strong_paths(),
            "conflicts": self.conflicts(),
            "opportunities": self.opportunities(),
            "trends": self.growth_trends(),
        }
