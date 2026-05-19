# Appointments Flowcharts (Backend)

This document focuses on the **appointments domain** and the modules directly connected to it (billing/invoices, Stripe payments, notifications, audit trail, occupancy, forms, observation-tool tasks, and email).

All paths below originate from `apps/backend/src/routers/appointment.router.ts` and converge into `apps/backend/src/services/appointment.service.ts`.

## 0) Module dependency map (appointments)

```mermaid
flowchart LR
  R[appointment.router.ts] --> C[appointment.controller.ts]
  C --> S[appointment.service.ts]

  S --> DB{Data source switch\nisReadFromPostgres()}
  DB -->|Postgres| P[(Prisma:\nappointment / occupancy / invoice / form / org / user)]
  DB -->|Mongo| M[(Mongoose Models:\nAppointment / Occupancy / Invoice / Form / Org / User)]

  S --> INV[InvoiceService]
  S --> STR[StripeService]
  S --> NOTIF[NotificationService]
  S --> AUD[AuditTrailService]
  S --> FORM[FormService\n(consent form lookup)]
  S --> TASK[TaskService\n(observation tool tasks)]
  S --> EMAIL[sendEmailTemplate\n(assignment + checkout emails)]
  S --> USAGE[OrgUsageCounters\n(free plan limits)]

  INV --> NOTIF
  INV --> AUD
  STR --> INV
  STR --> P
  STR --> M
```

## 1) Mobile: request appointment (creates invoice + PaymentIntent)

Route: `POST /fhir/v1/appointment/mobile`

```mermaid
flowchart TD
  A[Mobile client] --> B[POST /fhir/v1/appointment/mobile]
  B --> C[authorizeCognitoMobile]
  C --> D[AppointmentController.createRequestedFromMobile]
  D --> E[AppointmentService.createRequestedFromMobile]

  E --> F[fromAppointmentRequestDTO + validateRequestedFromMobileInput]
  F --> G[Load Service (active for org)]
  G --> H[reserveAppointmentUsage\n(OrgUsageCounters)]
  H --> I[getConsentFormForParentSafe\n(+ add to formIds if found)]
  I --> J[buildAppointmentFromInput\nstatus=REQUESTED]
  J --> K[Persist appointment\n(prisma.appointment.create OR AppointmentModel.create)]
  K --> K2[syncAppointmentToPostgres\n(dual-write if enabled)]
  K --> L[AuditTrailService.recordSafely\nAPPOINTMENT_REQUESTED]
  L --> M[recordFormAttachmentAudit\nFORM_ATTACHED per formId]

  M --> N[InvoiceService.getOrCreateDraftForAppointment\nstatus=AWAITING_PAYMENT]
  N --> O[NotificationService.sendToUser\nPAYMENT_PENDING]
  N --> P[StripeService.createPaymentIntentForInvoice]
  P --> Q[InvoiceService.attachStripeDetails\nstripePaymentIntentId]

  Q --> R[maybeCreateObservationToolTask\n(serviceType=OBSERVATION_TOOL)]
  R --> S[Return { appointment(+paymentStatus), invoice, paymentIntent }]

  H -->|error after reserve| H2[releaseAppointmentUsage]
```

Notes:

- The **payment pending push** is sent from `InvoiceService.createDraftForAppointment()` via `NotificationService.sendToUser()`.
- Appointment responses frequently include computed `paymentStatus` by reading invoice statuses (see section 7).

## 2) PMS: create appointment (optionally creates Checkout Session)

Route: `POST /fhir/v1/appointment/pms?createPayment=true|false`

