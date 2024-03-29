package com.raxim.myscoutee.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.Spy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raxim.myscoutee.algo.AbstractAlgoTest;
import com.raxim.myscoutee.algo.dto.Range;
import com.raxim.myscoutee.common.AppTestConstants;
import com.raxim.myscoutee.common.config.JsonConfig;
import com.raxim.myscoutee.common.data.TestLike;
import com.raxim.myscoutee.common.data.TestProfile;
import com.raxim.myscoutee.profile.data.document.mongo.Event;
import com.raxim.myscoutee.profile.data.document.mongo.Like;
import com.raxim.myscoutee.profile.data.document.mongo.LikeGroup;
import com.raxim.myscoutee.profile.data.document.mongo.Member;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.LikeRepository;
import com.raxim.myscoutee.profile.repository.mongo.ScheduleRepository;
import com.raxim.myscoutee.profile.service.EventGeneratorRandomService;

@DirtiesContext
@ExtendWith({ SpringExtension.class })
@ContextConfiguration(classes = JsonConfig.class)
public class EventGeneratorRandomServiceTest extends AbstractAlgoTest {

        private static final Range FLAGS_DEFAULT = new Range(2, 3);

        @InjectMocks
        private EventGeneratorRandomService eventGeneratorRandomService;

        @Mock
        private ScheduleRepository scheduleRepository;

        @Spy
        private LikeRepository likeRepository;

        @Mock
        private EventRepository eventRepository;

        @Autowired
        @Spy
        private ObjectMapper objectMapper;

        @Captor
        private ArgumentCaptor<List<Event>> captorEvents;

        @Test
        public void testShouldGetBalancedGroup() throws IOException {
                // json property override
                objectMapper.addMixIn(Profile.class, TestProfile.class);
                objectMapper.addMixIn(Like.class, TestLike.class);

                String flags = jsonToString(FLAGS_DEFAULT, objectMapper);

                Like[] likeArray = loadJson(this, "algo/likes.json",
                                Like[].class, objectMapper);

                List<LikeGroup> likesBoth = Arrays.asList(likeArray)
                                .stream().collect(Collectors.groupingBy(Like::getCnt))
                                .entrySet().stream()
                                .map(entry -> new LikeGroup(entry.getKey(), entry.getValue()))
                                .collect(Collectors.toList());

                when(likeRepository.findLikeGroups())
                                .thenReturn(likesBoth);

                eventGeneratorRandomService.generate(flags);

                Mockito.verify(eventRepository).saveAll(captorEvents.capture());
                List<Event> generatedEvents = captorEvents.getValue();

                assertEquals(3, generatedEvents.size());

                // group1
                Set<Member> group1 = generatedEvents.get(0).getMembers();
                assertEquals(2, group1.size());

                List<UUID> expectedUuidsForGroup1 = List.of(AppTestConstants.UUID_PROFILE_LUCAS,
                                AppTestConstants.UUID_PROFILE_SOPHIA);
                boolean allProfilesMatched = matchAll(group1, expectedUuidsForGroup1);
                assertTrue(allProfilesMatched);

                Set<Member> group2 = generatedEvents.get(1).getMembers();
                assertEquals(2, group2.size());

                List<UUID> expectedUuidsForGroup2 = List.of(AppTestConstants.UUID_PROFILE_AVA,
                                AppTestConstants.UUID_PROFILE_OLIVER);
                allProfilesMatched = matchAll(group2, expectedUuidsForGroup2);
                assertTrue(allProfilesMatched);

                // group3
                Set<Member> group3 = generatedEvents.get(2).getMembers();
                assertEquals(2, group3.size());

                List<UUID> expectedUuidsForGroup3 = List.of(AppTestConstants.UUID_PROFILE_LIAM,
                                AppTestConstants.UUID_PROFILE_EMMA);
                allProfilesMatched = matchAll(group3, expectedUuidsForGroup3);
                assertTrue(allProfilesMatched);
        }

        @Test
        public void testShouldGetBalancedGroupWithIgnored() throws IOException {

                // json property override
                objectMapper.addMixIn(Profile.class, TestProfile.class);
                objectMapper.addMixIn(Like.class, TestLike.class);

                String flags = jsonToString(FLAGS_DEFAULT, objectMapper);

                Like[] likeArray = loadJson(this, "algo/likesWithIgnored.json",
                                Like[].class, objectMapper);

                List<LikeGroup> likesBoth = Arrays.asList(likeArray)
                                .stream().collect(Collectors.groupingBy(Like::getCnt))
                                .entrySet().stream()
                                .map(entry -> new LikeGroup(entry.getKey(), entry.getValue()))
                                .collect(Collectors.toList());

                when(likeRepository.findLikeGroups())
                                .thenReturn(likesBoth);

                eventGeneratorRandomService.generate(flags);

                Mockito.verify(eventRepository).saveAll(captorEvents.capture());
                List<Event> generatedEvents = captorEvents.getValue();

                assertEquals(2, generatedEvents.size());

                // group1
                Set<Member> group1F = generatedEvents.get(0).getMembers();
                assertEquals(2, group1F.size());

                List<UUID> expectedUuidsForGroup1F = List.of(AppTestConstants.UUID_PROFILE_LUCAS,
                                AppTestConstants.UUID_PROFILE_SOPHIA);
                boolean allProfilesMatched = matchAll(group1F, expectedUuidsForGroup1F);
                assertTrue(allProfilesMatched);

                Set<Member> group2F = generatedEvents.get(1).getMembers();
                assertEquals(2, group2F.size());

                List<UUID> expectedUuidsForGroup2F = List.of(AppTestConstants.UUID_PROFILE_LIAM,
                                AppTestConstants.UUID_PROFILE_EMMA);
                allProfilesMatched = matchAll(group2F, expectedUuidsForGroup2F);
                assertTrue(allProfilesMatched);
        }
}
