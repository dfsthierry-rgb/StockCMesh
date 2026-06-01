# Security Specification - Central Mesh Dashboard

This specification outlines the data invariants, threat model, and security rules logic for the Firestore database.

## 1. Data Invariants
- Each sharing session is a read-only document stored in the `datasets` collection using a unique ID.
- Datasets, once created, are immutable. No modifications (updates or deletions) are allowed.
- The `items` array must be a list.
- The `createdAt` must be a valid timestamp representing when the database entry was generated.

## 2. Threat Scenarios ("Dirty Dozen" Payloads)
- **Scenario A (Data Poisoning)**: Creating a dataset with custom/shadow data properties. (Expected: `PERMISSION_DENIED`)
- **Scenario B (Identity Spoofing/Alteration)**: Updating an existing dataset with different inventory data. (Expected: `PERMISSION_DENIED`)
- **Scenario C (Arbitrary Deletions)**: An unauthorized agent attempting to delete a shared dataset. (Expected: `PERMISSION_DENIED`)
- **Scenario D (Junk ID Creation)**: Creating a dataset with an invalid structural format. (Expected: `PERMISSION_DENIED`)

## 3. Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    match /datasets/{datasetId} {
      allow get: if true;
      allow create: if request.resource.data.keys().hasAll(['items', 'createdAt']) 
                    && request.resource.data.keys().size() == 2
                    && request.resource.data.items is list;
      allow update, delete: if false;
    }
  }
}
```
