# Firebase rules for AELIO Studio

Founder: **jaja@vybr8.live** · UID **0RcUhRBDI4hGWisgzuyezqGVVZC3**

The studio server already enforces this founder allow-list itself (`AELIO_FOUNDER_EMAILS` + `AELIO_FOUNDER_UIDS` in `.env`). These rules add the same lock to Firestore and Cloud Storage. Today the studio stores nothing in either, so the rules are protection for later.

## ⚠️ Use only on the AELIO Studio Firebase project
These rules replace **all** existing rules. If this Firebase project also serves VYBR8, Grooveville or any other app, deploying them **will lock those apps out**. Create a separate Firebase project for AELIO Studio, or merge only the `isFounder()` parts into your existing rules by hand.

UIDs are per Firebase project. `0RcUhRBDI4hGWisgzuyezqGVVZC3` only works if it belongs to the project the studio uses: check Firebase console → Authentication → Users.

## Deploy
```bash
npm install -g firebase-tools
firebase login
cd firebase
firebase use <aelio-studio-project-id>
firebase deploy --only firestore:rules,storage
```
Or paste each file into the console: Firestore → Rules, and Storage → Rules.
