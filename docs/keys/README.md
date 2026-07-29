# Firebase keys

`firebase.config.example.json` documents the public Firebase browser fields.

The application does not load a packaged `firebase.config.json`. An Operator
saves the public browser fields and write-only service-account credentials in
deployment configuration, completes both capability tests, and explicitly
activates Firebase. The browser then loads only the public fields from
`/api/deployment/configuration/firebase-config` at runtime.

Never place a Firebase service-account document or private key in this folder.
If you want browser push registration for chat notifications, also fill in `vapidKey` for Firebase web messaging.
Use the Web Push certificates public key for `vapidKey`; do not put the private key in this file.
