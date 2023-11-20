package com.raxim.myscoutee.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.TestPropertySource;

import com.raxim.myscoutee.common.AppTestConstants;
import com.raxim.myscoutee.common.config.JsonConfig;
import com.raxim.myscoutee.common.config.RepositoryConfig;
import com.raxim.myscoutee.common.repository.MongoDataLoaderTestExecutionListener;
import com.raxim.myscoutee.common.repository.TestData;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.User;
import com.raxim.myscoutee.profile.repository.mongo.ProfileRepository;
import com.raxim.myscoutee.profile.repository.mongo.UserRepository;

@DataMongoTest
@DirtiesContext
@Import({ JsonConfig.class, RepositoryConfig.class })
@TestPropertySource(properties = { "de.flapdoodle.mongodb.embedded.version=6.0.6",
        "logging.level.org.springframework.data.mongodb=DEBUG" })
@TestData({ "mongo/profiles.json", "mongo/token/users.json" })
@TestExecutionListeners(value = MongoDataLoaderTestExecutionListener.class, mergeMode = TestExecutionListeners.MergeMode.MERGE_WITH_DEFAULTS)
public class UserRepositoryTest {

    @Autowired
    private ProfileRepository profileRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    public void testShouldAddProfile() {
        this.profileRepository.findById(AppTestConstants.UUID_PROFILE_OLIVER)
                .ifPresent(profile -> userRepository.addProfile(AppTestConstants.UUID_PROFILE_OLIVER, profile));

        List<User> users = this.userRepository.findAll();

        List<Profile> profiles = new ArrayList<Profile>(users.get(0).getProfiles());
        assertEquals(1, profiles.size());

        assertEquals(AppTestConstants.UUID_PROFILE_OLIVER, profiles.get(0).getId());
    }

    @Test
    public void shouldLoadUserByProfile() {
        Optional<User> optUser = this.userRepository.findUserByProfile(AppTestConstants.UUID_PROFILE_OLIVER);
        assertTrue(optUser.isPresent());

        List<UUID> profileIds = new ArrayList<>();
        profileIds.add(AppTestConstants.UUID_PROFILE_OLIVER);
    }
}
