package com.raxim.myscoutee.profile.repository.mongo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

import com.raxim.myscoutee.profile.data.document.mongo.ScoreMatrix;

@RepositoryRestResource(collectionResourceRel = "score_matrices", path = "score_matrices")
public interface ScoreMatrixRepository extends MongoRepository<ScoreMatrix, UUID> {
    // Add any additional methods or custom queries if needed

    @Query("{name: ?0}")
    List<ScoreMatrix> findByName(String name);

    @Query("{name: { $in: ?0 }}")
    List<ScoreMatrix> findByNames(List<String> names);
}
