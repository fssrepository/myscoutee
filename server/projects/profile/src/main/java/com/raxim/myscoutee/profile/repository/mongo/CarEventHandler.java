package com.raxim.myscoutee.profile.repository.mongo;

import com.raxim.myscoutee.common.FileUtil;
import com.raxim.myscoutee.profile.data.document.mongo.Car;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.data.rest.core.annotation.*;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
@RepositoryEventHandler(Car.class)
public class CarEventHandler {
    private final Log logger = LogFactory.getLog(getClass());

    @HandleBeforeSave
    @HandleBeforeCreate
    public void handleBeforeCreate(Car car) {
        //val qProfile = QProfile("profile")
        logger.info("Handle Car Before Create....");
    }

    @HandleAfterSave
    @HandleAfterCreate
    public void handleAfterCreate(Car car) {
        if (car.getImages() != null) {
            car.getImages().forEach(img -> {
                String fileName = img.getName();
                delete(fileName);
                delete(fileName, "_orig");
            });
        }

        logger.info("Handle Car After Create ....");
    }

    @HandleBeforeDelete
    public void handleBeforeDelete(Car car) {
        logger.info("Handle Car Before Delete ....");
    }

    @HandleAfterDelete
    public void handleAfterDelete(Car car) {
        logger.info("Handle Car After Delete ....");
    }

    private void delete(String fileName) {
        // Implement the delete logic for the given fileName
        // Assuming the implementation is in the FileUtil class
        FileUtil.deleteFile(fileName);
    }

    private void delete(String fileName, String suffix) {
        // Implement the delete logic for the given fileName with the specified suffix
        // Assuming the implementation is in the FileUtil class
        FileUtil.deleteFile(fileName + suffix);
    }
}
