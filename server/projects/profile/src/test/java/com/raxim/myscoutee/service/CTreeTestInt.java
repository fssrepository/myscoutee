package com.raxim.myscoutee.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raxim.myscoutee.algo.AbstractAlgoTest;
import com.raxim.myscoutee.algo.AlgoLoadException;
import com.raxim.myscoutee.algo.dto.Edge;
import com.raxim.myscoutee.common.config.JsonConfig;
import com.raxim.myscoutee.data.mongo.TestEventItem;
import com.raxim.myscoutee.profile.data.document.mongo.EventItem;
import com.raxim.myscoutee.profile.util.EventItemUtil;
import com.raxim.myscoutee.util.TestJsonUtil;

@ExtendWith({ SpringExtension.class })
@ContextConfiguration(classes = JsonConfig.class)
public class CTreeTestInt extends AbstractAlgoTest {
    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void shouldFilteredGroup() throws IOException, AlgoLoadException {
        objectMapper.addMixIn(EventItem.class, TestEventItem.class);

        EventItem[] eventItemArray = TestJsonUtil.loadJson(this, "algo/eventItems.json",
                EventItem[].class,
                objectMapper);
        List<EventItem> eventItems = Arrays.asList(eventItemArray);

        List<Set<Edge>> ignoredEdges = eventItems.stream().map(eventItem -> EventItemUtil.permutate(eventItem))
                .toList();
        System.out.println(ignoredEdges);

        List<Edge> edges = getEdges("algo/graph6P.json");
        List<List<String>> ids = List.of(
                List.of("5", "6"),
                List.of("6", "8"),
                List.of("6", "7"),
                List.of("3", "8e460978-b1ac-a551-d01f-70abb291cb98"),
                List.of("8e460978-b1ac-a551-d01f-70abb291cb98", "2b418324-7733-97ed-6730-bd1e3d589aa8"),
                List.of("3", "2"));
        boolean allEdgesMatched = matchAll(edges, ids);
        assertTrue(allEdgesMatched);

        List<Edge> edgesWithIgnored = getEdges("algo/graph6P.json", ignoredEdges);
        List<List<String>> idsWithIgnored = List.of(
                List.of("5", "6"),
                List.of("6", "8"),
                List.of("6", "7"),
                List.of("3", "8e460978-b1ac-a551-d01f-70abb291cb98"),
                List.of("3", "2b418324-7733-97ed-6730-bd1e3d589aa8"),
                List.of("3", "2"));
        boolean allEdgesWithIgnoredMatched = matchAll(edgesWithIgnored, idsWithIgnored);
        assertTrue(allEdgesWithIgnoredMatched);

    }
}
