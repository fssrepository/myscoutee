# Firebase keys

`firebase.config.example.json` documents the public Firebase browser fields.

The application does not copy or load a packaged `firebase.config.json`.
An Operator saves the public browser fields and write-only service-account
credentials in deployment configuration, completes both capability tests, and
explicitly activates Firebase. The browser then loads only the public fields
from `/api/deployment/configuration/firebase-config` at runtime.

Never place a Firebase service-account document or private key in this folder.
For browser push registration, configure the Web Push public key as `vapidKey`;
never enter its private key.
