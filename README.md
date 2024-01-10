# myscoutee

##### MVP readiness with some issues. (trying to fix for the time being, mostly on UI to ease the understanding)
##### Just notify me about your website to let me know that my effort is not wasted.
##### As i'm unable to continue based on my tricky situation, hence pls. try to fork instead of clone!

1) The project aim is to create fairness into the dating world, which makes less exhaustive experience in both end.
   It's not a typical dating site, as even job site or any other site can use the algorithm and technic.
   (even in this project you can rate for events, not only for people)
   Instead of swipe, you rate people 1-10 and based on that you will be placed in a graph.
   (stronger connections are going to be grouped together)
   Based on priority each person is being assigned to a random event. (graph algorithm)
   After meeting with each other they can re-prioritize themselves, hence the priority graph will be improved. (AI)
   Business model is less dependent on subscription fees and more dependent on affiliate systems and individual event organizers. (e.g.: Booking.com)
   When you want to create an event, then you call people based on mutual priority instead of inviting individually. (who you met before on any random event -> hence you are not new to each other, or your level 1 connections)
2) Some menu has been commented out, as functionality needs to be fixed. (don't remove)
3) Some documentation is under docs folder and in the entity files.

#server folder

firebase:
---------

You need to have a firebase project. (cloud messaging + web app -> relevant files are empty or keys are simply deactivated)

##### Don't share the following files to the outer world, as they do contain your credentials!

environment.prod.ts/environment.ts/FirebaseConfig.java/application-dev.yaml/....adminsdk.json (under src/main/resources)

docker:
-------
cd ./server

gradle build -x test
docker-compose build --no-cache (build context)
docker-compose up

cd ./frontend

ng serve --ssl

docker dependencies:
--------------------

cd /home/raxim/workspace/myscoutee/server/docker/images/mosquitto/

docker build --no-cache -t eclipse-mosquitto:2.0.18-ext_auth .

docker build --no-cache -t myscoutee-nginx:0.1.0 .
