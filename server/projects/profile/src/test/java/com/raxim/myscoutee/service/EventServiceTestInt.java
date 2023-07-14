package com.raxim.myscoutee.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.TestPropertySource;

import com.raxim.myscoutee.algo.AbstractAlgoTest;
import com.raxim.myscoutee.common.AppTestConstants;
import com.raxim.myscoutee.common.config.JsonConfig;
import com.raxim.myscoutee.common.config.RepositoryConfig;
import com.raxim.myscoutee.common.repository.MongoDataLoaderTestExecutionListener;
import com.raxim.myscoutee.common.repository.TestData;
import com.raxim.myscoutee.profile.converter.Converters;
import com.raxim.myscoutee.profile.data.dto.rest.EventDTO;
import com.raxim.myscoutee.profile.data.dto.rest.MemberDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PageParam;
import com.raxim.myscoutee.profile.exception.MessageException;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.ProfileRepository;
import com.raxim.myscoutee.profile.service.EventService;
import com.raxim.myscoutee.profile.service.StatusService;
import com.raxim.myscoutee.profile.util.AppConstants;

@DataMongoTest
@DirtiesContext
@Import({ RepositoryConfig.class, JsonConfig.class })
@TestPropertySource(properties = { "de.flapdoodle.mongodb.embedded.version=6.0.6",
                "logging.level.org.springframework.data.mongodb=DEBUG" })
@TestData({ "mongo/profiles.json", "mongo/list/events.json" })
@TestExecutionListeners(value = MongoDataLoaderTestExecutionListener.class, mergeMode = TestExecutionListeners.MergeMode.MERGE_WITH_DEFAULTS)
public class EventServiceTestInt extends AbstractAlgoTest {

        @Autowired
        private ProfileRepository profileRepository;

        @Autowired
        private EventRepository eventRepository;

        private Converters converters = new Converters();

        private EventService eventService;
        private StatusService statusService;

        @BeforeEach
        public void init() {
                eventService = new EventService(eventRepository,
                                profileRepository, converters);
                statusService = new StatusService(profileRepository, eventRepository);
        }

        @Test
        public void shouldEventAdminInviteAndAcceptFirst() throws MessageException, CloneNotSupportedException {
                String[] memberStatuses = new String[] { "A", "I", "J", "W" };
                String status = "A";
                LocalDate createdDate = LocalDate.of(1901, 1, 1);
                String createdDateF = createdDate.atStartOfDay(ZoneId.systemDefault())
                                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

                String[] tOffset = new String[] { status, createdDateF };

                PageParam pageParam = new PageParam();
                pageParam.setId(AppTestConstants.UUID_PROFILE_OLIVER);
                pageParam.setOffset(tOffset);

                List<MemberDTO> memberDTOs = this.eventRepository.findMembersByEvent(pageParam,
                                AppTestConstants.UUID_EVENT_32,
                                memberStatuses);
                assertEquals(4, memberDTOs.size());

                List<UUID> invitedUuids = List.of(AppTestConstants.UUID_PROFILE_EMMA,
                                AppTestConstants.UUID_PROFILE_ETHAN, AppTestConstants.UUID_PROFILE_LIAM);
                List<String> invitedIds = invitedUuids.stream().map(
                                uuid -> uuid.toString())
                                .toList();

                eventService.invite(AppTestConstants.UUID_EVENT_32.toString(), invitedIds,
                                AppTestConstants.UUID_PROFILE_OLIVER);

                String[] eventStatuses = new String[] { "A", "P", "C" };
                LocalDate updatedDate = LocalDate.now();
                String updatedDateF = updatedDate.atStartOfDay(ZoneId.systemDefault())
                                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

                Object[] iOffSet = new Object[] { updatedDateF };

                PageParam pageParamInv = new PageParam();
                pageParamInv.setId(AppTestConstants.UUID_PROFILE_LIAM);
                pageParamInv.setOffset(iOffSet);
                pageParamInv.setGroupKey(AppConstants.DAY_FORMAT);

                List<EventDTO> invitations = eventService.getInvitations(pageParamInv, eventStatuses);
                assertEquals(1, invitations.size());
                assertEquals(AppTestConstants.UUID_EVENT_32, invitations.get(0).getItem().getId());

                memberDTOs = this.eventRepository.findMembersByEvent(pageParam,
                                AppTestConstants.UUID_EVENT_32,
                                memberStatuses);
                assertEquals(6, memberDTOs.size());

                assertEquals(AppTestConstants.UUID_PROFILE_EMMA, memberDTOs.get(1).getMember().getProfile().getId());
                assertEquals("A", memberDTOs.get(1).getMember().getStatus());

                assertEquals(AppTestConstants.UUID_PROFILE_ETHAN, memberDTOs.get(4).getMember().getProfile().getId());
                assertEquals("I", memberDTOs.get(4).getMember().getStatus());

                assertEquals(AppTestConstants.UUID_PROFILE_LIAM, memberDTOs.get(5).getMember().getProfile().getId());
                assertEquals("I", memberDTOs.get(5).getMember().getStatus());

                statusService.change(AppTestConstants.UUID_EVENT_32.toString(),
                                AppTestConstants.UUID_PROFILE_LIAM.toString(), "A");
                // late accept
                statusService.change(AppTestConstants.UUID_EVENT_32.toString(),
                                AppTestConstants.UUID_PROFILE_ETHAN.toString(), "A");

                memberDTOs = this.eventRepository.findMembersByEvent(pageParam, AppTestConstants.UUID_EVENT_32,
                                memberStatuses);
                assertEquals(6, memberDTOs.size());

                assertEquals(AppTestConstants.UUID_PROFILE_LIAM, memberDTOs.get(4).getMember().getProfile().getId());
                assertEquals("A", memberDTOs.get(4).getMember().getStatus());

                assertEquals(AppTestConstants.UUID_PROFILE_ETHAN, memberDTOs.get(5).getMember().getProfile().getId());
                assertEquals("W", memberDTOs.get(5).getMember().getStatus());

        }

        @Test
        public void shouldClone() {
                // clone event
        }

        @Test
        public void shouldSave() {
                // save event
        }

        //Lock/Unlock etc.
        @Test
        public void shouldChangeStatus() {

        }
}
