package com.raxim.myscoutee.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.TestPropertySource;

import com.raxim.myscoutee.common.config.RepositoryConfig;
import com.raxim.myscoutee.common.repository.MongoDataLoaderTestExecutionListener;
import com.raxim.myscoutee.common.repository.TestData;
import com.raxim.myscoutee.common.util.JsonUtil;
import com.raxim.myscoutee.profile.data.document.mongo.LikeGroup;
import com.raxim.myscoutee.profile.data.dto.rest.LikeDTO;
import com.raxim.myscoutee.profile.repository.mongo.LikeRepository;

@DataMongoTest
@Import({ RepositoryConfig.class })
@TestPropertySource(properties = { "de.flapdoodle.mongodb.embedded.version=6.0.6",
                "logging.level.org.springframework.data.mongodb=DEBUG" })
@TestData({ "mongo/profiles.json", "mongo/likes.json" })
@TestExecutionListeners(value = MongoDataLoaderTestExecutionListener.class, mergeMode = TestExecutionListeners.MergeMode.MERGE_WITH_DEFAULTS)
public class LikeRepositoryTest {

        private final static UUID UUID_PROFILE_SOPHIA = UUID.fromString("39402632-a452-57be-2518-53cc117b1abc");

        @Autowired
        private LikeRepository likeRepository;

        @Test
        public void testShouldFindAll() {

                List<LikeGroup> likes = this.likeRepository.findAll(0L, 1000L);
                assertEquals(7, likes.size());

                List<LikeGroup> pLikes = likes.stream().filter(
                                like -> like.getLikes()
                                                .stream()
                                                .filter(pLike -> "A".equals(pLike.getStatus()))
                                                .count() == 2)
                                .toList();
                assertEquals(2, pLikes.size());

                LikeGroup likeGroup1 = pLikes.get(0);
                assertEquals(2, likeGroup1.getLikes().size());

                assertTrue(likeGroup1.getLikes().stream().anyMatch(
                                like -> "Evelyn".equals(like.getFrom().getFirstName())
                                                && "Liam".equals(like.getTo().getFirstName())));

                LikeGroup likeGroup2 = pLikes.get(1);
                assertEquals(2, likeGroup1.getLikes().size());
                assertTrue(likeGroup2.getLikes().stream().anyMatch(
                                like -> "Oliver".equals(like.getFrom().getFirstName())
                                                && "Mia".equals(like.getTo().getFirstName())));
        }

        @Test
        public void testShouldFindByParty() throws IOException {
                LikeDTO[] likeArray = JsonUtil.loadJson(this, "rest/likes.json", LikeDTO[].class);
                List<LikeDTO> likeDTOs = Arrays.asList(likeArray);
                List<LikeGroup> likes = this.likeRepository.findByParty(UUID_PROFILE_SOPHIA, likeDTOs);

                assertEquals(1, likes.size());
        }
}
