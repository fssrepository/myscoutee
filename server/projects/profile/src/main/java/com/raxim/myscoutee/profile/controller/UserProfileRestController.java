package com.raxim.myscoutee.profile.controller;

import com.raxim.myscoutee.common.config.firebase.dto.FirebasePrincipal;
import com.raxim.myscoutee.profile.data.document.mongo.Group;
import com.raxim.myscoutee.profile.data.document.mongo.Link;
import com.raxim.myscoutee.profile.data.document.mongo.User;
import com.raxim.myscoutee.profile.data.dto.rest.LinkDTO;
import com.raxim.myscoutee.profile.data.dto.rest.LinkInfoDTO;
import com.raxim.myscoutee.profile.repository.mongo.GroupRepository;
import com.raxim.myscoutee.profile.repository.mongo.LinkRepository;
import com.raxim.myscoutee.profile.repository.mongo.ProfileRepository;
import com.raxim.myscoutee.profile.service.ProfileService;
import org.springframework.data.rest.webmvc.RepositoryRestController;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;
import java.util.UUID;

@RepositoryRestController
@RequestMapping("user")
public class UserProfileRestController {
    private final ProfileService profileService;
    private final GroupRepository groupRepository;
    private final LinkRepository linkRepository;

    public UserProfileRestController(ProfileService profileService, GroupRepository groupRepository, LinkRepository linkRepository) {
        this.profileService = profileService;
        this.groupRepository = groupRepository;
        this.linkRepository = linkRepository;
    }

    @GetMapping("/profile")
    public ResponseEntity<Profile> getProfile(Authentication auth) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = principal.getUser().getProfile();

        if (profile != null) {
            Profile profileDto = new Profile(profile);
            return ResponseEntity.ok(profileDto);
        } else {
            // profile not exists
            Profile profileDto = new Profile(new com.raxim.myscoutee.profile.data.document.mongo.Profile());
            return ResponseEntity.ok(profileDto);
        }
    }

    @PostMapping(value = "/profile", consumes = "multipart/form-data")
    @Transactional
    public ResponseEntity<Profile> saveProfile(Authentication auth, @RequestPart("profile") com.raxim.myscoutee.profile.data.document.mongo.Profile profile, @RequestPart(value = "voice", required = false) MultipartFile voice) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        UUID profileId = user.getProfile().getId();
        UUID group = user.getGroup();

        try {
            Profile profileDto = profileService.saveProfile(user.getId(), profileId, group, profile, voice);

            if (profileDto == null) {
                return ResponseEntity.notFound().build();
            } else {
                return ResponseEntity.ok(profileDto);
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/profile/rewards")
    @Transactional
    public ResponseEntity<List<Reward>> getRewards(Authentication auth) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        String profileId = user.getProfile().getId();

        List<Reward> rewards = linkRepository.findRewards(profileId);

        return ResponseEntity.ok(rewards);
    }

    @GetMapping("/profile/share")
    @Transactional
    public ResponseEntity<LinkDTO> shareGroup(Authentication auth) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        UUID profileId = user.getProfile().getId();

        Link link = new Link(UUID.randomUUID(), user.getGroup(), "g", profileId);

        Link linkSaved = linkRepository.save(link);

        Optional<Group> group = groupRepository.findById(user.getGroup());

        if (group.isPresent()) {
            Group groupReq = group.get();
            LinkDTO linkResp = new LinkDTO(
                    linkSaved,
                    new LinkInfoDTO("Please be invited for " + groupReq.getName() + " group!", groupReq.getDesc())
            );
            return ResponseEntity.ok(linkResp);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
}

