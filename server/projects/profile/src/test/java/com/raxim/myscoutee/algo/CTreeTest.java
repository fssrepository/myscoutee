package com.raxim.myscoutee.algo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.raxim.myscoutee.algo.dto.CGraph;
import com.raxim.myscoutee.algo.dto.CGroup;
import com.raxim.myscoutee.algo.dto.DGraph;
import com.raxim.myscoutee.algo.dto.Edge;
import com.raxim.myscoutee.algo.dto.Graph;
import com.raxim.myscoutee.algo.dto.Node;
import com.raxim.myscoutee.algo.dto.Range;
import com.raxim.myscoutee.algo.generator.EdgeGenerator;
import com.raxim.myscoutee.algo.generator.IGenerator;
import com.raxim.myscoutee.algo.generator.NodeGenerator;
import com.raxim.myscoutee.profile.util.AppConstants;

public class CTreeTest extends AbstractAlgoTest {

    private final static int NODE_NUM = 100;
    private final static int EDGE_NUM = 100;

    @Test
    public void shouldBalancedGroup() throws AlgoLoadException {
        Graph graph = load("algo/graph3.json");

        DGraph dGraph1 = new DGraph();
        dGraph1.addAll(graph.getEdges());

        assertEquals(2, dGraph1.size());

        Iterator<CGraph> itDGraph = dGraph1.iterator();
        CGraph cGraph1 = itDGraph.next();

        CTree cTree1 = new CTree(cGraph1, List.of(AppConstants.MAN, AppConstants.WOMAN));
        BCTree bcTree = new BCTree(cTree1, new Range(2, 6));
        Iterator<CGroup> nodeIterator = bcTree.iterator();

        nodeIterator.hasNext();
        CGroup cGroup = nodeIterator.next();
        assertEquals(4, cGroup.size());

    }

    @Test
    public void shouldGroup() throws AlgoLoadException {
        Graph graph = load("algo/graph.json");

        DGraph dGraph1 = new DGraph();
        dGraph1.addAll(graph.getEdges());

        assertEquals(2, dGraph1.size());

        Iterator<CGraph> itDGraph = dGraph1.iterator();
        CGraph cGraph1 = itDGraph.next();

        CTree cTree1 = new CTree(cGraph1);
        BCTree bcTree = new BCTree(cTree1, new Range(2, 2));
        Iterator<CGroup> nodeIterator = bcTree.iterator();

        nodeIterator.hasNext();
        CGroup cGroup = nodeIterator.next();
        assertEquals(2, cGroup.size());

        Set<String> ids = Set.of("3", "4");

        boolean hasMatch = cGroup.stream().allMatch(cNode -> ids.contains(cNode.getId()));
        assertTrue(hasMatch);
    }

    @Test
    public void shouldGetMaxFlowWithDisabledEdge() throws AlgoLoadException {
        List<Edge> edges = getEdges("algo/graph5.json");
        List<Edge> edgesC = getEdges("algo/graph5C.json");
        List<Edge> edgesD = getEdges("algo/graph5D.json");

        List<List<String>> ids = List.of(List.of("3", "4"), List.of("4", "1"), List.of("3", "2"));
        boolean allEdgesMatched = matchAll(edges, ids);
        assertTrue(allEdgesMatched);

        List<List<String>> idsC = List.of(List.of("1", "3"), List.of("3", "2"), List.of("2", "4"));
        boolean allEdgesCMatched = matchAll(edgesC, idsC);
        assertTrue(allEdgesCMatched);

        List<List<String>> idsD = List.of(List.of("1", "3"), List.of("3", "2"), List.of("4", "5"));
        boolean allEdgesDMatched = matchAll(edgesD, idsD);
        assertTrue(allEdgesDMatched);
    }

    private boolean matchAll(List<Edge> edges, List<List<String>> ids) {
        boolean allEdgesMatched = IntStream.range(0, Math.min(edges.size(), ids.size()))
                .allMatch(i -> ids.get(i).get(0).equals(edges.get(i).getFrom().getId())
                        && ids.get(i).get(1).equals(edges.get(i).getTo().getId()));
        return allEdgesMatched;
    }

