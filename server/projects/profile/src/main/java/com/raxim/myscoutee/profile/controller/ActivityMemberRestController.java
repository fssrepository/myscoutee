package com.raxim.myscoutee.profile.controller;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.rest.webmvc.RepositoryRestController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raxim.myscoutee.common.config.firebase.dto.FirebasePrincipal;
import com.raxim.myscoutee.common.util.CommonUtil;
import com.raxim.myscoutee.common.util.ControllerUtil;
import com.raxim.myscoutee.profile.data.document.mongo.EventItem;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.dto.rest.CodeDTO;
import com.raxim.myscoutee.profile.data.dto.rest.EventDTO;
import com.raxim.myscoutee.profile.data.dto.rest.MemberDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PageDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PageParam;
import com.raxim.myscoutee.profile.data.dto.rest.SchoolDTO;
import com.raxim.myscoutee.profile.handler.MemberParamHandler;
import com.raxim.myscoutee.profile.handler.ParamHandlers;
import com.raxim.myscoutee.profile.repository.mongo.EventItemRepository;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.ProfileRepository;
import com.raxim.myscoutee.profile.service.EventService;
import com.raxim.myscoutee.profile.service.ProfileService;
import com.raxim.myscoutee.profile.service.StatusService;

enum Action {
    join("J"),
    wait("W"),
    leave("L"),
    accept("A"),
    kick("K"),
    reject("R");

    private final String type;

    Action(final String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }
}

@RepositoryRestController
@RequestMapping("activity")
public class ActivityMemberRestController {
    private final EventRepository eventRepository;
    private final ProfileService profileService;
    private final StatusService statusService;
    private final ParamHandlers paramHandlers;
    private final EventService eventService;

    public ActivityMemberRestController(EventRepository eventRepository,
            EventItemRepository eventItemRepository,
            ProfileService profileService,
            ProfileRepository profileRepository,
            StatusService statusService,
            ObjectMapper objectMapper,
            ParamHandlers paramHandlers,
            EventService eventService) {
        this.eventRepository = eventRepository;
        this.profileService = profileService;
        this.statusService = statusService;
        this.paramHandlers = paramHandlers;
        this.eventService = eventService;
    }

    @PostMapping("events/{id}/items/{itemId}/{type}")
    public ResponseEntity<?> changeStatusForItem(@PathVariable String itemId,
            @PathVariable String type,
            @RequestBody EventItem eventItem, Authentication auth) {
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        String actionType = Action.valueOf(type).getType();

        return ControllerUtil.handle((i, s, p) -> statusService.changeStatusForItem(i, s, p),
                itemId, profile.getId(), actionType,
                HttpStatus.OK);
    }

    // wait is when we have invited more members than what capacity we have set, if
    // it's filled, we can accept with wait
    @PostMapping({ "events/{id}/{type}", "invitations/{id}/{type}" })
    public ResponseEntity<EventDTO> changeStatusForEvent(@PathVariable String id,
            @PathVariable String type,
            Authentication auth) {
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        String actionType = Action.valueOf(type).getType();

        return ControllerUtil.handle((i, s, p) -> statusService.changeStatusForEvent(i, s, p),
                id, profile.getId(), actionType,
                HttpStatus.OK);
    }

    // when the promoter accepts, can see the members, before that not!
    // instead of "clone" use name "pick or select"
    // TODO: promotion fix -> statusService.changeStatusForEvent not prepared to
    // handle
    // when event locked, promoter will be invited to the event,
    // hence the events will appear in the invitations tab, not the promotion tab
    @PostMapping(value = { "promotions/{id}/{type}" })
    public ResponseEntity<EventDTO> changeEventForPromotion(@PathVariable String id, @PathVariable String type,
            Authentication auth) {
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        String actionType = Action.valueOf(type).getType();

        return ControllerUtil.handle((i, s, p) -> statusService.changeStatusForEvent(i, s, p),
                id, profile.getId(), actionType,
                HttpStatus.OK);
    }

