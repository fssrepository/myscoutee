# Firebase keys

Create `firebase.config.json` in this folder from `firebase.config.example.json` and fill in your Firebase project values.

`firebase.config.json` is ignored by git.
The Angular app now serves this file at `/keys/firebase.config.json` during local builds so the Firebase SDK can load it at runtime.
If you want browser push registration for chat notifications, also fill in `vapidKey` for Firebase web messaging.
