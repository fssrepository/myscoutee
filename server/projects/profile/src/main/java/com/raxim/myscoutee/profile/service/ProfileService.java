package com.raxim.myscoutee.profile.service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.util.Pair;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raxim.myscoutee.common.util.FileUtil;
import com.raxim.myscoutee.profile.data.document.mongo.Car;
import com.raxim.myscoutee.profile.data.document.mongo.Profile;
import com.raxim.myscoutee.profile.data.document.mongo.School;
import com.raxim.myscoutee.profile.data.dto.rest.ProfileDTO;
import com.raxim.myscoutee.profile.data.dto.rest.ProfileStatusDTO;
import com.raxim.myscoutee.profile.util.JsonUtil;
import com.raxim.myscoutee.profile.util.ProfileUtil;

//val reqGroupId = UUID.fromString(groupId)
//if (profile.group == reqGroupId) {
/*val role = this.roleRepository.findRoleByProfileAndGroup(adminEmail, groupId = reqGroupId)
    .firstOrNull { role -> role.group.id == reqGroupId && role.role == "ROLE_ADMIN" && role.status == "A" }*/
//}

@Service
public class ProfileService {

    private final ProfileRepository profileRepository;
    private final ProfileEventHandler profileEventHandler;
    private final CarRepository carRepository;
    private final CarEventHandler carEventHandler;
    private final SchoolRepository schoolRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final ObjectMapper objectMapper;

    public ProfileService(
            ProfileRepository profileRepository,
            ProfileEventHandler profileEventHandler,
            CarRepository carRepository,
            CarEventHandler carEventHandler,
            SchoolRepository schoolRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            ObjectMapper objectMapper) {
        this.profileRepository = profileRepository;
        this.profileEventHandler = profileEventHandler;
        this.carRepository = carRepository;
        this.carEventHandler = carEventHandler;
        this.schoolRepository = schoolRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.objectMapper = objectMapper;
    }

    public ProfileDTO saveProfileStatus(String profileId,
            ProfileStatusDTO profileStatus) {
        UUID uuid = UUID.fromString(profileId);
        return profileRepository.findById(uuid).map(profile -> {
            Profile profileToSave = profile.withStatus(profileStatus.getStatus());
            Profile profileSaved = profileRepository.save(profileToSave);

            List<Role> role = this.roleRepository.findRoleByProfile(profileSaved.getId());

            Role firstRole = role.get(0).withRole(profileStatus.getRole());
            this.roleRepository.save(firstRole);

            return new com.raxim.myscoutee.profile.data.dto.rest.Profile(profileSaved);
        }).orElse(null);
    }

    public ProfileDTO saveProfile(UUID userId, UUID profileId, UUID group,
            Profile profile, MultipartFile voice) {
        String fileName = UUID.randomUUID().toString();

        Pair<String, String> separatorPermDir = FileUtil.uuidToPath(fileName, true);
        String separator = separatorPermDir.getFirst();
        String permDir = separatorPermDir.getSecond();

        if (voice != null && !voice.isEmpty()) {
            InputStream voiceStream = new ByteArrayInputStream(voice.getBytes());
            voiceStream.save(permDir + separator + "_" + fileName + "_voice");
        }

        Profile profileToSave;
        if (profileId != null) {
            Optional<Profile> profileResult = this.profileRepository.findById(profileId);
            Profile profileEntity = profileResult.get();

            Profile clonedProfile = JsonUtil.clone(profile, objectMapper);
            clonedProfile.setId(profileEntity.getId());
            clonedProfile.setCars(profileEntity.getCars());
            clonedProfile.setSchools(profileEntity.getSchools());
            clonedProfile.setVoice(fileName);
            clonedProfile.setGroup(group);

            profileToSave = clonedProfile;
        } else {
            Profile clonedProfile = JsonUtil.clone(profile, objectMapper);
            clonedProfile.setId(UUID.randomUUID());
            clonedProfile.setVoice(fileName);
            clonedProfile.setGroup(group);
            
            profileToSave = clonedProfile;
        }

        Profile clonedProfileToSave = JsonUtil.clone(profileToSave, objectMapper);
        clonedProfileToSave.setScore(ProfileUtil.score(profileToSave));
        Profile profileSaved = this.profileRepository.save(clonedProfileToSave);

        this.userRepository.findById(userId).ifPresent(user -> {
            user.setProfile(profileSaved);

            user.getProfiles().add(profileSaved);
            userRepository.save(user);
        });

        this.profileEventHandler.handleAfterCreate(profileSaved);

        ProfileDTO profileDTO = new ProfileDTO();
        profileDTO.setProfile(profileSaved);
        return profileDTO;
    }

    public List<Car> getCars(UUID profileId, Integer step, Object[] tOffset) {
        int pageSize = 20;
        int defaultStep = 5;

        return this.profileRepository.findCarsByProfile(
                profileId,
                pageSize,
                step != null ? step : defaultStep,
                tOffset);
    }

    public Optional<com.raxim.myscoutee.profile.data.document.mongo.Car> getCarByProfile(UUID profileId, UUID carId) {
        return this.profileRepository.findCarByProfile(profileId, carId);
    }

    public List<School> getSchools(UUID profileId, Integer step, Object[] tOffset) {
        int pageSize = 20;
        int defaultStep = 5;

        return this.profileRepository.findSchoolsByProfile(
                profileId,
                pageSize,
                step != null ? step : defaultStep,
                tOffset);
    }

    public Optional<com.raxim.myscoutee.profile.data.document.mongo.School> getSchoolByProfile(UUID profileId,
            UUID schoolId) {
        return this.profileRepository.findSchoolByProfile(profileId, schoolId);
    }

    public Car addCar(UUID profileId, UUID carId, com.raxim.myscoutee.profile.data.document.mongo.Car newCar) {
        return this.profileRepository.findById(profileId).map(profile -> {
            com.raxim.myscoutee.profile.data.document.mongo.Car car;
            if (carId != null) {
                com.raxim.myscoutee.profile.data.document.mongo.Car dbCar = profile.getCars().stream()
                        .filter(c -> c.getId().equals(carId))
                        .findFirst()
                        .orElse(null);
                car = newCar.withId(dbCar.getId());
            } else {
                car = newCar;
            }

            com.raxim.myscoutee.profile.data.document.mongo.Car savedCar = carRepository.save(car);
            profile.getCars().add(savedCar);
            profileRepository.save(profile);
            carEventHandler.handleAfterCreate(car);
            return new Car(savedCar);
        }).orElse(null);
    }

    public List<School> saveSchools(UUID profileId,
            List<com.raxim.myscoutee.profile.data.document.mongo.School> schools) {
        return this.profileRepository.findById(profileId).map(profile -> {
            for (com.raxim.myscoutee.profile.data.document.mongo.School school : schools) {
                com.raxim.myscoutee.profile.data.document.mongo.School savedSchool = this.schoolRepository.save(school);
                boolean hasSchool = profile.getSchools().stream().anyMatch(s -> s.getId().equals(savedSchool.getId()));
                if (!hasSchool) {
                    profile.getSchools().add(savedSchool);
                }
            }
            this.profileRepository.save(profile);

            return profile.getSchools().stream().map(school -> new School(school)).toList();
        }).orElse(Collections.emptyList());
    }
}