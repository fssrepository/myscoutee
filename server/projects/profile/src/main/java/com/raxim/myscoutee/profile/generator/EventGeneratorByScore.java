package com.raxim.myscoutee.profile.generator;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.raxim.myscoutee.algo.Algo;
import com.raxim.myscoutee.algo.Fifa;
import com.raxim.myscoutee.algo.dto.FGraph;
import com.raxim.myscoutee.algo.dto.Node;
import com.raxim.myscoutee.algo.dto.Range;
import com.raxim.myscoutee.profile.data.document.mongo.Event;
import com.raxim.myscoutee.profile.data.document.mongo.Member;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.Rule;
import com.raxim.myscoutee.profile.data.document.mongo.ScoreMatrix;
import com.raxim.myscoutee.profile.util.AppConstants;

public class EventGeneratorByScore extends GeneratorBase<Event, Profile> {

    private final List<Event> events;
    private final Map<String, List<ScoreMatrix>> scoreMatricesByType;

    public EventGeneratorByScore(List<Event> events, Map<String, List<ScoreMatrix>> scoreMatricesByType,
            FGraph fGraph, Map<String, Profile> profiles) {
        super(fGraph, profiles);
        this.events = events;
        this.scoreMatricesByType = scoreMatricesByType;
    }

    @Override
    public List<Event> generate(Object flags) {
        List<Event> handledEvents = events.stream().map(event -> {
            event.syncStatus();

            int maxStage = event.getMaxStage();
            if (maxStage > 0 && "A".equals(event.getStatus())) {

                List<Event> nextStageEvents;
                List<Event> currStageEvents;

                if (event.isStageFinished()) {
                    currStageEvents = event.getItemsByStage(event.getStageIdx());
                    int nextStage = event.getStageIdx() + 1;
                    event.setStageIdx(nextStage);
                } else {
                    currStageEvents = List.of(event);
                }

                nextStageEvents = event.getItemsByStage(event.getStageIdx());

                Event nextItem = nextStageEvents.get(0);

                int maxCapacity = nextStageEvents.stream().mapToInt(item -> item.getCapacity().getMax()).sum();

                int firstXWinner = (int) Math.ceil((double) maxCapacity / currStageEvents.size());
                if (nextItem.getRule() != null) {
                    Rule nextRule = nextItem.getRule();

                    List<Member> winners = currStageEvents.stream().flatMap(cItem -> {
                        // nextEvent.cItem.getRule
                        List<Member> cMembers = new ArrayList<>();
                        if (Boolean.TRUE.equals(nextItem.getRule().getMutual())) {

                            nextItem.setCandidates(cItem.getMembers());
                            nextItem.setCapacity(Range.of(firstXWinner, firstXWinner));

                            FGraph fGraph = getGraph().filter(nextItem);

                            Algo algo = new Algo();
                            List<Set<Node>> candidates = algo.run(fGraph,
                                    nextItem.getTypes(),
                                    nextItem.getCapacity(), true);

                            // hasAnyMember
                            cMembers = candidates.get(0).stream()
                                    .map(node -> new Member(getProfileById(node.getId()), "P", "U"))
                                    .collect(Collectors.toList());

                        } else {
                            Stream<Member> sMembers = cItem.getMembers().stream()
                                    .filter(member -> "A".equals(member.getStatus())
                                            && "U".equals(member.getRole()));

                            List<ScoreMatrix> scoreMatrices = scoreMatricesByType
                                    .get(nextRule.getRankType());
                            if (AppConstants.RANK_FIFA.equals(nextRule.getRankType())) {
                                Fifa fifa = new Fifa(new ArrayList<>(event.getMatches()), scoreMatrices);
                                cMembers = fifa.getFirstXMembers(firstXWinner, sMembers);
                            } else {
                                cMembers = sMembers.sorted().limit(firstXWinner).toList();
                            }
                        }

                        return cMembers.stream();
                    }).toList();

                    event.assignToSlots(winners);
                }
            }
            return event;
        }).toList();

        List<Event> respEvents = handledEvents.stream().flatMap(event -> event.flatten().stream()).toList();
        return respEvents;
    }

}
