# Department Operations System

A responsive FastAPI and PostgreSQL application for the State Department for Justice, Human Rights and Constitutional Affairs. It brings together ICT inventory, ICT service requests, fleet management, document registers and location updates in one workspace.

## Run

Run `npm run dev` with Docker Compose available, then open `http://localhost:8000`. This starts PostgreSQL, applies Alembic migrations, creates the initial administrator if it does not already exist, and serves the API and frontend together. The API health check is at `/health`; development OpenAPI docs are at `/api/docs`.

`.env.example` contains local-only values so the workspace can start immediately. Replace the database password, bootstrap administrator password, and JWT secret before exposing this service outside a private development environment. The bootstrap account is configured by `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in that file.

Run the backend unit checks with `.venv/bin/python -m pytest -q`. PostgreSQL integration checks should use a disposable database/schema and non-production credentials.

## Prototype scope

- Business records, access requests, comments, workflow events, sessions, and attachment metadata are stored in PostgreSQL. Uploaded files are stored in the persistent `uploaded_documents` volume.
- The ICT service desk is available to signed-in roles. Requesters see only their own tickets; ICT officers and system administrators can manage department-wide requests.
- Sign in with the bootstrap administrator configured in `.env.example`, then approve account requests and assign roles in Account Access. Roles include Staff, HOD, Permanent Secretary, CFO / Finance, Accounts Keeper, Records Officer, ICT Officer, Fleet Officer and System Administrator.
- Activity memos follow PS approval → CFO / Finance action → Accounts Keeper. The initiator and active workflow participants can follow progress. HOD task conversations are private to the assigning HOD and selected staff member.
- The ICT service desk is available to signed-in roles. Requesters see only their own tickets; ICT officers and system administrators can manage department-wide requests.
- The Permanent Secretary has read-only access to Fleet Management and vehicle Tracking. Fleet officers and administrators can maintain vehicle records, including odometer mileage and fuel use in litres per 100 kilometres.
- Comments are private to their author by default. A comment can be shared with everyone only when its memo or document is marked as shared with the department.
- PDF, PNG, JPG and TXT attachments can be uploaded to the backend and previewed in the app. The API enforces a 10 MB per-file limit; Office document conversion/preview is not configured.
- Search, status filters, record creation, status updates, workflow charts and CSV export use backend records.
- Vehicle Tracking displays locations submitted to the API. GPS/telematics hardware and automated location ingestion are not connected yet, so the interface shows the latest recorded position rather than independently live vehicle movement.
- This local Compose setup uses development credentials from `.env.example`; do not use those credentials or this deployment for sensitive departmental data.

## Before operational deployment

Before operational deployment, connect the API to the department's identity provider, rotate all local credentials, deploy behind HTTPS, configure managed PostgreSQL backups and encryption, externalize attachments to approved encrypted object storage, set up secret management, monitoring and retention policies, rate-limit authentication, and integrate authorized GPS/telematics devices. Server-side role and record-level permissions are implemented, but this system has not undergone a government security assessment. Review applicable security, privacy and records-management requirements before using real data.

## Seal asset attribution

The prototype header uses a thumbnail of the [Coat of arms of Kenya (Official)](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Kenya_(Official).svg) by Ashiriz, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The interface is an unofficial prototype; confirm authorization for official government use before deployment.