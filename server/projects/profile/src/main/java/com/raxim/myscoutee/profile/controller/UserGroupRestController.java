package com.raxim.myscoutee.profile.controller;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.rest.webmvc.RepositoryRestController;
import org.springframework.data.util.Pair;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.raxim.myscoutee.common.config.firebase.dto.FirebasePrincipal;
import com.raxim.myscoutee.common.util.CommonUtil;
import com.raxim.myscoutee.common.util.ControllerUtil;
import com.raxim.myscoutee.profile.data.document.mongo.Group;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.User;
import com.raxim.myscoutee.profile.data.dto.rest.GroupDTO;
import com.raxim.myscoutee.profile.data.dto.rest.LinkDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PageDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PageParam;
import com.raxim.myscoutee.profile.data.dto.rest.UserDTO;
import com.raxim.myscoutee.profile.handler.ParamHandlers;
import com.raxim.myscoutee.profile.handler.UserParamHandler;
import com.raxim.myscoutee.profile.repository.mongo.GroupRepository;
import com.raxim.myscoutee.profile.service.GroupService;
import com.raxim.myscoutee.profile.service.LinkService;
import com.raxim.myscoutee.profile.service.UserService;

enum GroupAction {
    suspend("S"),
    friendOnly("F"),
    all("A"),
    leave("L"),
    invisible("I"),
    join("J"),
    accept("A"); // based on gracePeriod it can be A, if mincapacity is ok

    private final String type;

    GroupAction(final String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }
}

@RepositoryRestController
@RequestMapping("user")
public class UserGroupRestController {
    private final GroupService groupService;
    private final UserService userService;
    private final LinkService linkService;
    private final GroupRepository groupRepository;
    private final ParamHandlers paramHandlers;

    public UserGroupRestController(GroupService groupService, UserService userService, LinkService linkService,
            GroupRepository groupRepository, ParamHandlers paramHandlers) {
        this.groupService = groupService;
        this.userService = userService;
        this.linkService = linkService;
        this.groupRepository = groupRepository;
        this.paramHandlers = paramHandlers;
    }

    @GetMapping("groups")
    @Transactional
    public ResponseEntity<Object> groups(PageParam pageParam, Authentication auth) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();
        Profile profile = user.getProfile();

        pageParam = paramHandlers.handle(profile, pageParam, UserParamHandler.TYPE);
        List<GroupDTO> groupDTOs = this.userService.getGroupsByUser(user.getId(), pageParam);

        List<Object> lOffset = CommonUtil.offset(groupDTOs, pageParam.getOffset());

        return ResponseEntity.ok(
                new PageDTO<>(groupDTOs, lOffset, 0, pageParam.getType()));
    }

    // add button on the group list screen
    @PostMapping("/groups")
    public ResponseEntity<GroupDTO> saveGroup(
            Authentication auth,
            @RequestBody Group group) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();

        ResponseEntity<GroupDTO> response = ControllerUtil.handle(
                (g, u) -> this.groupService.saveGroup(g, u),
                group, user,
                HttpStatus.CREATED);
        return response;
    }

    @PatchMapping("/groups/{id}")
    @Transactional
    public ResponseEntity<GroupDTO> patchGroup(
            Authentication auth,
            @PathVariable String id,
            @RequestBody Group group) {

        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();

        ResponseEntity<GroupDTO> response = ControllerUtil.handle(
                (g, u) -> this.groupService.saveGroup(g, u),
                group, user,
                HttpStatus.OK);
        return response;
    }

    // leave group/delete group etc. -> notify other users
    @PostMapping("/groups/{groupId}/{type}")
    public ResponseEntity<UserDTO> change(@PathVariable String groupId, @PathVariable String type,
            Authentication auth) {
        FirebasePrincipal principal = (FirebasePrincipal) auth.getPrincipal();
        User user = principal.getUser();

        String actionType = MemberAction.valueOf(type).getType();

        return ControllerUtil.handle((u, g, s) -> this.userService.changeStatus(u, g, s),
                user, groupId, actionType,
                HttpStatus.OK);
    }

    // Type is a group link
    @GetMapping("/groups/{id}/share")
    @Transactional
    public ResponseEntity<LinkDTO> shareGroup(
            Authentication auth,
            @PathVariable String id) {
        Profile profile = ((FirebasePrincipal) auth.getPrincipal()).getUser().getProfile();

        Optional<Group> group = groupRepository.findById(UUID.fromString(id));

        Pair<String, String> info = null;
        if (group.isPresent()) {
            Group lGroup = group.get();
            Pair.of(lGroup.getName(), lGroup.getDesc());
        }

        ResponseEntity<LinkDTO> response = ControllerUtil.handle(
                (p, i, d) -> linkService.saveLink(p, i, d),
                profile.getId(), id, info,
                HttpStatus.CREATED);
        return response;
    }
}