```mermaid
flowchart TD
  A[PMS client] --> B[POST /fhir/v1/appointment/pms]
  B --> C[authorizeCognito + RBAC middlewares]
  C --> D[AppointmentController.createFromPms]
  D --> E[AppointmentService.createAppointmentFromPms]

  E --> F[validateAppointmentFromPmsInput]
  F --> G[resolvePaymentCollectionMethod\n(default PAYMENT_LINK)]
  G --> H[Load Service (active for org)]
  H --> I[reserveAppointmentUsage\n(OrgUsageCounters)]
  I --> J[getConsentFormForParentSafe\n(+ add to formIds if found)]
  J --> K[buildAppointmentFromInput\nstatus=UPCOMING\n(+lead/support/room from PMS)]

  K --> L{Overlapping occupancy for lead vet?}
  L -->|yes| L1[409 Selected vet not available]
  L -->|no| M[Create appointment + occupancy\n(transaction/session)]
  M --> M2[syncAppointmentToPostgres\n(dual-write if enabled)]

  M --> N[InvoiceService.createDraftForAppointment\nstatus=AWAITING_PAYMENT]
  N --> N2[NotificationService.sendToUser\nPAYMENT_PENDING]
  N --> O[AuditTrailService.recordSafely\nAPPOINTMENT_CREATED]
  O --> P[recordFormAttachmentAudit\nFORM_ATTACHED per formId]

  P --> Q{createPayment == true?}
  Q -->|yes| R[StripeService.createCheckoutSessionForInvoice\n(save sessionId + url)]
  Q -->|no| S[Skip checkout]

  R --> T[If OBSERVATION_TOOL:\ncreateObservationToolTaskForAppointment]
  S --> T

  T --> U[NotificationService.sendToUser\nAppointment APPROVED]
  U --> V[sendAppointmentAssignmentEmails\n(to lead + support)]
  V --> W[sendCheckoutEmailIfNeeded\n(to parent if checkout.url)]
  W --> X[Return { appointment(+paymentStatus), invoice, checkout? }]

  I -->|error after reserve| I2[releaseAppointmentUsage]
```

## 3) PMS: approve requested appointment (REQUESTED → UPCOMING)

Route: `PATCH /fhir/v1/appointment/pms/:organisationId/:appointmentId/accept`

```mermaid
flowchart TD
  A[PMS client] --> B[PATCH .../accept]
  B --> C[authorizeCognito + RBAC]
  C --> D[AppointmentController.acceptRequested]
  D --> E[AppointmentService.approveRequestedFromPms]

  E --> F[extractApprovalFieldsFromFHIR\n(PPRF lead vet, SPRF staff, LOC room)]
  F --> G[Load appointment]
  G --> H{Status == REQUESTED?}
  H -->|no| H1[404/409 transition error]
  H -->|yes| I{Overlapping occupancy for lead vet?}
  I -->|yes| I1[409 vet not available]
  I -->|no| J[Create occupancy for lead vet]
  J --> K[Update appointment:\nlead/support/room + status=UPCOMING]
  K --> K2[syncAppointmentToPostgres\n(dual-write if enabled)]
  K --> L[AuditTrailService.recordSafely\nAPPOINTMENT_APPROVED]
  L --> M[NotificationService.sendToUser\nAppointment APPROVED]
  M --> N[sendAppointmentAssignmentEmails]
  N --> O[Return appointment(+paymentStatus)]
```

## 4) Cancel appointment (core cancel flow + side effects)

Used by:

- PMS cancel: `PATCH /fhir/v1/appointment/pms/:organisationId/:appointmentId/cancel` → `cancelAppointment`
- PMS update to CANCELLED: `PATCH /fhir/v1/appointment/pms/:organisationId/:appointmentId` → `updateAppointmentPMS` → `cancelAppointment`
- Mobile cancel: `PATCH /fhir/v1/appointment/mobile/:appointmentId/cancel` → `cancelAppointmentFromParent`
- PMS reject request: `PATCH /fhir/v1/appointment/pms/:organisationId/:appointmentId/reject` → `rejectRequestedAppointment`

