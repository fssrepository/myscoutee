package com.raxim.myscoutee.profile.repository.mongo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.raxim.myscoutee.profile.data.document.mongo.Idea;
import com.raxim.myscoutee.profile.data.dto.rest.IdeaDTO;

@Repository
public interface IdeaRepository extends MongoRepository<Idea, UUID> {

    @Aggregation(pipeline = "findIdeasByProfile")
    List<IdeaDTO> findIdeasByProfile(
            @Param("profileId") UUID profileId,
            @Param("limit") int limit,
            @Param("step") int step,
            @Param("offset") Object[] offset);

}