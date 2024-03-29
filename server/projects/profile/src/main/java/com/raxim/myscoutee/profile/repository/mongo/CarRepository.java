package com.raxim.myscoutee.profile.repository.mongo;

import java.util.UUID;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

import com.raxim.myscoutee.profile.data.document.mongo.Car;

@RepositoryRestResource(collectionResourceRel = "cars", path = "cars")
public interface CarRepository extends MongoRepository<Car, UUID> {
    // Add any additional methods or custom queries if needed
}
