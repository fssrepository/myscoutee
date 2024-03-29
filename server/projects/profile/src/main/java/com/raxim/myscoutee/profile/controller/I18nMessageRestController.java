package com.raxim.myscoutee.profile.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.raxim.myscoutee.profile.data.document.mongo.I18nMessage;
import com.raxim.myscoutee.profile.service.I18nMessageService;

@RestController
@RequestMapping("i18n_messages")
public class I18nMessageRestController {

    private final I18nMessageService messageService;

    public I18nMessageRestController(I18nMessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("")
    public ResponseEntity<I18nMessage> getMsg(@RequestHeader("accept-language") String locale) {
        I18nMessage message = messageService.getMessageByLang(locale);
        return ResponseEntity.ok(message);
    }
}
