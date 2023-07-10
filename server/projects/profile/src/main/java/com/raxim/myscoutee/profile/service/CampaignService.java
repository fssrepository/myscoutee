package com.raxim.myscoutee.profile.service;

import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raxim.myscoutee.common.util.JsonUtil;
import com.raxim.myscoutee.profile.data.document.mongo.Event;
import com.raxim.myscoutee.profile.data.document.mongo.Idea;
import com.raxim.myscoutee.profile.data.document.mongo.Job;
import com.raxim.myscoutee.profile.data.dto.rest.IdeaDTO;
import com.raxim.myscoutee.profile.data.dto.rest.JobDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PromotionDTO;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.GroupRepository;
import com.raxim.myscoutee.profile.repository.mongo.IdeaRepository;
import com.raxim.myscoutee.profile.repository.mongo.JobRepository;
import com.raxim.myscoutee.profile.repository.mongo.MemberRepository;
import com.raxim.myscoutee.profile.repository.mongo.PromotionRepository;

@Service
public class CampaignService {
    private final PromotionRepository promotionRepository;
    private final IdeaRepository ideaRepository;
    private final JobRepository jobRepository;
    private final EventRepository eventRepository;
    private final EventService eventService;
    private final GroupRepository groupRepository;
    private final MemberRepository memberRepository;
    private final ObjectMapper objectMapper;

    public CampaignService(
            PromotionRepository promotionRepository,
            IdeaRepository ideaRepository,
            JobRepository jobRepository,
            EventRepository eventRepository,
            EventService eventService,
            GroupRepository groupRepository,
            MemberRepository memberRepository,
            ObjectMapper objectMapper) {
        this.promotionRepository = promotionRepository;
        this.ideaRepository = ideaRepository;
        this.jobRepository = jobRepository;
        this.eventRepository = eventRepository;
        this.eventService = eventService;
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.objectMapper = objectMapper;
    }

    public List<PromotionDTO> getPromotions(UUID profileId, Integer step, Object[] tOffset) {
        return this.promotionRepository.findPromotionsByProfile(profileId, 20, step != null ? step : 5, tOffset);
    }

    public List<Event> getAllActiveEvents(UUID[] refIds) {
        if (refIds != null && refIds.length > 0) {
            return this.eventService.getAllActiveEvents(refIds);
        } else {
            return Collections.emptyList();
        }
    }

    //TODO: promotion fix
    /*public Optional<Pair<EventMulti, Boolean>> getPromotion(
            EventMulti promotion,
            Profile profile,
            boolean isUpdate,
            boolean isEvent) {
        Optional<EventMulti> promotionRes = promotion.getId() != null
                ? this.promotionRepository.findById(promotion.getId())
                : Optional.empty();

        EventMulti currPromotion = isEvent ? promotionRes.get()
                : promotion;

        Group group = null;
        if (currPromotion.getGroup() != null && !currPromotion.getGroup().getSystem()) {
            group = this.groupRepository.findById(currPromotion.getGroup().getId()).get();
        } else {
            group = this.groupRepository.findSystemGroupByType(currPromotion.getGroupType());
        }

        Optional<Event> template = this.eventRepository
                .findById(currPromotion.getItem().getId());

        if (promotionRes.isPresent()) {
            EventMulti oldPromotion = promotionRes.get();

            EventMulti upPromotion = JsonUtil.clone(oldPromotion, objectMapper);
            upPromotion.setItem(template.get());
            upPromotion.setGroup(group);
            upPromotion.setSlots(currPromotion.getSlots());
            upPromotion.setName(currPromotion.getName());
            upPromotion.setRange(currPromotion.getRange());

            Pair<EventMulti, Boolean> promoInfo = Pair.of(upPromotion,
                    promotionRes.get().getItem().getId() != template.get().getId());
            return Optional.of(promoInfo);
        } else {
            if (!isUpdate) {

                EventMulti newPromotion = JsonUtil.clone(currPromotion, objectMapper);
                newPromotion.setItem(template.get());
                newPromotion.setGroup(group);
                newPromotion.setCreatedDate(new Date());
                newPromotion.setCreatedBy(profile.getId());

                return Optional.of(Pair.of(newPromotion, false));
            } else {
                return Optional.empty();
            }
        }
    }*/

