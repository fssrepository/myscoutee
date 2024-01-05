package com.raxim.myscoutee.profile.data.document.mongo;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

// role for event
@Document(collection = "members")
public class Member implements Cloneable, Comparable<Member> {

    public static final Set<String> MET = Set.of("A", "L", "LL", "V", "LD");

    @DBRef
    @JsonProperty(value = "profile")
    private Profile profile;

    // A (Accepted), R (rejected), I (invited), K (kicked)?? - maybe by more members
    // than one, L (left) V (Verified)
    // T (Timed-Out), LL (late leave), W (on waiting
    // list), LD (left deleted), D (deleted), P (pending), Selected (S)
    // Manager, who can add members to the event, or in priority can set up some
    // rules
    // Admin can change other parts, like add new eventItem
    @JsonProperty(value = "status")
    private String status;

    //Candidate can show interest to event creator by rating an event, (a new member record has been added)
    //The promoter can rate the candidate back, and when the capacity
    //startTime of event + gracePeriod, it will notify the candidate for success based on promoter preference (rating) - on event list screen the event will be green, anyway it will be yellow
    //you can filter by status on event screen, the members has been ordered by rate added
    //on the promoter screen, if new candidate has been arrived, it will be a notification
    //so it will be a candidate record and a user record (added when promoter rates candidate or accepts)
    // User (U), Admin (A), Promoter (P), Manager (M), Candidate (C)
    @JsonProperty(value = "role")
    private String role;

    // JsonIgnore for field - authorization who can read it
    @JsonIgnore
    private String code;

    @JsonIgnore
    private LocalDateTime createdDate;

    @JsonIgnore
    private LocalDateTime updatedDate;

    // event item ref - members will be removed from event item
    @JsonIgnore
    private UUID eventRef;

    // (it shows the maxStage, what the member reached),
    // the stage will be added to the group key before the status if it does exist
    @JsonProperty(value = "stage")
    private int stage;

    @JsonProperty(value = "score")
    private Double score = 0.0d;

    @JsonProperty(value = "result")
    private Result result;

    public Member(Profile profile) {
        this(profile, "A", "U");
    }

    public Member(Profile profile, String status, String role) {
        this.profile = profile;
        this.status = status;
        this.role = role;
    }

    public Member() {
    }

    public Profile getProfile() {
        return profile;
    }

    public void setProfile(Profile profile) {
        this.profile = profile;
    }

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

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public LocalDateTime getCreatedDate() {
        return createdDate;
    }

    public void setCreatedDate(LocalDateTime createdDate) {
        this.createdDate = createdDate;
    }

    public LocalDateTime getUpdatedDate() {
        return updatedDate;
    }

    public void setUpdatedDate(LocalDateTime updatedDate) {
        this.updatedDate = updatedDate;
    }

    public UUID getEventRef() {
        return eventRef;
    }

    public void setEventRef(UUID eventRef) {
        this.eventRef = eventRef;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(Double score) {
        this.score = score;
    }

    public Result getResult() {
        return result;
    }

    public void setResult(Result result) {
        this.result = result;
    }

    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        result = prime * result + ((profile == null) ? 0 : profile.hashCode());
        return result;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj)
            return true;
        if (obj == null)
            return false;
        if (getClass() != obj.getClass())
            return false;
        Member other = (Member) obj;
        if (profile == null) {
            if (other.profile != null)
                return false;
        } else if (!profile.equals(other.profile))
            return false;
        return true;
    }

    public int getStage() {
        return stage;
    }

    public void setStage(int stage) {
        this.stage = stage;
    }

    @Override
    public Object clone()
            throws CloneNotSupportedException {
        return super.clone();
    }

    @Override
    public int compareTo(Member m2) {
        int scoresComparison = m2.score.compareTo(this.score);
        if (scoresComparison != 0) {
            return scoresComparison;
        }

        if (result != null && m2.result != null) {
            int resultComparision = this.result.compareTo(m2.result);
            if (resultComparision != 0) {
                return resultComparision;
            }
        }
        return m2.createdDate.compareTo(this.createdDate);
    }

}
