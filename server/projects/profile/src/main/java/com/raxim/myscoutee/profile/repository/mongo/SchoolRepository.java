package com.raxim.myscoutee.profile.repository.mongo;

import com.raxim.myscoutee.profile.data.document.mongo.School;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.querydsl.QuerydslPredicateExecutor;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;
import java.util.UUID;

@RepositoryRestResource(
    collectionResourceRel = "schools",
    path = "schools"
)
public interface SchoolRepository extends MongoRepository<School, UUID>,
    QuerydslPredicateExecutor<School> {
}
