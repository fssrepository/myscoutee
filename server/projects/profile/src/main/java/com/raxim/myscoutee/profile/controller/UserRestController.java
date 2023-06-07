package com.raxim.myscoutee.profile.controller;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.rest.webmvc.RepositoryRestController;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;

import com.raxim.myscoutee.common.config.firebase.dto.FirebasePrincipal;
import com.raxim.myscoutee.common.config.properties.ConfigProperties;
import com.raxim.myscoutee.profile.data.document.mongo.Group;
import com.raxim.myscoutee.profile.data.document.mongo.Like;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.Setting;
import com.raxim.myscoutee.profile.data.document.mongo.User;

@RepositoryRestController
@RequestMapping("user")
public class UserRestController {
    private final ProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final LikeRepository likeRepository;
    private final SettingRepository settingRepository;
    private final FormRepository formRepository;
    private final ConfigProperties config;

    public UserRestController(ProfileRepository profileRepository,
            UserRepository userRepository,
            LikeRepository likeRepository,
            SettingRepository settingRepository,
            FormRepository formRepository,
            ConfigProperties config) {
        this.profileRepository = profileRepository;
        this.userRepository = userRepository;
        this.likeRepository = likeRepository;
        this.settingRepository = settingRepository;
        this.formRepository = formRepository;
        this.config = config;
    }

    @PostMapping()
    public ResponseEntity<User> saveUser(Authentication auth, @RequestPart Group group) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();

        User userToSave = userRepository.findUserByEmail(auth.getName());

        Profile profile = userToSave.getProfiles().stream()
                .filter(p -> p.getGroup().equals(group.getId()))
                .findFirst().orElse(null);

        // user logged in to different profile
        if (profile != null && !profile.getId().equals(user.getProfile().getId())) {
            profile.setLastLogin(LocalDateTime.now().truncatedTo(ChronoUnit.DAYS));
            profileRepository.save(profile);
        }

        userToSave.setGroup(group.getId());
        userToSave.setProfile(profile);
        User userSaved = userRepository.save(userToSave);

        boolean adminUser = config.getAdminUser().equals(auth.getName());
        List<Group> groups = userRepository.findAllGroupsByEmail(auth.getName()).stream()
                .filter(g -> g.getRole().equals("ROLE_USER") || (adminUser && g.getGroup().getType().equals("b")))
                .toList();

        List<Like> likes = likeRepository.newLikesByProfile(
                profile.getId(), profile.getLastLogin().format(DateTimeFormatter.ISO_DATE_TIME));

        return ResponseEntity.ok(new User(userSaved, groups, likes));
    }

    @GetMapping()
    public ResponseEntity<User> getUser(Authentication auth) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        Profile profile = user.getProfile();
        UUID profileId = profile.getId();

        boolean adminUser = config.getAdminUser().equals(auth.getName());
        List<Group> groups = userRepository.findAllGroupsByEmail(auth.getName()).stream()
                .filter(g -> g.getRole().equals("ROLE_USER") || (adminUser && g.getGroup().getType().equals("b")))
                .toList();

        profile.setLastLogin(LocalDateTime.now().truncatedTo(ChronoUnit.DAYS));
        profileRepository.save(profile);

        List<Like> likes = likeRepository.newLikesByProfile(
                profileId, profile.getLastLogin().format(DateTimeFormatter.ISO_DATE_TIME));

        return ResponseEntity.ok(new User(user, groups, likes));
    }

    @GetMapping("/settings")
    public ResponseEntity<Setting> getSetting(Authentication auth, @RequestParam("key") String key) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        UUID profileId = user.getProfile().getId();

        Setting setting = settingRepository.findSettingByProfileAndKey(profileId, key);

        if (setting == null) {
            Optional<Form> form = formRepository.findFormByKey(key);
            if (form.isPresent()) {
                Form sForm = form.get();
                Setting settingToSave = new Setting(UUID.randomUUID(), key, profileId, sForm.getItems());
                Setting settingSaved = settingRepository.save(settingToSave);
                return ResponseEntity.ok(settingSaved);
            } else {
                return ResponseEntity.badRequest().build();
            }
        } else {
            return ResponseEntity.ok(setting);
        }
    }

    @PostMapping("/settings")
    public ResponseEntity<Setting> saveSetting(Authentication auth, @RequestParam("key") String key,
            @RequestBody Setting setting) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        String profileId = user.getProfile().getId();

        Setting dbSetting = settingRepository.findSettingByProfileAndKey(profileId, key);
        if (dbSetting != null) {
            Setting settingToSave = dbSetting.copy(setting.getItems());
            Setting settingsSaved = settingRepository.save(settingToSave);
            return ResponseEntity.ok(settingsSaved);
        } else {
            return ResponseEntity.badRequest().build();
        }
    }
}