package com.raxim.myscoutee.profile.controller;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raxim.myscoutee.common.util.CommonUtil;
import com.raxim.myscoutee.common.util.JsonUtil;
import com.raxim.myscoutee.profile.data.document.mongo.Feedback;
import com.raxim.myscoutee.profile.data.dto.rest.FeedbackDTO;
import com.raxim.myscoutee.profile.data.dto.rest.PageDTO;
import com.raxim.myscoutee.profile.repository.mongo.EventRepository;
import com.raxim.myscoutee.profile.repository.mongo.FeedbackRepository;

@RestController
@RequestMapping("history")
public class EventFeedbackRestController {
    private final EventRepository eventRepository;
    private final FeedbackRepository feedbackRepository;
    private final ObjectMapper objectMapper;

    public EventFeedbackRestController(EventRepository eventRepository,
            FeedbackRepository feedbackRepository,
            ObjectMapper objectMapper) {
        this.eventRepository = eventRepository;
        this.feedbackRepository = feedbackRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping(value = { "events/{id}/feedbacks", "invitations/{id}/feedbacks" })
    public ResponseEntity<PageDTO<FeedbackDTO>> feedbacks(
            @PathVariable String id,
            @RequestParam(value = "step", required = false) Integer step,
            @RequestParam(value = "offset", required = false) String[] offset) {

        Object[] tOffset;
        if (offset != null && offset.length == 1) {
            tOffset = new Object[] { CommonUtil.decode(offset[0]) };
        } else {
            tOffset = new Object[] { "1900-01-01" };
        }

        // http://dolszewski.com/spring/how-to-bind-requestparam-to-object/

        List<FeedbackDTO> feedbacks = eventRepository.findFeedbacksByEvent(
                UUID.fromString(id), 20, step != null ? step : 5,
                tOffset);

        List<Object> lOffset;
        if (!feedbacks.isEmpty()) {
            lOffset = feedbacks.get(feedbacks.size() - 1).getOffset();
        } else {
            lOffset = Arrays.asList(tOffset);
        }

        return ResponseEntity.ok(
                new PageDTO<>(feedbacks, lOffset));
    }

    @PostMapping("events/{id}/feedbacks")
    @Transactional
    public ResponseEntity<Feedback> addFeedback(
            @PathVariable String id,
            @RequestBody Feedback feedback) {
        Optional<Feedback> savedFeedback = eventRepository.findById(UUID.fromString(id)).map(event -> {
            Feedback saved = feedbackRepository.save(feedback);
            event.getFeedbacks().add(saved);
            eventRepository.save(event);
            return saved;
        });
        return savedFeedback.map(saved -> ResponseEntity.status(HttpStatus.CREATED).body(saved))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("events/{id}/feedbacks/{feedbackId}")
    @Transactional
    public ResponseEntity<Feedback> patchFeedback(
            @PathVariable String id,
            @PathVariable String feedbackId,
            @RequestBody Feedback feedback) {
        Optional<Feedback> savedFeedback = eventRepository.findById(UUID.fromString(id)).map(event -> {
            Feedback dbFeedback = event.getFeedbacks().stream()
                    .filter(f -> f.getId().equals(CommonUtil.parseUUID(feedbackId)))
                    .findFirst().orElse(null);
            if (dbFeedback != null) {
                Feedback lFeedback = JsonUtil.clone(feedback, objectMapper);
                lFeedback.setId(dbFeedback.getId());
                Feedback saved = feedbackRepository.save(lFeedback);
                event.getFeedbacks().add(saved);
                eventRepository.save(event);
                return saved;
            }
            return null;
        });
        return savedFeedback.map(saved -> ResponseEntity.status(HttpStatus.CREATED).body(saved))
                .orElse(ResponseEntity.notFound().build());
    }
}
