# Department Operations System

A responsive, browser-only prototype for the State Department for Justice, Human Rights and Constitutional Affairs. It brings together ICT inventory, ICT service requests, fleet management, document registers and location updates in one workspace.

## Run

Run `npm run dev` and open the URL printed in the terminal. The server uses Python's built-in HTTP server and automatically tries the next port if 5173 is occupied, so no package installation or build step is required. You can also open `index.html` directly. The Google Fonts link is optional; the interface has local font fallbacks.

## Prototype scope

- The app starts with fictional sample records. Additions and updates are stored in this browser's `localStorage`.
- The ICT service desk is available to signed-in roles. Requesters see only their own tickets; ICT officers and system administrators can manage department-wide requests.
- Sign in with an approved demo profile to see its role-specific workspace. Demo profiles include Staff, HOD, Permanent Secretary, CFO / Finance, Accounts Keeper, Records Officer, ICT Officer, Fleet Officer and System Administrator. New account requests remain pending until the demo administrator assigns a role.
- Activity memos follow PS approval → CFO / Finance action → Accounts Keeper. The initiator and active workflow participants can follow progress. HOD task conversations are private to the assigning HOD and selected staff member.
- The ICT service desk is available to signed-in roles. Requesters see only their own tickets; ICT officers and system administrators can manage department-wide requests.
- The Permanent Secretary has read-only access to Fleet Management and vehicle Tracking. Fleet officers and administrators can maintain vehicle records, including odometer mileage and fuel use in litres per 100 kilometres.
- Comments are private to their author by default. A comment can be shared with everyone only when its memo or document is marked as shared with the department.
- PDF, PNG, JPG and TXT attachments can be previewed in the app. Files are stored in this browser with a 500 KB per-file limit; Office document preview is not supported in this prototype.
- Search, status filters, record creation, status updates, workflow charts and CSV export work locally.
- Vehicle Tracking rotates a clearly labeled demo route for the sample vehicle. It is not connected to GPS, mobile networks or fleet devices and does not provide real-time vehicle locations.
- Browser-local data and demo accounts are not shared with other users and are not appropriate for official, personal, classified or otherwise sensitive departmental information. The demo login and role checks are not authentication or security controls.

## Before operational deployment

Connect the interface to an approved backend and database, then implement departmental identity (preferably the government identity provider), server-enforced role and record-level authorization, tamper-evident audit trails, encrypted document storage and previews, retention and backup policies, and an authorized GPS/telematics integration for live vehicle positions, odometer and fuel telemetry. In particular, enforce memo participant visibility, private comment visibility and HOD-to-assignee task visibility on every server request. Review applicable government security, privacy and records-management requirements before using real data.

## Seal asset attribution

The prototype header uses a thumbnail of the [Coat of arms of Kenya (Official)](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Kenya_(Official).svg) by Ashiriz, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The interface is an unofficial prototype; confirm authorization for official government use before deployment.