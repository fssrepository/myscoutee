package com.raxim.myscoutee.profile.data.document.mongo;

import java.util.Date;
import java.util.UUID;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.format.annotation.DateTimeFormat;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

// single rate only
@Document(collection = "likes")
public class Like {

    // generate UUID in the format below:
    // _id : { $binary: $(random UUID with the lenght of 16 characters in base64
    // format), $type: "3"}
    @Id
    @JsonProperty(value = "id")
    private UUID id;

    /*
     * 'from' is the relevant profile which likes the 'to' pls. use ref tag in
     * binary type 3
     */
    @DBRef
    @JsonProperty(value = "from")
    private Profile from;

    /*
     * 'to' is the relevant profile which liked by 'from'", pls use ref tag in
     * binary type 3
     * 
     */
    @DBRef
    @JsonProperty(value = "to")
    private Profile to;

    /* the value of the 'rate' field is random between 1 and 10 */
    @JsonProperty(value = "rate")
    private Double rate;

    /* 'createdBy' is same value as from */
    @DBRef
    @JsonProperty(value = "createdBy")
    private Profile createdBy;

    /* 'createdDate' is random DateTime in the past (max. one year backward) */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    @JsonProperty(value = "createdDate")
    private Date createdDate;

    // 'distance' should not be included in the json
    // in queries there are more rows, and it will be the average, taking care of
    // the "double" flag also
    @JsonProperty(value = "distance")
    private Long distance = 1L; // 20*(20-abs(rate1-rate2)) + profile difference

    /*
     * 'ref' should not be included in the json
     */
    @JsonIgnore
    private UUID ref;

    /*
     * A (active)
     * G (for Pending records, random events can be generated)
     * D (double rate -> the relation has been rated by an other person, to suggest
     * the like)
     */
    @JsonIgnore
    private String status;

    /*
     * P (profile)
     * I (idea)
     * J (job)
     */
    @JsonProperty("type")
    private String type;

    /*
     * same value for (from, to) = (to,from), to make the ordering easier in the
     * queries,
     * it might be replaced by ObjectId, to make better indexes
     */
    @JsonIgnore
    private Long cnt;

    // Getters and Setters

    public Long getCnt() {
        return cnt;
    }

    public void setCnt(Long cnt) {
        this.cnt = cnt;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Profile getFrom() {
        return from;
    }

    public void setFrom(Profile from) {
        this.from = from;
    }

    public Profile getTo() {
        return to;
    }

    public void setTo(Profile to) {
        this.to = to;
    }

    public Double getRate() {
        return rate;
    }

    public void setRate(Double rate) {
        this.rate = rate;
    }

    public Profile getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Profile createdBy) {
        this.createdBy = createdBy;
    }

    public Date getCreatedDate() {
        return createdDate;
    }

    public void setCreatedDate(Date createdDate) {
        this.createdDate = createdDate;
    }

    public Long getDistance() {
        return distance;
    }

    public void setDistance(Long distance) {
        this.distance = distance;
    }

    public UUID getRef() {
        return ref;
    }

    public void setRef(UUID ref) {
        this.ref = ref;
    }

    @Override
    public String toString() {
        return "Like [id=" + id + ", from=" + from + ", to=" + to + "]";
    }

    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        int hashCode1 = from.hashCode() ^ to.hashCode();
        int hashCode2 = to.hashCode() ^ from.hashCode();

        result = prime * result + (hashCode1 ^ hashCode2);
        result = prime * result + ((ref == null) ? 0 : ref.hashCode());
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
        Like other = (Like) obj;
        if (from == null) {
            if (other.from != null)
                return false;
        } else if (!from.equals(other.from) && !to.equals(other.from))
            return false;
        if (to == null) {
            if (other.to != null)
                return false;
        } else if (!to.equals(other.to) && !from.equals(other.to))
            return false;
        if (ref == null) {
            if (other.ref != null)
                return false;
        } else if (!ref.equals(other.ref))
            return false;
        return true;
    }
}
