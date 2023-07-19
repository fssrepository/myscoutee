package com.raxim.myscoutee.profile.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.raxim.myscoutee.algo.BCTree;
import com.raxim.myscoutee.algo.BCTreeIterator;
import com.raxim.myscoutee.algo.CTree;
import com.raxim.myscoutee.algo.dto.CGroup;
import com.raxim.myscoutee.algo.dto.DGraph;
import com.raxim.myscoutee.algo.dto.Edge;
import com.raxim.myscoutee.algo.dto.Node;
import com.raxim.myscoutee.algo.dto.Range;
import com.raxim.myscoutee.profile.data.document.mongo.Event;
import com.raxim.myscoutee.profile.data.document.mongo.Like;
import com.raxim.myscoutee.profile.data.document.mongo.LikeGroup;
import com.raxim.myscoutee.profile.data.document.mongo.Member;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.Rule;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.LikeRepository;
import com.raxim.myscoutee.profile.service.iface.IEventGeneratorService;
import com.raxim.myscoutee.profile.util.AppConstants;
import com.raxim.myscoutee.profile.util.EventUtil;

@Service
public class EventGeneratorService implements IEventGeneratorService {
    private final EventRepository eventRepository;
    private final LikeRepository likeRepository;

    public EventGeneratorService(EventRepository eventRepository, LikeRepository likeRepository) {
        this.eventRepository = eventRepository;
        this.likeRepository = likeRepository;
    }

    @Override
    public List<Event> generate() {
        List<LikeGroup> likeGroups = likeRepository.findLikeGroups();

        // merge likes
        List<Like> likesBoth = likeGroups.stream().map(group -> {
            return group.reduce();
        }).filter(like -> like != null).toList();

        // nodes
        Map<String, Profile> nodes = new HashMap<>();
        likesBoth.forEach(likeBoth -> {
            nodes.put(likeBoth.getFrom().getId().toString(), likeBoth.getFrom());
            nodes.put(likeBoth.getTo().getId().toString(), likeBoth.getTo());
        });

        // edges
        List<Edge> edges = likesBoth.stream().map(likeBoth -> {
            Node fromNode = new Node(likeBoth.getFrom().getId().toString(), likeBoth.getFrom().getGender());
            Node toNode = new Node(likeBoth.getTo().getId().toString(), likeBoth.getTo().getGender());
            double weight = (double) likeBoth.getRate();
            return new Edge(fromNode, toNode, weight);
        }).toList();

        // ignoring edges, where the profile is not with status 'A' or F
        Set<Edge> ignoredEdgesByStatus = likesBoth.stream()
                .filter(ignoredLike -> !Profile.ACTIVE.contains(ignoredLike.getFrom().getStatus())
                        || !Profile.ACTIVE.contains(ignoredLike.getTo().getStatus()))
                .map(likeBoth -> {
                    Node fromNode = new Node(likeBoth.getFrom().getId().toString(), likeBoth.getFrom().getGender());
                    Node toNode = new Node(likeBoth.getTo().getId().toString(), likeBoth.getTo().getGender());
                    double weight = (double) (likeBoth.getRate() * likeBoth.getDistance());
                    return new Edge(fromNode, toNode, weight);
                }).collect(Collectors.toSet());

        List<Event> events = this.eventRepository.findEvents();

        List<Event> handledEvents = events.stream().map(event -> {
            event.syncStatus();

            int maxStage = event.getMaxStage();
            if (maxStage > 0 && "A".equals(event.getStatus())) {
                List<Event> dueNextStageEvents = event.getDueNextStageEvents();
                if (!dueNextStageEvents.isEmpty()) {
                    int nextStage = event.getStage() + 1;
                    event.setStage(nextStage);
                }

                int maxCapacity = dueNextStageEvents.stream().mapToInt(item -> item.getCapacity().getMax()).sum();

                List<Event> currStageEvents = event.getItems().stream()
                        .filter(item -> "A".equals(item.getStatus()) && item.getStage() == event.getStage()).toList();

                int firstXWinner = (int) Math.ceil((double) maxCapacity / currStageEvents.size());
                if (event.getRule() != null) {

                    List<Member> winners = currStageEvents.stream().flatMap(cItem -> {
                        Double rateMin = cItem.getRule() != null ? cItem.getRule().getRate() : 0d;

                        List<Member> cMembers = new ArrayList<>();
                        if (Boolean.TRUE.equals(cItem.getRule().getMutual())) {
                            Rule rule = cItem.getRule();

                            Set<Edge> tIgnoredEdges = EventUtil.permutate(cItem.getMembers());

                            List<Edge> tIgnoredEdgesByRate = edges.stream()
                                    .filter(edge -> rule.getRate() != null &&
                                            edge.getWeight() >= rule.getRate())
                                    .toList();
                            tIgnoredEdges.addAll(tIgnoredEdgesByRate);
                            List<Set<Edge>> ignoredEdges = List.of(tIgnoredEdges, ignoredEdgesByStatus);

                            Set<Edge> possibleEdges = EventUtil.permutate(cItem.getMembers());

                            List<Edge> validEdges = edges.stream()
                                    .filter(edge -> possibleEdges.contains(edge))
                                    .toList();

                            DGraph dGraph = new DGraph();
                            dGraph.addAll(validEdges);

                            Set<Node> activeNodes = cItem.getMembers().stream()
                                    .filter(member -> "A".equals(member.getStatus()))
                                    .map(member -> {
                                        Profile profile = nodes.get(member.getProfile().getId().toString());
                                        return new Node(profile.getId().toString(), profile.getGender());
                                    })
                                    .collect(Collectors.toSet());

                            Range range = new Range(firstXWinner,
                                    cItem.getCapacity().getMax() - activeNodes.size());

                            List<String> types;
                            if (Boolean.TRUE.equals(event.getRule().getBalanced())) {
                                types = List.of(AppConstants.MAN, AppConstants.WOMAN);
                            } else {
                                types = List.of();
                            }

                            List<BCTree> bcTrees = dGraph.stream().map(cGraph -> {
                                CTree cTree = new CTree(cGraph, types, ignoredEdges);
                                return new BCTree(cTree, range, activeNodes);
                            }).toList();

                            Iterator<BCTree> itBCTree = bcTrees.iterator();
                            if (itBCTree.hasNext()) {
                                BCTree bcTree = itBCTree.next();
                                BCTreeIterator itCGroup = (BCTreeIterator) bcTree.iterator();
                                if (itCGroup.hasAnyNext()) {
                                    CGroup cGroup = itCGroup.next();
                                    Set<Member> newMembers = cGroup.stream()
                                            .map(node -> new Member(nodes.get(node.getId()), "P", "U"))
                                            .collect(Collectors.toSet());
                                    cMembers = new ArrayList<>(newMembers);
                                }
                            }
                        } else {
                            cMembers = cItem.getMembers().stream()
                                    .filter(member -> "A".equals(member.getStatus())
                                            && "U".equals(member.getRole())
                                            && (!cItem.isPriority() || member.getScore() >= rateMin))
                                    .sorted(Comparator.comparing(Member::getScore)
                                            .thenComparing(Member::getCreatedDate))
                                    .limit(firstXWinner).toList();
                        }

                        return cMembers.stream();
                    }).toList();

                    event.assignToSlots(winners);
                }
            }
            return event;
        }).toList();

        List<Event> eventsToSave = handledEvents.stream().flatMap(event -> event.flatten().stream()).toList();

        List<Event> savedEvents = this.eventRepository.saveAll(eventsToSave);
        return savedEvents;
    }

}
