package com.raxim.myscoutee.profile.repository.mongo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import com.raxim.myscoutee.profile.data.document.mongo.Token;

public interface TokenRepository extends MongoRepository<Token, UUID>{

    @Query("{deviceKey: ?0}")
    Token findByDeviceId(String deviceId);

    @Query("{uuid: { $in: ?0 }}")
    List<Token> findByUserIds(List<UUID> uuids);
}