    @PostMapping("events/{eventId}/members/{memberId}/{type}")
    public ResponseEntity<?> manageStatusForEvent(@PathVariable String eventId, @PathVariable String itemId,
            @PathVariable String memberId, @PathVariable String type, Authentication auth) {
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        String actionType = Action.valueOf(type).getType();

        return ControllerUtil.handle((i, m, s, p) -> statusService.manageMemberStatusForEvent(i, m, s, p),
                eventId, memberId, profile.getId(), actionType,
                HttpStatus.OK);
    }

    @PostMapping("events/{eventId}/items/{id}/members/{memberId}/{type}")
    public ResponseEntity<?> manageStatusForItem(@PathVariable String itemId,
            @PathVariable String memberId, @PathVariable String type, Authentication auth) {
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        String actionType = Action.valueOf(type).getType();

        return ControllerUtil.handle((i, m, s, p) -> statusService.manageMemberStatusForItem(i, m, s, p),
                itemId, memberId, profile.getId(), actionType,
                HttpStatus.OK);
    }

    @GetMapping(value = { "events/{eventId}/items/{itemId}/members" })
    public ResponseEntity<PageDTO<MemberDTO>> getMembersForItem(@PathVariable String itemId, PageParam pageParam,
            Authentication auth) {

        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        pageParam = paramHandlers.handle(profile, pageParam, MemberParamHandler.TYPE);
        List<MemberDTO> members = this.eventService.getMembersByItem(pageParam, itemId);
        List<Object> lOffset = CommonUtil.offset(members, pageParam.getOffset());

        return ResponseEntity.ok(new PageDTO<>(members, lOffset));
    }

    @GetMapping(value = { "events/{eventId}/members", "invitations/{eventId}/members" })
    public ResponseEntity<PageDTO<MemberDTO>> getMembersForEvent(@PathVariable String eventId,
            PageParam pageParam, Authentication auth) {

        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        pageParam = paramHandlers.handle(profile, pageParam, MemberParamHandler.TYPE);
        List<MemberDTO> members = eventService.getMembersByEvent(pageParam, eventId);
        List<Object> lOffset = CommonUtil.offset(members, pageParam.getOffset());
        Object lRole = !members.isEmpty() ? members.get(members.size() - 1).getRole() : null;

        return ResponseEntity.ok(new PageDTO<>(members, lOffset, 1, null, lRole));
    }

    @GetMapping(value = { "events/{eventId}/members/{id}/schools" })
    public ResponseEntity<PageDTO<SchoolDTO>> getSchools(@PathVariable String id, Authentication auth,
            @RequestParam("step") Integer step,
            @RequestParam("offset") String[] offset) {
        String[] tOffset = (offset != null && offset.length == 3)
                ? new String[] { CommonUtil.decode(offset[0]), CommonUtil.decode(offset[1]),
                        CommonUtil.decode(offset[2]) }
                : new String[] { "a", "1900-01-01", "1900-01-01" };

        List<SchoolDTO> schools = profileService.getSchools(UUID.fromString(id), step, tOffset);

        List<Object> lOffset = schools.isEmpty() ? Arrays.asList(tOffset) : schools.get(schools.size() - 1).getOffset();

        return ResponseEntity.ok(new PageDTO<>(schools, lOffset));
    }

    @GetMapping("events/{id}/code")
    public ResponseEntity<CodeDTO> code(@PathVariable String id, Authentication auth) {
        UUID eventUUId = UUID.fromString(id);
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        Optional<CodeDTO> code = eventRepository.findCodeByEvent(eventUUId, profile.getId());

        return code.map(c -> ResponseEntity.ok(c)).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("events/{id}/verify")
    public ResponseEntity<MemberDTO> verify(@PathVariable String id, @RequestBody String code) {
        Optional<MemberDTO> member = eventRepository.findMemberByCode(UUID.fromString(id), code);
        return member.map(m -> ResponseEntity.ok(m)).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("events/{eventId}/members")

    @Transactional
    public ResponseEntity<EventDTO> addMembers(
            @PathVariable String eventId, @RequestBody List<String> profileids, Authentication auth) {
        FirebasePrincipal firebasePrincipal = (FirebasePrincipal) auth.getPrincipal();
        Profile profile = firebasePrincipal.getUser().getProfile();

        return ControllerUtil.handle((i, s, p) -> eventService.inviteMembersForEvent(i, s, p),
                eventId, profileids, profile.getId(),
                HttpStatus.CREATED);
    }

}