    private List<Edge> getEdges(String fileName) throws AlgoLoadException {
        Graph graph = load(fileName);

        DGraph dGraph = new DGraph();
        dGraph.addAll(graph.getEdges());

        List<Edge> edges = new ArrayList<>();
        dGraph.stream().map(cGraph -> new CTree(cGraph)).forEach(cTree -> {
            cTree.forEach(edge -> {
                edges.add(edge);
            });
        });
        return edges;
    }

    @Test
    public void shouldGetMaxFlow() throws AlgoLoadException {
        Graph graph = load("algo/graph.json");

        DGraph dGraph1 = new DGraph();
        dGraph1.addAll(graph.getEdges());

        assertEquals(2, dGraph1.size());

        Iterator<CGraph> itDGraph = dGraph1.iterator();
        CGraph cGraph1 = itDGraph.next();

        CTree cTree1 = new CTree(cGraph1);
        Iterator<Edge> itEdge1 = cTree1.iterator();

        assertTrue(itEdge1.hasNext());
        Edge edge1 = itEdge1.next();
        assertEquals(50, edge1.getWeight());

        assertTrue(itEdge1.hasNext());
        Edge edge2 = itEdge1.next();
        assertEquals(30, edge2.getWeight());

        assertTrue(itEdge1.hasNext());
        Edge edge3 = itEdge1.next();
        assertEquals(20, edge3.getWeight());
    }

    @Test
    public void shouldUniqueEdges() throws AlgoLoadException {
        Graph graph = load("algo/graph4.json");

        DGraph dGraph = new DGraph();
        dGraph.addAll(graph.getEdges());

        assertEquals(1, dGraph.size());

        Iterator<CGraph> itDGraph = dGraph.iterator();
        CGraph cGraph = itDGraph.next();

        CTree cTree = new CTree(cGraph, List.of(AppConstants.MAN, AppConstants.WOMAN));

        cTree.forEach(edge -> {
            System.out.println(edge);
        });
    }

    @Test
    void shouldGenIterate() {
        DGraph dGraph = new DGraph();

        IGenerator<Node> nodeGenerator = new NodeGenerator();
        Set<Node> nodes = nodeGenerator.generate(NODE_NUM);

        IGenerator<Edge> edgeGenerator = new EdgeGenerator(nodes);
        Set<Edge> edges = edgeGenerator.generate(EDGE_NUM);

        System.out.println(edges);

        dGraph.addAll(new ArrayList<>(edges));

        dGraph.forEach(cGraph -> {
            System.out.println("---- partition -----");
            CTree cTree = new CTree(cGraph, List.of(AppConstants.MAN, AppConstants.WOMAN));
            cTree.forEach(edge -> {
                System.out.println(edge);
            });
        });
    }

    @Test
    void shouldBGenIterate() {
        DGraph dGraph = new DGraph();

        IGenerator<Node> nodeGenerator = new NodeGenerator();
        Set<Node> nodes = nodeGenerator.generate(NODE_NUM);

        IGenerator<Edge> edgeGenerator = new EdgeGenerator(nodes);
        Set<Edge> edges = edgeGenerator.generate(EDGE_NUM);
        dGraph.addAll(new ArrayList<>(edges));

        dGraph.forEach(cGraph -> {
            System.out.println("---- partition -----");
            CTree cTree = new CTree(cGraph, List.of(AppConstants.MAN, AppConstants.WOMAN));
            BCTree lcTree = new BCTree(cTree, new Range(2, 6));
            lcTree.forEach(group -> {
                System.out.println(group);
                assertTrue(group.size() >= 2 && group.size() <= 6);
                Map<String, List<Node>> nodesByType = group.stream().collect(Collectors.groupingBy(Node::getType));
                assertEquals(nodesByType.get(AppConstants.MAN).size(), nodesByType.get(AppConstants.WOMAN).size());
            });
        });
    }
}
