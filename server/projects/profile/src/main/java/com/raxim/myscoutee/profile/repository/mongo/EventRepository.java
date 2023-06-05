package com.raxim.myscoutee.profile.repository.mongo;

import com.mongodb.client.model.geojson.Point;
import com.raxim.myscoutee.profile.data.document.mongo.Event;
import com.raxim.myscoutee.profile.data.document.mongo.Token;
import com.raxim.myscoutee.profile.data.dto.rest.Code;
import com.raxim.myscoutee.profile.data.dto.rest.EventItem;
import com.raxim.myscoutee.profile.data.dto.rest.Feedback;
import com.raxim.myscoutee.profile.data.dto.rest.Member;
import com.raxim.myscoutee.profile.data.dto.rest.Profile;

import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RepositoryRestResource(collectionResourceRel = "events", path = "events")
public interface EventRepository extends MongoRepository<Event, UUID> {

        @Query("{'status': 'P', 'ref.$id': ?0, 'info.members.profile.$id': ?1}")
        List<Event> findPendingEvents(UUID eventId, UUID profileId);

        @Query("{'status': { $in: :#{#status} }, 'ref.$id': { $in: :#{#refIds} } }")
        List<Event> findActiveEvents(
                        @Param("status") String[] status,
                        @Param("refIds") UUID[] refIds);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "        $match: {\n" +
                                        "            $expr: \n" +
                                        "            {\n" +
                                        "                $and: [\n" +
                                        "                    {$eq: [ '$group', ?0 ] },\n" +
                                        "                    {$eq: [ '$status', 'U' ] },\n" +
                                        "                    { $gt: [ {$ifNull: [ '$createdDate', ISODate()]}, { $toDate: :#{#offset[0]} }] }, \n"
                                        +
                                        "                ]\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "    }",
                        "{\n" +
                                        "        $sort: {\n" +
                                        "            'createdDate': 1\n" +
                                        "        }\n" +
                                        "    }",
                        "{ $limit : ?1 }",
                        "{\n" +
                                        "        $replaceRoot: { \n" +
                                        "            'newRoot': { \n" +
                                        "                $mergeObjects: [{'event': '$$ROOT'}, { sortKey: { $toLong: '$createdDate' }, offset: ['$createdDate'] } ]\n"
                                        +
                                        "            }\n" +
                                        "        }\n" +
                                        "    }"
        })
        List<Event> findEventsByStatus(UUID group, int limit, String[] offset, String status);

        @Aggregation(pipeline = {
                        "{ \n" +
                                        "        $geoNear : \n" +
                                        "        { \n" +
                                        "            near : ?1, \n" +
                                        "            spherical     : true, \n" +
                                        "            minDistance   : :#{#offset[0]}, \n" +
                                        "            distanceField : 'distance', \n" +
                                        "            distanceMultiplier: 0.001, \n" +
                                        "            query         : { 'status': 'R', 'group': ?4 } \n" +
                                        "        } \n" +
                                        "    }",

                        "{ \n" +
                                        "        $match: { \n" +
                                        "            $expr: { \n" +
                                        "                $and: [ \n" +
                                        "                    {$gt: [ {$ifNull: [ '$createdDate', ISODate()]}, { $toDate: :#{#offset[1]} }]}, \n"
                                        +
                                        "                ] \n" +
                                        "            } \n" +
                                        "        } \n" +
                                        "    }",

                        "{ \n" +
                                        "        $addFields: { \n" +
                                        "            'groupKey': {$multiply: [{$floor : [{$divide : ['$distance', ?3]}]}, ?3]}, \n"
                                        +
                                        "        } \n" +
                                        "    }",

                        "{ \n" +
                                        "        $sort: { \n" +
                                        "            'groupKey': 1, 'distance': 1, 'createdDate': -1\n" +
                                        "        } \n" +
                                        "    }",

                        "{ $limit : ?2 }",

                        "{ \n" +
                                        "        $replaceRoot: {  \n" +
                                        "            'newRoot': {  \n" +
                                        "                $mergeObjects: [{'event': '$$ROOT'}, { groupKey: '$groupKey', offset: ['$distance', '$createdDate'] } ] \n"
                                        +
                                        "            } \n" +
                                        "        } \n" +
                                        "    }"
        })
        List<Event> findEventsByProfile(UUID currentId, Point loc, int limit, int step, UUID groupId, Object[] offset);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "        $match: {\n" +
                                        "            'info.members' : { $elemMatch: { 'profile.$id': ?0, 'status': :#{#status} } }\n"
                                        +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $match: {\n" +
                                        "            $expr: \n" +
                                        "            {\n" +
                                        "                $and: [\n" +
                                        "                    {$gte: [ '$info.range.start', { $toDate: :#{#offset[0]}} ] },\n"
                                        +
                                        "                    {$gt: [ '$createdDate', { $toDate: :#{#offset[1]} }] },\n"
                                        +
                                        "                    {$in: [ '$status', :#{#evtStatus} ] },\n" +
                                        "                ]\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $sort: {\n" +
                                        "            'info.range.start': 1, 'createdDate': -1\n" +
                                        "        }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "        $addFields: {\n" +
                                        "            'groupKey': {\n" +
                                        "                $dateToString: {\n" +
                                        "                    format: ?3,\n" +
                                        "                    date: '$info.range.start'\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $addFields: {\n" +
                                        "            'user': { $first : {\n" +
                                        "                        $filter: {\n" +
                                        "                            input: '$info.members',\n" +
                                        "                            as: 'member',\n" +
                                        "                            cond: { $and: [" +
                                        "                                        {$eq: [ '$$member.profile.$id', ?0 ] },\n"
                                        +
                                        "                                        {$eq: [ '$$member.status', 'A' ] }\n" +
                                        "                                    ]\n" +
                                        "                            }\n" +
                                        "                        }\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "    }",

                        "{\n" +
                                        "        $replaceRoot: { \n" +
                                        "            'newRoot': { \n" +
                                        "                $mergeObjects: [{'event': '$$ROOT'}, { groupKey: '$groupKey', role: { $cond: [ {$ifNull: ['$user', null] }, '$user.role', null ] }, isPromotion: { $cond: [ {$ifNull: ['$ref', false] }, true, false ] }, sortKey: {$toLong: '$info.range.start'}, offset: ['$info.range.start', '$createdDate'] } ]\n"
                                        +
                                        "            }\n" +
                                        "        }\n" +
                                        "}"
        })
        List<Event> findEventDown(UUID currentId, int limit, int step, String format, String[] eventStatus,
                        String[] offset, String status);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "        $match: {\n" +
                                        "            'info.members' : { $elemMatch: { 'profile.$id': ?0, 'status': :#{#status} } }\n"
                                        +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $match: {\n" +
                                        "            $expr: \n" +
                                        "            {\n" +
                                        "                $and: [\n" +
                                        "                    {$lt: [ '$info.range.start', { $toDate: :#{#offset[0]}} ] },\n"
                                        +
                                        "                    {$gt: [ '$createdDate', { $toDate: :#{#offset[1]} }] },\n"
                                        +
                                        "                    {$in: [ '$status', :#{#evtStatus} ] },\n" +
                                        "                ]\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $sort: {\n" +
                                        "            'info.range.start': 1, 'createdDate': -1\n" +
                                        "        }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "        $addFields: {\n" +
                                        "            'groupKey': {\n" +
                                        "                $dateToString: {\n" +
                                        "                    format: ?3,\n" +
                                        "                    date: '$info.range.start'\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $addFields: {\n" +
                                        "            'user': { $first : {\n" +
                                        "                        $filter: {\n" +
                                        "                            input: '$info.members',\n" +
                                        "                            as: 'member',\n" +
                                        "                            cond: { $and: [" +
                                        "                                        {$eq: [ '$$member.profile.$id', ?0 ] },\n"
                                        +
                                        "                                        {$eq: [ '$$member.status', 'A' ] }\n" +
                                        "                                    ]\n" +
                                        "                            }\n" +
                                        "                        }\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "    }",

                        "{\n" +
                                        "        $replaceRoot: { \n" +
                                        "            'newRoot': { \n" +
                                        "                $mergeObjects: [{'event': '$$ROOT'}, { groupKey: '$groupKey', role: { $cond: [ {$ifNull: ['$user', null] }, '$user.role', null ] }, isPromotion: { $cond: [ {$ifNull: ['$ref', false] }, true, false ] }, sortKey: {$toLong: '$info.range.start'}, offset: ['$info.range.start', '$createdDate'] } ]\n"
                                        +
                                        "            }\n" +
                                        "        }\n" +
                                        "}"
        })
        List<Event> findEventUp(UUID currentId, int limit, int step, String format, String[] eventStatus,
                        String[] offset, String status);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        'info.members' : { $elemMatch: { 'profile.$id': ?0, 'status': :#{#status} } }\n"
                                        +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: \n" +
                                        "        {\n" +
                                        "            $and: [\n" +
                                        "                {\n" +
                                        "                    $or: [\n" +
                                        "                        {\n" +
                                        "                            $and: [\n" +
                                        "                                {$gte: ['$info.range.start', {$toDate: :#{#offset[0]}}]},\n"
                                        +
                                        "                                {$lt: ['$info.range.start', {$toDate: :#{#until}}]},\n"
                                        +
                                        // " {$gt: ['$createdDate', {$toDate: :#{#offset[1]}}]},\n" +
                                        "                            ]\n" +
                                        "                        },\n" +
                                        "                        {\n" +
                                        "                            $and: [\n" +
                                        "                                {$lte: ['$info.range.start', {$toDate: :#{#offset[0]}}]},\n"
                                        +
                                        "                                {$gt: ['$info.range.end', {$toDate: :#{#offset[0]}}]},\n"
                                        +
                                        // " {$gt: ['$createdDate', {$toDate: :#{#offset[1]}}]},\n" +
                                        "                            ]\n" +
                                        "                        }\n" +
                                        "                    ]\n" +
                                        "                },\n" +
                                        "                {$in: ['$status', :#{#evtStatus}]},\n" +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $sort: {\n" +
                                        "        'info.range.start': 1, 'createdDate': -1\n" +
                                        "    }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'groupKey': {\n" +
                                        "            $dateToString: {\n" +
                                        "                format: ?3,\n" +
                                        "                date: {$toDate: :#{#offset[0]}}\n" +
                                        "            }\n" +
                                        "        },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'user': { $first: {\n" +
                                        "            $filter: {\n" +
                                        "                input: '$info.members',\n" +
                                        "                as: 'member',\n" +
                                        "                cond: { $and: [\n" +
                                        "                    {$eq: ['$$member.profile.$id', ?0]},\n" +
                                        "                    {$eq: ['$$member.status', 'A']}\n" +
                                        "                ]}\n" +
                                        "            }\n" +
                                        "        }},\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $replaceRoot: { \n" +
                                        "        'newRoot': { \n" +
                                        "            $mergeObjects: [{'event': '$$ROOT'}, { groupKey: '$groupKey', role: { $cond: [ {$ifNull: ['$user', null]}, '$user.role', null ] }, isPromotion: { $cond: [ {$ifNull: ['$ref', false]}, true, false ] }, sortKey: {$toLong: '$info.range.start'}, offset: [{$toDate: :#{#offset[0]}}, '$createdDate'] } ]\n"
                                        +
                                        "        }\n" +
                                        "    }\n" +
                                        "}"
        })
        public List<Event> findEventByMonth(UUID currentId, int limit, int step, String format,
                        @Param("evtStatus") String[] eventStatus, @Param("until") Object until,
                        @Param("offset") String[] offset, @Param("status") String status);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        'info.members' : { $elemMatch: { 'profile.$id': ?0, 'status': :#{#status} } }\n"
                                        +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: \n" +
                                        "        {\n" +
                                        "            $and: [\n" +
                                        "                {$gt: ['$info.range.start', {$toDate: :#{#offset[0]}}]},\n" +
                                        "                {$gt: ['$createdDate', {$toDate: :#{#offset[1]}}]},\n" +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup:\n" +
                                        "    {\n" +
                                        "        from: 'profiles',\n" +
                                        "        let: { p_id: '$info.members.profile.$id' },\n" +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $in: [\n" +
                                        "                            '$_id',\n" +
                                        "                            '$$p_id'\n" +
                                        "                        ]\n" +
                                        "                    }\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        ],\n" +
                                        "        as: 'profiles',\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: { path: '$profiles' }\n" +
                                        "}",

                        "{\n" +
                                        "    $group: {\n" +
                                        "        '_id': '$profiles._id',\n" +
                                        "        'createdDate': {\n" +
                                        "            $min: '$createdDate'\n" +
                                        "        },\n" +
                                        "        'startDate': {\n" +
                                        "            $max: '$info.range.start'\n" +
                                        "        },\n" +
                                        "        data: { '$first': '$profiles' },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: {\n" +
                                        "            $and: [\n" +
                                        "               {$ne: ['$_id', ?0]},\n" +
                                        "               {$gt: ['$data.createdDate', {$toDate: :#{#offset[2]}}]}\n" +
                                        "            ]\n" +
                                        "        },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $sort: {\n" +
                                        "        'startDate': 1, 'createdDate': 1, 'data.createdDate': -1\n" +
                                        "    }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'groupKey': {\n" +
                                        "            $dateToString: {\n" +
                                        "                format: '%Y-%m-%d',\n" +
                                        "                date: '$startDate'\n" +
                                        "            }\n" +
                                        "        },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $replaceRoot: { \n" +
                                        "        'newRoot': { \n" +
                                        "            $mergeObjects: [{'profile': '$data'}, { groupKey: '$groupKey', offset: ['$startDate', '$createdDate', '$data.createdDate'] } ]\n"
                                        +
                                        "        }\n" +
                                        "    }\n" +
                                        "}"
        })
        public List<Profile> findProfileByEvent(UUID currentId, int limit, int step, @Param("offset") Object[] offset,
                        @Param("status") String status);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        '_id': ?0\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup: {\n" +
                                        "        from: 'items',\n" +
                                        "        localField: 'items.$id',\n" +
                                        "        foreignField: '_id',\n" +
                                        "        as: 'items'\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$items'\n" +
                                        "}",

                        "{\n" +
                                        "    $group: {\n" +
                                        "        '_id': '$items._id',\n" +
                                        "        data: { '$first': '$items' },\n" +
                                        "        evt: { '$first': '$$ROOT' },\n" +
                                        "        positions: { '$first': '$positions' },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: \n" +
                                        "        {\n" +
                                        "            $and: [\n" +
                                        "                {$eq: ['$data.status', 'A'] },\n" +
                                        "                {$gt: ['$data.range.start', {$toDate: :#{#offset[0]}}] },\n" +
                                        "                {$gt: [{$ifNull: ['$data.createdDate', ISODate()]}, {$toDate: :#{#offset[1]}}] },\n"
                                        +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $sort: {\n" +
                                        "        'data.range.start': 1, 'data.createdDate': 1\n" +
                                        "    }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'groupKey': {\n" +
                                        "            $dateToString: {\n" +
                                        "                format: ?3,\n" +
                                        "                date: '$data.range.start'\n" +
                                        "            }\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'member': { $first : {\n" +
                                        "            $filter: {\n" +
                                        "                input: '$data.members',\n" +
                                        "                as: 'member',\n" +
                                        "                cond: {\n" +
                                        "                    $and: [\n" +
                                        "                        {$eq: ['$$member.profile.$id', ?4]},\n" +
                                        "                        {$eq: ['$$member.status', 'A']}\n" +
                                        "                    ]\n" +
                                        "                }\n" +
                                        "            }\n" +
                                        "        }},\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'user': { $first : {\n" +
                                        "            $filter: {\n" +
                                        "                input: '$evt.info.members',\n" +
                                        "                as: 'member',\n" +
                                        "                cond: {\n" +
                                        "                    $and: [\n" +
                                        "                        {$eq: ['$$member.profile.$id', ?4]},\n" +
                                        "                        {$eq: ['$$member.status', 'A']}\n" +
                                        "                    ]\n" +
                                        "                }\n" +
                                        "            }\n" +
                                        "        }},\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $replaceRoot: { \n" +
                                        "        'newRoot': { \n" +
                                        "            $mergeObjects: [{'item': '$data'}, { groupKey: '$groupKey', role: { $cond: [ {$ifNull: ['$user', null]}, '$user.role', null ] }, isPromotion: { $cond: [ {$ifNull: ['$evt.ref', false]}, true, false ] }, sortKey: { $toLong: '$data.createdDate' }, isMember: { $cond: [ {$ifNull: ['$member', false]}, true, false ] }, category: '$evt.info.category', main: { $cond: [ { $eq: ['$evt.info._id', '$data._id'] }, true, false] }, positions: { $cond: [ { $eq: ['$evt.info._id', '$data._id'] }, '$positions', null] }, offset: ['$data.range.start', '$data.createdDate'] } ]\n"
                                        +
                                        "        }\n" +
                                        "    }\n" +
                                        "}"
        })
        public List<EventItem> findItemsByEvent(UUID eventId, int limit, int step, String format, UUID profileId,
                        @Param("offset") Object[] offset);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        '_id': ?0\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup: {\n" +
                                        "        from: 'feedbacks',\n" +
                                        "        localField: 'feedbacks.$id',\n" +
                                        "        foreignField: '_id',\n" +
                                        "        as: 'feedbacks'\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$feedbacks'\n" +
                                        "}",

                        "{\n" +
                                        "    $group: {\n" +
                                        "        '_id': '$feedbacks._id',\n" +
                                        "        data: { '$first': '$feedbacks' },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: \n" +
                                        "        {\n" +
                                        "            $gt: [ {$ifNull: ['$data.createdDate', ISODate()]}, {$toDate: :#{#offset[0]}}],\n"
                                        +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $sort: {\n" +
                                        "        'data.createdDate': -1\n" +
                                        "    }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "    $replaceRoot: { \n" +
                                        "        'newRoot': { \n" +
                                        "            $mergeObjects: [{'feedback': '$data'}, { offset: ['$data.createdDate'] } ]\n"
                                        +
                                        "        }\n" +
                                        "    }\n" +
                                        "}"
        })
        public List<Feedback> findFeedbacksByEvent(UUID eventId, int limit, int step, @Param("offset") Object[] offset);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        '_id': ?0\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $addFields: {\n" +
                                        "        'user': { $first : {\n" +
                                        "                    $filter: {\n" +
                                        "                        input: '$info.members',\n" +
                                        "                        as: 'member',\n" +
                                        "                        cond: { $and: [" +
                                        "                                    {$eq: ['$$member.profile.$id', ?3]},\n" +
                                        "                                    {$eq: ['$$member.status', 'A']}\n" +
                                        "                                ]\n" +
                                        "                        }\n" +
                                        "                    }\n" +
                                        "            }\n" +
                                        "        },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$info.members'\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup:\n" +
                                        "    {\n" +
                                        "        from: 'profiles',\n" +
                                        "        let: { 'p_id': '$info.members.profile.$id', 'p_members' : '$info.members' },\n"
                                        +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $eq: ['$$p_id', '$_id']\n" +
                                        "                    }\n" +
                                        "                },\n" +
                                        "            },\n" +
                                        "            {\n" +
                                        "                $project: {\n" +
                                        "                    '_id' : '$$p_members._id',\n" +
                                        "                    'profile': '$$ROOT',\n" +
                                        "                    'createdDate': '$$p_members.createdDate',\n" +
                                        "                    'status': '$$p_members.status'\n" +
                                        "                }\n" +
                                        "            }\n" +
                                        "        ],\n" +
                                        "        as: 'profiles',\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$profiles'\n" +
                                        "}",

                        "{\n" +
                                        "    $group: {\n" +
                                        "        '_id': '$profiles._id',\n" +
                                        "        data: {\n" +
                                        "            $first: '$profiles'\n" +
                                        "        },\n" +
                                        "        user: {" +
                                        "            $first: '$user'\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: \n" +
                                        "        {\n" +
                                        "            $and: [\n" +
                                        "                {$gt: [ {$ifNull: ['$data.createdDate', ISODate()]}, {$toDate: :#{#offset[1]}}] },\n"
                                        +
                                        "                {$in: ['$data.status', :#{#status}] },\n" +
                                        "                {$gte: ['$data.status', :#{#offset[0]}] }\n" +
                                        "            ]\n" +
                                        "        },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $sort: {\n" +
                                        "        'data.status': 1, 'data.createdDate': -1\n" +
                                        "    }\n" +
                                        "}",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "    $replaceRoot: { \n" +
                                        "        'newRoot': { \n" +
                                        "            $mergeObjects: [{'member': '$data'}, { role: { $cond: [ {$ifNull: ['$user', null] }, '$user.role', null ] }, offset: ['$data.status', '$data.createdDate'] } ]\n"
                                        +
                                        "        }\n" +
                                        "    }\n" +
                                        "}"
        })
        public List<Member> findMembersByEvent(UUID eventId, int limit, int step, UUID profileId, String[] status,
                        Object[] offset);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        '_id': ?0\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup: {\n" +
                                        "        from: 'likes',\n" +
                                        "        let: { 'p_id': '_id' },\n" +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $and: [\n" +
                                        "                            { $eq: [ '$$p_id', '$ref' ] },\n" +
                                        "                        ]\n" +
                                        "                    }\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        ],\n" +
                                        "        as: 'likes'\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: { path: '$likes', preserveNullAndEmptyArrays: true }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: {\n" +
                                        "            $and: [\n" +
                                        "                { $ne: [ '$likes.from.$id', ?3 ] },\n" +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup: {\n" +
                                        "        from: 'profiles',\n" +
                                        "        let: { 'p_id': '$likes.from.$id', 'g_id': '$group.$id' },\n" +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $and: [\n" +
                                        "                            { $eq: [ '$$g_id', '$group' ] },\n" +
                                        "                            { $eq: [ '$$p_id', '$_id' ] },\n" +
                                        "                        ]\n" +
                                        "                    }\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        ],\n" +
                                        "        as: 'profiles'\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: { path: '$profiles' }\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup: {\n" +
                                        "        from: 'likes',\n" +
                                        "        let: { 'p_id': '$profiles._id', 'e_id': '$events._id' },\n" +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $and: [\n" +
                                        "                            { $eq: [ '$$p_id', '$to.$id' ] },\n" +
                                        "                            { $eq: [ '$$e_id', '$ref' ] },\n" +
                                        "                        ]\n" +
                                        "                    }\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        ],\n" +
                                        "        as: 'likes'\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: { path: '$likes', preserveNullAndEmptyArrays: true }\n" +
                                        "}",

                        "{\n" +
                                        "    $group: {\n" +
                                        "        '_id': '$profiles._id',\n" +
                                        "        'data': { '$first': '$profiles' },\n" +
                                        "        'ref': { '$first': '$events._id' },\n" +
                                        "        'rate': { '$first': { $ifNull: [ '$likes.rate', 0 ] } },\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: {\n" +
                                        "            $and: [\n" +
                                        "                { $lte: [ '$rate', :#{#offset[0]} ] },\n" +
                                        "                { $gt: [ { $ifNull: [ '$data.createdDate', ISODate() ] }, { $toDate: :#{#offset[1]} } ] },\n"
                                        +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $sort: {\n" +
                                        "        'rate': -1,\n" +
                                        "        'data.createdDate': 1\n" +
                                        "    }\n" +
                                        "}",

                        "{ $limit: ?1 }",

                        "{\n" +
                                        "    $replaceRoot: {\n" +
                                        "        'newRoot': {\n" +
                                        "            $mergeObjects: [\n" +
                                        "                { 'profile': '$data' },\n" +
                                        "                { ref: '$ref', rate: '$rate', offset: ['$rate', '$data.createdDate'] }\n"
                                        +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    }\n" +
                                        "}"
        })
        // TODO: order events by info.range.start at 'unwind' events
        public List<Profile> findProfilesByPromotion(
                        UUID eventId,
                        int limit,
                        int step,
                        UUID profileId,
                        @Param("offset") Object[] offset);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "        $match: {\n" +
                                        "            '_id': ?0\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $match: {\n" +
                                        "            'info.members' : { $elemMatch: { 'code': ?1 } }\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $unwind: '$info.members'\n" +
                                        "}",

                        "{\n" +
                                        "        $lookup:\n" +
                                        "        {\n" +
                                        "            from: 'profiles',\n" +
                                        "            let: { 'p_id': '$info.members.profile.$id', 'p_members' : '$info.members' },\n"
                                        +
                                        "            pipeline: [\n" +
                                        "                {\n" +
                                        "                    $match: {\n" +
                                        "                        $expr: {\n" +
                                        "                            $eq: ['$$p_id', '$_id']\n" +
                                        "                        }\n" +
                                        "                    },\n" +
                                        "                },\n" +
                                        "                {\n" +
                                        "                    $project: {\n" +
                                        "                        '_id' : '$$p_members._id',\n" +
                                        "                        'profile': '$$ROOT',\n" +
                                        "                        'createdDate': '$$p_members.createdDate',\n" +
                                        "                        'status': '$$p_members.status'\n" +
                                        "                    }\n" +
                                        "                }\n" +
                                        "            ],\n" +
                                        "            as: 'profiles',\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $unwind: '$profiles'\n" +
                                        "}",

                        "{\n" +
                                        "        $group: {\n" +
                                        "            '_id': '$profiles._id',\n" +
                                        "            data: {\n" +
                                        "                $first: '$profiles'\n" +
                                        "            }\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $replaceRoot: { \n" +
                                        "            'newRoot': {'member': '$data'}\n" +
                                        "        }\n" +
                                        "}"
        })
        public Optional<Member> findMemberByCode(UUID eventId, String code);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "        $match: {\n" +
                                        "            '_id': ?0\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $match: {\n" +
                                        "            'info.members' : { $elemMatch: { 'profile.$id': ?1 } }\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $unwind: '$info.members'\n" +
                                        "}",

                        "{\n" +
                                        "        $group: {\n" +
                                        "            '_id': '$info.members._id',\n" +
                                        "            data: {\n" +
                                        "                $first: '$info.members.code'\n" +
                                        "            }\n" +
                                        "        }\n" +
                                        "}",

                        "{\n" +
                                        "        $replaceRoot: {\n" +
                                        "            'newRoot': {'code': '$data'}\n" +
                                        "        }\n" +
                                        "}"
        })
        public Optional<Code> findCodeByEvent(UUID eventId, UUID userUid);

        @Aggregation(pipeline = {
                        "{ \n" +
                                        "                            $lookup: \n" +
                                        "                            { \n" +
                                        "                                from: 'likes', \n" +
                                        "                                let: { 'p_id': '$_id' }, \n" +
                                        "                                pipeline: [ \n" +
                                        "                                    { \n" +
                                        "                                        $match: { \n" +
                                        "                                            $expr: { \n" +
                                        "                                                $and: [\n" +
                                        "                                                    {$eq: [ '$from.$id', ?0 ]},\n"
                                        +
                                        "                                                    {$eq: [ '$$p_id', '$ref' ]},\n"
                                        +
                                        "                                                ] \n" +
                                        "                                            } \n" +
                                        "                                        } \n" +
                                        "                                    },\n" +
                                        "                                ], \n" +
                                        "                                as: 'likes', \n" +
                                        "                            } \n" +
                                        "                    }",

                        "{ \n" +
                                        "                $unwind: { path: '$likes'} \n" +
                                        "            }",

                        "{\n" +
                                        "        $match: {\n" +
                                        "            $expr: \n" +
                                        "            {\n" +
                                        "                $and: [\n" +
                                        "                    {$gte: [ '$info.range.start', { $toDate: :#{#offset[0]} } ] },\n"
                                        +
                                        "                    {$lte: [ '$likes.rate', :#{#offset[1]} ] },\n" +
                                        "                    {$gt: [ '$createdDate', { $toDate: :#{#offset[2]} }] },\n"
                                        +
                                        "                ]\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "    }",

                        "{\n" +
                                        "        $sort: {\n" +
                                        "            'info.range.start': 1, 'likes.rate': -1 , 'createdDate': 1\n" +
                                        "        }\n" +
                                        "    }",

                        "{ $limit : ?1 }",

                        "{\n" +
                                        "        $addFields: {\n" +
                                        "            'groupKey': {\n" +
                                        "                $dateToString: {\n" +
                                        "                    format: ?3,\n" +
                                        "                    date: '$info.range.start'\n" +
                                        "                }\n" +
                                        "            },\n" +
                                        "        }\n" +
                                        "    }",

                        "{\n" +
                                        "        $replaceRoot: { \n" +
                                        "            'newRoot': { \n" +
                                        "                $mergeObjects: [{'event': '$$ROOT'}, { groupKey: '$groupKey', rate: '$likes.rate', sortKey: { $toLong: '$info.range.start' }, offset: ['$info.range.start', '$likes.rate', '$createdDate'] } ]\n"
                                        +
                                        "            }\n" +
                                        "        }\n" +
                                        "    }"
        })
        public List<Event> findEventsByRated(UUID currentId, int limit, int step, String format, Object[] offset);

        @Aggregation(pipeline = {
                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: {\n" +
                                        "            $and: [\n" +
                                        "                {$in: [ '$_id', :#{#eventIds} ] }\n" +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    },\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$info.members'\n" +
                                        "}",

                        "{\n" +
                                        "    $match: {\n" +
                                        "        $expr: {\n" +
                                        "            $or: [\n" +
                                        "                {$eq: [ '$info.members.status', 'A'] }\n" +
                                        "                {$eq: [ '$info.members.status', 'I'] }\n" +
                                        "            ]\n" +
                                        "        }\n" +
                                        "    },\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup:\n" +
                                        "    {\n" +
                                        "        from: 'profiles',\n" +
                                        "        let: { 'p_id': '$info.members.profile.$id', 'p_members' : '$info.members' },\n"
                                        +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $and: [\n" +
                                        "                            {$eq: ['$$p_id', '$_id']},\n" +
                                        "                            {$eq: [ '$status', 'A']}\n" +
                                        "                        ]\n" +
                                        "                    }\n" +
                                        "                },\n" +
                                        "            },\n" +
                                        "        ],\n" +
                                        "        as: 'profiles',\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$profiles'\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup:\n" +
                                        "    {\n" +
                                        "        from: 'users',\n" +
                                        "        let: { 'p_id': '$profiles._id' },\n" +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $in: ['$$p_id', '$profiles.$id']\n" +
                                        "                    }\n" +
                                        "                },\n" +
                                        "            }\n" +
                                        "        ],\n" +
                                        "        as: 'users',\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$users'\n" +
                                        "}",

                        "{\n" +
                                        "    $lookup:\n" +
                                        "    {\n" +
                                        "        from: 'tokens',\n" +
                                        "        let: { 'u_id': '$users._id' },\n" +
                                        "        pipeline: [\n" +
                                        "            {\n" +
                                        "                $match: {\n" +
                                        "                    $expr: {\n" +
                                        "                        $eq: ['$$u_id', '$uuid']\n" +
                                        "                    }\n" +
                                        "                },\n" +
                                        "            }\n" +
                                        "        ],\n" +
                                        "        as: 'tokens',\n" +
                                        "    }\n" +
                                        "}",

                        "{\n" +
                                        "    $unwind: '$tokens'\n" +
                                        "}",

                        "{ \n" +
                                        "    $replaceRoot: {  \n" +
                                        "        'newRoot': '$tokens' \n" +
                                        "    } \n" +
                                        "}"
        })
        public List<Token> findTokensByEvent(@Param("eventIds") UUID[] eventId);
}