    // TODO: promotion fix
    /*public Optional<Promotion> savePromotion(
            Promotion promotion,
            Profile profile,
            boolean isEvent,
            boolean isNewTemplate) {
        Promotion promotionToSave;
        if (isEvent) {
            List<Slot> deletedSlots = promotion.getSlots().stream()
                    .filter(slot -> promotion.getEvents().stream()
                            .noneMatch(event -> event.getStatus().equals("D") && slot.getRange().getStart()
                                    .toLocalDate().equals(event.getInfo().getRange().getStart().toLocalDate())))
                    .collect(Collectors.toList());
            promotion.getSlots().removeAll(deletedSlots);

            List<Slot> newSlots = promotion.getEvents().stream()
                    .filter(event -> !event.getStatus().equals("D") && promotion.getSlots().stream()
                            .noneMatch(slot -> slot.getRange().getStart().toLocalDate()
                                    .equals(event.getInfo().getRange().getStart().toLocalDate())))
                    .map(event -> {
                        Slot slot = new Slot();
                        slot.setRange(event.getInfo().getRange());
                        return slot;
                    })
                    .collect(Collectors.toList());

            promotion.getSlots().addAll(newSlots);

            promotionToSave = promotion;
        } else {
            List<Event> deletedEvents;
            if (!isNewTemplate) {
                if (promotion.getId() != null) {
                    deletedEvents = promotion.getEvents().stream()
                            .filter(event -> !event.getStatus().equals("D") &&
                                    promotion.getSlots().stream()
                                            .noneMatch(slot -> slot.getRange().getStart().toLocalDate()
                                                    .equals(event.getInfo().getRange().getStart().toLocalDate())))
                            .peek(event -> event.setStatus("D"))
                            .collect(Collectors.toList());
                } else {
                    deletedEvents = Collections.emptyList();
                }
            } else {
                deletedEvents = promotion.getEvents().stream()
                        .peek(event -> event.setStatus("D"))
                        .collect(Collectors.toList());
            }

            promotion.getEvents().removeAll(deletedEvents);

            List<Event> newEvents = promotion.getSlots().stream()
                    .filter(slot -> promotion.getEvents().stream()
                            .noneMatch(event -> event.getStatus().equals("D") && slot.getRange().getStart()
                                    .toLocalDate().equals(event.getInfo().getRange().getStart().toLocalDate())))
                    .map(slot -> {
                        Event evt = EventUtil.cloneBy(promotion.getItem(), profile, slot, true, objectMapper);
                        Event clonedEvent = JsonUtil.clone(evt, objectMapper);
                        clonedEvent.setType(promotion.getType());
                        return clonedEvent;
                    })
                    .collect(Collectors.toList());

            List<EventItem> mEventItems = newEvents.stream()
                    .flatMap(event -> event.getItems().stream())
                    .collect(Collectors.toList());

            List<Member> mMembers = newEvents.stream()
                    .flatMap(event -> event.getInfo().getMembers().stream())
                    .collect(Collectors.toList());
            this.memberRepository.saveAll(mMembers);

            promotion.setCnt(promotion.getSlots().stream()
                    .mapToInt(Slot::getNumOfItems)
                    .sum());

            // Don't need to save into event as the id is the same
            this.eventItemRepository.saveAll(mEventItems);
            promotion.getEvents().addAll(newEvents);

            promotionToSave = promotion;
        }

        promotionToSave = this.promotionRepository.save(promotionToSave);

        return Optional.of(promotionToSave);
    }*/

    public List<IdeaDTO> getIdeas(UUID profileId, Integer step, Object[] tOffset) {
        return this.ideaRepository.findIdeasByProfile(
                profileId, 20, step != null ? step : 5,
                tOffset);
    }

    public IdeaDTO saveIdea(UUID profileId, UUID ideaId, Idea idea) {
        com.raxim.myscoutee.profile.data.document.mongo.Idea ideaToSave;
        if (ideaId != null) {
            Optional<com.raxim.myscoutee.profile.data.document.mongo.Idea> ideaResult = this.ideaRepository
                    .findById(ideaId);
            com.raxim.myscoutee.profile.data.document.mongo.Idea ideaEntity = ideaResult.get();

            Idea clonedIdea = JsonUtil.clone(idea, objectMapper);
            clonedIdea.setId(ideaEntity.getId());
            clonedIdea.setCreatedDate(ideaEntity.getCreatedDate());
            clonedIdea.setCreatedBy(ideaEntity.getCreatedBy());
            ideaToSave = clonedIdea;
        } else {
            Idea clonedIdea = JsonUtil.clone(idea, objectMapper);
            clonedIdea.setId(UUID.randomUUID());
            clonedIdea.setCreatedDate(new Date());
            clonedIdea.setCreatedBy(profileId);

            ideaToSave = clonedIdea;
        }

        Idea savedIdea = this.ideaRepository.save(ideaToSave);

        return new IdeaDTO(savedIdea);
    }

    public List<JobDTO> getJobs(UUID profileId, Integer step, Object[] tOffset) {
        return this.jobRepository.findJobsByProfile(
                profileId, 20, step != null ? step : 5,
                tOffset);
    }

    public JobDTO saveJob(UUID profileId, UUID jobId, Job job) {
        Job jobToSave;
        if (jobId != null) {
            Optional<Job> jobResult = this.jobRepository
                    .findById(jobId);
            Job jobEntity = jobResult.get();

            Job clonedJob = JsonUtil.clone(job, objectMapper);
            clonedJob.setId(jobEntity.getId());
            clonedJob.setName(jobEntity.getName());
            clonedJob.setCreatedDate(jobEntity.getCreatedDate());
            clonedJob.setCreatedBy(jobEntity.getCreatedBy());
            jobToSave = clonedJob;
        } else {
            Job clonedJob = JsonUtil.clone(job, objectMapper);
            clonedJob.setId(UUID.randomUUID());
            clonedJob.setCreatedDate(new Date());
            clonedJob.setCreatedBy(profileId);
            jobToSave = clonedJob;
        }

        Job savedJob = this.jobRepository.save(jobToSave);

        return new JobDTO(savedJob);
    }
}