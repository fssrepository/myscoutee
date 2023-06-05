package com.raxim.myscoutee.profile.data.document.mongo;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

/*
    1)  how many item count is (if someone clones this promotion, the number decreases)
*/

public class Slot {
    @JsonProperty(value = "range")
    private RangeLocal range;
    
    @JsonProperty(value = "numOfItems")
    private int numOfItems;
    
    @JsonProperty(value = "capacity")
    private RangeInt capacity;
    
    public Slot() {
        this.range = new RangeLocal();
        this.numOfItems = 0;
        this.capacity = new RangeInt();
    }
    
    public RangeLocal getRange() {
        return range;
    }
    
    public void setRange(RangeLocal range) {
        this.range = range;
    }
    
    public int getNumOfItems() {
        return numOfItems;
    }
    
    public void setNumOfItems(int numOfItems) {
        this.numOfItems = numOfItems;
    }
    
    public RangeInt getCapacity() {
        return capacity;
    }
    
    public void setCapacity(RangeInt capacity) {
        this.capacity = capacity;
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Slot slot = (Slot) o;
        return Objects.equals(range, slot.range);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(range);
    }
}
