package com.raxim.myscoutee.profile.service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.raxim.myscoutee.profile.data.document.mongo.Event;
import com.raxim.myscoutee.profile.data.document.mongo.EventItem;
import com.raxim.myscoutee.profile.data.document.mongo.Member;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.Promotion;
import com.raxim.myscoutee.profile.data.dto.rest.EventDTO;
import com.raxim.myscoutee.profile.data.dto.rest.EventItemDTO;
import com.raxim.myscoutee.profile.exception.EventFullException;
import com.raxim.myscoutee.profile.exception.IllegalAccessException;
import com.raxim.myscoutee.profile.exception.MessageException;
import com.raxim.myscoutee.profile.exception.PromotionFullException;
import com.raxim.myscoutee.profile.repository.mongo.EventItemRepository;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.MemberRepository;
import com.raxim.myscoutee.profile.repository.mongo.ProfileRepository;
import com.raxim.myscoutee.profile.repository.mongo.PromotionRepository;
import com.raxim.myscoutee.profile.repository.mongo.TokenRepository;

@Service
public class StatusService {
    private final ProfileRepository profileRepository;
    private final EventRepository eventRepository;
    private final EventItemRepository eventItemRepository;
    private final TokenRepository tokenRepository;
    private final MemberRepository memberRepository;
    private final PromotionRepository promotionRepository;

    public StatusService(
            ProfileRepository profileRepository,
            EventRepository eventRepository,
            EventItemRepository eventItemRepository,
            TokenRepository tokenRepository,
            MemberRepository memberRepository,
            PromotionRepository promotionRepository) {
        this.profileRepository = profileRepository;
        this.eventRepository = eventRepository;
        this.eventItemRepository = eventItemRepository;
        this.tokenRepository = tokenRepository;
        this.memberRepository = memberRepository;
        this.promotionRepository = promotionRepository;
    }

    // approve, kick etc.
    public Optional<EventItemDTO> manageMemberStatusForItem(String id, String profileUid, UUID byUuid, String status) {
        Optional<EventItem> eventItemRes = id != null ? this.eventItemRepository.findById(UUID.fromString(id))
                : Optional.empty();

        UUID memberId = UUID.fromString(profileUid);

        if (eventItemRes.isPresent()) {
            EventItem eventItem = eventItemRes.get();

            Optional<Member> optCurrentMember = eventItem.getMembers().stream()
                    .filter(member -> memberId.equals(member.getProfile().getId())).findFirst();

            Optional<Member> optAdmin = eventItem.getMembers().stream()
                    .filter(member -> byUuid.equals(member.getProfile().getId())
                            && "A".equals(member.getRole()))
                    .findFirst();

            if (optAdmin.isPresent() && optCurrentMember.isPresent()) {
                Member currentMember = optCurrentMember.get();
                currentMember.setStatus(status);
                currentMember.setUpdatedDate(LocalDateTime.now());
                eventItem.getMembers().add(currentMember);
            }

            eventItem.sync();

            EventItem dbEventItem = this.eventItemRepository.save(eventItem);
            return Optional.of(new EventItemDTO(dbEventItem));
        }
        return Optional.empty();
    }

    // optional eventItem
    public Optional<EventItemDTO> changeStatusForItem(String id, UUID profileUid, String status) {
        Optional<EventItem> eventItemRes = id != null ? this.eventItemRepository.findById(UUID.fromString(id))
                : Optional.empty();

        if (eventItemRes.isPresent()) {
            EventItem eventItem = eventItemRes.get();

            Optional<Member> optCurrentMember = eventItem.getMembers().stream()
                    .filter(member -> profileUid.equals(member.getProfile().getId())).findFirst();

            if (optCurrentMember.isPresent()) {
                Member currentMember = optCurrentMember.get();
                currentMember.setStatus(status);
                currentMember.setUpdatedDate(LocalDateTime.now());
                eventItem.getMembers().add(currentMember);
            } else {
                Optional<Profile> optProfile = profileRepository
                        .findById(profileUid);
                if (optProfile.isPresent()) {
                    Member newMember = new Member();
                    Profile profile = optProfile.get();
                    newMember.setProfile(profile);
                    newMember.setCreatedDate(LocalDateTime.now());
                    newMember.setRole("U");
                    newMember.setUpdatedDate(LocalDateTime.now());
                    newMember.setStatus(status);

                    eventItem.getMembers().add(newMember);
                }
            }

            eventItem.sync();

            EventItem dbEventItem = this.eventItemRepository.save(eventItem);
            return Optional.of(new EventItemDTO(dbEventItem));

        }
        return Optional.empty();
    }

    // promotion accept event -> message to participant, or cancel event
    public Optional<EventDTO> changeStatusForEvent(String id, UUID profileUid, String status)
            throws MessageException {

        Optional<Event> eventRes = id != null ? this.eventRepository.findById(UUID.fromString(id)) : Optional.empty();

        if (eventRes.isPresent()) {
            Event event = eventRes.get();

            if ("A".equals(status)
                    && event.getNum() == event.getCapacity().getMax()) {
                throw new EventFullException();
            }

            if (event.getRef() != null) {
                Optional<Promotion> optPromotion = this.promotionRepository.findPromotionByEvent(event.getRef().getId());
                if (!optPromotion.isPresent()) {
                    throw new IllegalAccessException();
                }

                Promotion promotion = optPromotion.get();
                if (promotion.getCnt() == 0) {
                    throw new PromotionFullException();
                }

                /*promotion.sync();
                
                this.promotionRepository.save(promotion);*/
            }

            Optional<Member> optCurrentMember = event.getMembers().stream()
                    .filter(member -> profileUid.equals(member.getProfile().getId())).findFirst();

            if (!optCurrentMember.isPresent()) {
                throw new IllegalAccessException();
            }

            Member currentMember = optCurrentMember.get();
            currentMember.setStatus(status);
            event.getMembers().add(currentMember);

            event.sync();
            Event dbEvent = eventRepository.save(event);

            // notification sent for any member with status A and any role (promoter also)

            return Optional.of(new EventDTO(dbEvent));
        }

        return Optional.empty();
    }
}
