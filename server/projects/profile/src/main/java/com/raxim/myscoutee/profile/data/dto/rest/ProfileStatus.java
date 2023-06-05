package com.raxim.myscoutee.profile.data.dto.rest;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ProfileStatus {
    @JsonProperty(value = "status")
    private String status;

    @JsonProperty(value = "role")
    private String role;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
