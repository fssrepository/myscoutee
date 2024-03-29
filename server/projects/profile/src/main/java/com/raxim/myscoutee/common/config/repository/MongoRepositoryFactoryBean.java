package com.raxim.myscoutee.common.config.repository;

import java.io.IOException;
import java.io.Serializable;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.bson.Document;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.core.support.RepositoryFactoryBeanSupport;
import org.springframework.data.repository.core.support.RepositoryFactorySupport;
import org.springframework.lang.Nullable;
import org.springframework.util.Assert;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

public class MongoRepositoryFactoryBean<T extends Repository<S, ID>, S, ID extends Serializable>
		extends RepositoryFactoryBeanSupport<T, S, ID> {

	private static final String PARAM_REGEX = "\"([:|\\?|I|M][^ ].*?)\"";

	private @Nullable MongoOperations operations;
	private boolean createIndexesForQueryMethods = false;
	private boolean mappingContextConfigured = false;

	public MongoRepositoryFactoryBean(Class<? extends T> repositoryInterface) {
		super(repositoryInterface);
	}

	public void setMongoOperations(MongoOperations operations) {
		this.operations = operations;
	}

	public void setCreateIndexesForQueryMethods(boolean createIndexesForQueryMethods) {
		this.createIndexesForQueryMethods = createIndexesForQueryMethods;
	}

	@Override
	public void setMappingContext(MappingContext<?, ?> mappingContext) {

		super.setMappingContext(mappingContext);
		this.mappingContextConfigured = true;
	}

	@Override
	protected RepositoryFactorySupport createRepositoryFactory() {

		Map<String, String[]> queryMap = loadQueries();

		RepositoryFactorySupport factory = getFactoryInstance(operations, queryMap);

		if (createIndexesForQueryMethods) {
			factory.addQueryCreationListener(
					new IndexEnsuringQueryCreationListener(
							(collectionName, javaType) -> operations.indexOps(javaType)));
		}

		return factory;
	}

	protected RepositoryFactorySupport getFactoryInstance(MongoOperations operations, Map<String, String[]> queryMap) {
		return new MongoRepositoryFactory(operations, queryMap);
	}

	@Override
	public void afterPropertiesSet() {

		super.afterPropertiesSet();
		Assert.state(operations != null, "MongoTemplate must not be null");

		if (!mappingContextConfigured) {
			setMappingContext(operations.getConverter().getMappingContext());
		}
	}

	private Map<String, String[]> loadQueries() {
		Map<String, String[]> queryMap = new HashMap<>();
		try {
			String repositoryName = getObjectType().getSimpleName().replaceFirst("Repository", "").toLowerCase();
			ClassPathResource classPathResource = new ClassPathResource("/mongo/" + repositoryName);
			if (classPathResource.exists()) {
				System.out.println(repositoryName + " is being loaded!");

				URI uri = classPathResource.getURI();

				Path path;
				if (uri.getScheme().equals("jar")) {
					FileSystem fileSystem;
					try {
						fileSystem = FileSystems.getFileSystem(uri);
					} catch (Exception e) {
						System.out.println("Creating file system!");
						fileSystem = FileSystems.newFileSystem(uri, Collections.<String, Object>emptyMap());
					}

					String subPath = uri.toString()
							.replaceAll("!", "")
							.split("jar/")[1];
					path = fileSystem.getPath(subPath);
				} else {
					path = Paths.get(uri);
				}

				ObjectMapper objectMapper = new ObjectMapper();

				try (Stream<Path> stream = Files.list(path)) {
					stream
							.filter(file -> !Files.isDirectory(file))
							.forEach(file -> {
								try {
									try (Stream<String> lines = Files.lines(file, Charset.forName("UTF-8"))) {
										String line = lines.collect(Collectors.joining());

										List<Document> dStages = objectMapper.readValue(line,
												new TypeReference<List<Document>>() {
												});
										String[] stages = dStages.stream()
												.map(pipeline -> pipeline.toJson().replaceAll(PARAM_REGEX, "$1"))
												.toArray(String[]::new);

										String name = file.getFileName().toString();
										String fName = name.substring(0, name.lastIndexOf("."));
										queryMap.putIfAbsent(fName, stages);
									}

								} catch (IOException e) {
									e.printStackTrace();
								}
							});
				}
				System.out.println(repositoryName + " has been loaded!");
			} else {
				System.out.println(repositoryName + " hasn't any file to load!");
			}
		} catch (IOException e) {
			e.printStackTrace();
		}
		return queryMap;
	}

}