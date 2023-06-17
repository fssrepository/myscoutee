package com.raxim.myscoutee.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.raxim.myscoutee.algo.dto.Bound;
import com.raxim.myscoutee.common.util.JsonUtil;
import com.raxim.myscoutee.profile.data.document.mongo.Like;
import com.raxim.myscoutee.profile.data.document.mongo.LikeForGroup;
import com.raxim.myscoutee.profile.data.document.mongo.LikeGroup;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.Schedule;
import com.raxim.myscoutee.profile.repository.mongo.LikeRepository;
import com.raxim.myscoutee.profile.repository.mongo.ScheduleRepository;
import com.raxim.myscoutee.profile.service.EventGeneratorService;

@ExtendWith(MockitoExtension.class)
public class EventGeneratorServiceTest {

        private static final Bound FLAGS_DEFAULT = new Bound(2, 3);

        private static final UUID UUID_PROFILE_LIAM = UUID.fromString("8f4bd3a8-1195-01b0-172a-a04f052f5982");
        private static final UUID UUID_PROFILE_EMMA = UUID.fromString("fc4c72f8-a905-e1d1-05f8-c0d9914e158c");

        private static final UUID UUID_PROFILE_OLIVER = UUID.fromString("534ccc6b-2547-4bf0-ad91-dca739943ea4");
        private static final UUID UUID_PROFILE_AVA = UUID.fromString("eb494fba-6c56-752f-5123-c414c8c86599");

        private static final UUID UUID_PROFILE_ETHAN = UUID.fromString("2f7e01ce-1336-37d4-e69e-efc88d2ee81a");
        private static final UUID UUID_PROFILE_SOPHIA = UUID.fromString("39402632-a452-57be-2518-53cc117b1abc");

        @InjectMocks
        private EventGeneratorService eventGeneratorService;

        @Mock
        private ScheduleRepository scheduleRepository;

        @Mock
        private LikeRepository likeRepository;

        @Test
        public void testShouldGetBalancedGroup() throws IOException {
                LikeForGroup[] likeArray = JsonUtil.loadJson(this, "algo/likes.json", LikeForGroup[].class);

                List<LikeGroup> likesBoth = Arrays.asList(likeArray)
                                .stream().collect(Collectors.groupingBy(Like::getCnt))
                                .entrySet().stream()
                                .map(entry -> new LikeGroup(entry.getKey(), entry.getValue()))
                                .collect(Collectors.toList());

                when(scheduleRepository.findByKey(EventGeneratorService.SCHEDULE_RANDOM_GROUP))
                                .thenReturn(Optional.of(new Schedule(0L, 1000L)));
                when(likeRepository.findAll(0L, 1000L))
                                .thenReturn(likesBoth);

                List<Set<Profile>> profilesByGroup = eventGeneratorService.generate(FLAGS_DEFAULT);

                assertEquals(3, profilesByGroup.size());

                // group1
                Set<Profile> group1 = profilesByGroup.get(0);
                assertEquals(2, group1.size());

                List<UUID> expectedUuidsForGroup1 = List.of(UUID_PROFILE_LIAM, UUID_PROFILE_EMMA);
                assertTrue(expectedUuidsForGroup1.stream().allMatch(
                                id -> group1.stream().anyMatch(
                                                group -> group.getId().equals(id))));

                // group1
                Set<Profile> group2 = profilesByGroup.get(1);
                assertEquals(2, group2.size());

                List<UUID> expectedUuidsForGroup2 = List.of(UUID_PROFILE_ETHAN, UUID_PROFILE_AVA);
                assertTrue(expectedUuidsForGroup2.stream().allMatch(
                                id -> group2.stream().anyMatch(
                                                group -> group.getId().equals(id))));

                Set<Profile> group3 = profilesByGroup.get(2);
                assertEquals(2, group3.size());

                List<UUID> expectedUuidsForGroup3 = List.of(UUID_PROFILE_SOPHIA, UUID_PROFILE_OLIVER);
                assertTrue(expectedUuidsForGroup3.stream().allMatch(
                                id -> group3.stream().anyMatch(
                                                group -> group.getId().equals(id))));

        }
}