```mermaid
flowchart TD
  A[Cancel action] --> B[AppointmentService.cancelAppointment\nOR cancelAppointmentFromParent\nOR rejectRequestedAppointment]
  B --> C[Load appointment]
  C --> D{Already CANCELLED?}
  D -->|yes| D1[Return appointment(+paymentStatus)]
  D -->|no| E[InvoiceService.handleAppointmentCancellation]

  E --> F{Invoice status}
  F -->|AWAITING_PAYMENT/PENDING| G[Cancel unpaid invoice\n(INVOICE_CANCELLED audit)]
  F -->|PAID| H[Refund paid invoice\n(INVOICE_REFUNDED audit)]
  F -->|CANCELLED/REFUNDED| I[Idempotent]
  F -->|no invoice| J[No-op]

  G --> K[Assert status transition → CANCELLED]
  H --> K
  I --> K
  J --> K

  K --> L[Update appointment:\nstatus=CANCELLED (+ concern/reason)]
  L --> L2[syncAppointmentToPostgres\n(dual-write if enabled)]
  L --> M[Remove occupancy (if lead assigned)\n(deleteMany by referenceId)]
  M --> N[AuditTrailService.recordSafely\nAPPOINTMENT_CANCELLED]
  N --> O[NotificationService.sendToUser\nAppointment CANCELLED\n(PMS cancel + reject send this)]
  O --> P[Return appointment(+paymentStatus)]
```

Notes:

- `cancelAppointmentFromParent` allows cancelling only when status is `REQUESTED` or `UPCOMING` (normalized).
- Occupancy removal is keyed by appointment reference id and source type `APPOINTMENT`.

## 5) Parent: reschedule appointment (may revert UPCOMING → REQUESTED)

Route: `PATCH /fhir/v1/appointment/mobile/:appointmentId/reschedule`

```mermaid
flowchart TD
  A[Parent] --> B[PATCH .../reschedule]
  B --> C[authorizeCognitoMobile]
  C --> D[resolve parentId via AuthUserMobileService]
  D --> E[AppointmentService.rescheduleFromParent]

  E --> F[Load appointment]
  F --> G{Parent owns appointment?}
  G -->|no| G1[403]
  G -->|yes| H{Status COMPLETED/CANCELLED?}
  H -->|yes| H1[400]
  H -->|no| I{Status is UPCOMING?}
  I -->|yes| J[Transition UPCOMING → REQUESTED\n(clear lead/support/room)]
  J --> K[Delete occupancy for this appointment]
  I -->|no| L[Keep current status]

  K --> M[Update start/end/duration/concern/isEmergency]
  L --> M
  M --> M2[syncAppointmentToPostgres\n(dual-write if enabled)]
  M --> N[AuditTrailService.recordSafely\nAPPOINTMENT_RESCHEDULED]
  N --> O[Return appointment(+paymentStatus)]
```

## 6) Attach forms to appointment (PMS)

Route: `POST /fhir/v1/appointment/pms/:organisationId/:appointmentId/forms`

```mermaid
flowchart TD
  A[PMS client] --> B[POST .../forms]
  B --> C[authorizeCognito + RBAC]
  C --> D[AppointmentController.attachFormsToAppointment]
  D --> E[AppointmentService.attachFormsToAppointment]

  E --> F[Validate orgId, appointmentId, formIds]
  F --> G[Load appointment + verify org ownership]
  G --> H[Load forms by ids within org]
  H --> I{Any missing forms?}
  I -->|yes| I1[404 Forms not found]
  I -->|no| J[Add new ids only\n(addToSet / merge array)]
  J --> K[AuditTrailService.recordSafely\nFORM_ATTACHED per newly added formId]
  K --> L[Return appointment(+paymentStatus)]
```

## 7) Appointment reads: computed payment status

Common pattern: `toAppointmentResponseDTOWithPaymentStatus*()` calls `resolvePaymentStatusForAppointment()` which reads invoice statuses (Mongo aggregate or Prisma query) and maps to `PAID|UNPAID`.

```mermaid
flowchart TD
  A[Get/List appointments] --> B[AppointmentService.getById / list*]
  B --> C[Fetch appointments from Prisma or Mongoose]
  C --> D[Resolve payment statuses by appointmentIds]

  D --> E{Read from Postgres?\n isReadFromPostgres()}
  E -->|yes| F[prisma.invoice.findMany\n(status in PAID/PENDING/AWAITING_PAYMENT/FAILED/REFUNDED)]
  E -->|no| G[InvoiceModel.aggregate\n(group by appointmentId)]

  F --> H[Build map appointmentId → PAID|UNPAID]
  G --> H
  H --> I[attachPaymentStatus(appointment, status)]
  I --> J[toAppointmentResponseDTO]
```
