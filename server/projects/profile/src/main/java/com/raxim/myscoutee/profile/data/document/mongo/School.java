package com.raxim.myscoutee.profile.data.document.mongo;

import java.util.Date;
import java.util.UUID;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

@Document(collection = "schools")
public class School implements Cloneable {
    @Id
    @JsonProperty(value = "key")
    private UUID id;

    @JsonProperty(value = "type")
    private String type;

    @JsonProperty(value = "name")
    private String name;

    @JsonProperty(value = "locationKey")
    private String locationKey;

    @JsonProperty(value = "range")
    private RangeLocal range;

    @JsonProperty(value = "role")
    private String role;

    @JsonIgnore
    private Date createdDate;

    @JsonIgnore
    private String status;

    public School(RangeLocal range) {
        this.range = range;
    }

    public School() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocationKey() {
        return locationKey;
    }

    public void setLocationKey(String locationKey) {
        this.locationKey = locationKey;
    }

    public RangeLocal getRange() {
        return range;
    }

    public void setRange(RangeLocal range) {
        this.range = range;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Date getCreatedDate() {
        return createdDate;
    }

    public void setCreatedDate(Date createdDate) {
        this.createdDate = createdDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    @Override
    public Object clone()
            throws CloneNotSupportedException {
        return super.clone();
    }
}
