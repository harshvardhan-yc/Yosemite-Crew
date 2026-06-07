-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('GENERAL_ENQUIRY', 'FEATURE_REQUEST', 'DSAR', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MOBILE_APP', 'PMS_WEB', 'MARKETING_SITE');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompanionType" AS ENUM ('dog', 'cat', 'horse', 'other');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('shop', 'breeder', 'foster_shelter', 'friends_family', 'stray', 'unknown');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'archived', 'inactive');

-- CreateEnum
CREATE TYPE "OrganisationType" AS ENUM ('HOSPITAL', 'BREEDER', 'BOARDER', 'GROOMER');

-- CreateEnum
CREATE TYPE "CompanionOrganisationRole" AS ENUM ('ORGANISATION');

-- CreateEnum
CREATE TYPE "CompanionOrganisationStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED', 'INVITED');

-- CreateEnum
CREATE TYPE "ParentCompanionRole" AS ENUM ('PRIMARY', 'CO_PARENT');

-- CreateEnum
CREATE TYPE "ParentCompanionStatus" AS ENUM ('ACTIVE', 'PENDING', 'REVOKED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'UPCOMING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatSessionType" AS ENUM ('APPOINTMENT', 'ORG_DIRECT', 'ORG_GROUP');

-- CreateEnum
CREATE TYPE "ParentCreatedFrom" AS ENUM ('pms', 'mobile', 'invited');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'BREEDER', 'BOARDER', 'GROOMER');

-- CreateEnum
CREATE TYPE "PetNamePreference" AS ENUM ('COMPANION', 'ANIMAL', 'PATIENT');

-- CreateEnum
CREATE TYPE "UserProfileStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UserProfileGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "UserProfileEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');

-- CreateEnum
CREATE TYPE "UserProfileDocumentType" AS ENUM ('LICENSE', 'CERTIFICATE', 'CV', 'OTHER');

-- CreateEnum
CREATE TYPE "CodeSystem" AS ENUM ('YOSEMITECODE', 'IDEXX', 'SNOMED', 'VENOM');

-- CreateEnum
CREATE TYPE "CodeType" AS ENUM ('SPECIES', 'BREED', 'GENDER', 'TEST', 'CLINICAL_TERM', 'OTHER');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('CREATED', 'SUBMITTED', 'AT_THE_LAB', 'PARTIAL', 'RUNNING', 'COMPLETE', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "LabOrderModality" AS ENUM ('IN_HOUSE', 'REFERENCE_LAB');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('IDEXX', 'MERCK_MANUALS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('enabled', 'disabled', 'error', 'pending');

-- CreateEnum
CREATE TYPE "IntegrationCredentialsStatus" AS ENUM ('missing', 'invalid', 'valid', 'pending');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('cognito', 'firebase');

-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('free', 'business');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('none', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused');

-- CreateEnum
CREATE TYPE "AccessState" AS ENUM ('free', 'active', 'past_due', 'suspended');

-- CreateEnum
CREATE TYPE "OrgDocumentCategory" AS ENUM ('TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'CANCELLATION_POLICY', 'FIRE_SAFETY', 'GENERAL');

-- CreateEnum
CREATE TYPE "OrgDocumentVisibility" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CONSULTATION', 'WAITING_AREA', 'SURGERY', 'ICU');

-- CreateEnum
CREATE TYPE "OrganisationInviteEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "OrganisationInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CHAT_MESSAGE', 'APPOINTMENTS', 'REMINDERS', 'PROMOTIONS', 'PAYMENTS');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentCollectionMethod" AS ENUM ('PAYMENT_INTENT', 'PAYMENT_LINK', 'PAYMENT_AT_CLINIC');

-- CreateEnum
CREATE TYPE "FormVisibilityType" AS ENUM ('Internal', 'External', 'Internal_External');

-- CreateEnum
CREATE TYPE "FormRequiredSigner" AS ENUM ('CLIENT', 'VET');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CONSULTATION', 'OBSERVATION_TOOL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TaskAudience" AS ENUM ('EMPLOYEE_TASK', 'PARENT_TASK');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('YC_LIBRARY', 'ORG_TEMPLATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('MEDICATION', 'OBSERVATION_TOOL', 'HYGIENE', 'DIET', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TaskTemplateRole" AS ENUM ('EMPLOYEE', 'PARENT');

-- CreateEnum
CREATE TYPE "TaskLibrarySpecies" AS ENUM ('dog', 'cat', 'horse');

-- CreateEnum
CREATE TYPE "ReminderJobStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('PMS_USER', 'PARENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('COMPANION_ORGANISATION', 'APPOINTMENT', 'INVOICE', 'DOCUMENT', 'FORM');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('COMPANION_ORG_LINK_CREATED', 'COMPANION_ORG_LINK_REQUESTED', 'COMPANION_ORG_LINK_APPROVED', 'COMPANION_ORG_LINK_REJECTED', 'COMPANION_ORG_LINK_REVOKED', 'COMPANION_ORG_INVITE_ACCEPTED', 'COMPANION_ORG_INVITE_REJECTED', 'COMPANION_ORG_LINK_AUTO', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_CREATED', 'APPOINTMENT_APPROVED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CHECKED_IN', 'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_PAID', 'INVOICE_FAILED', 'INVOICE_REFUNDED', 'INVOICE_CANCELLED', 'DOCUMENT_ADDED', 'DOCUMENT_UPDATED', 'DOCUMENT_DELETED', 'FORM_ATTACHED', 'FORM_SUBMITTED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InventoryBusinessType" AS ENUM ('HOSPITAL', 'GROOMING', 'BREEDING', 'BOARDING', 'GENERAL');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ObservationFieldType" AS ENUM ('TEXT', 'NUMBER', 'CHOICE', 'BOOLEAN', 'PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "OccupancySourceType" AS ENUM ('APPOINTMENT', 'BLOCKED', 'SURGERY');

-- CreateEnum
CREATE TYPE "AdverseEventStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'FORWARDED', 'CLOSED');

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "source" "ContactSource" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "organisationId" TEXT,
    "companionId" TEXT,
    "parentId" TEXT,
    "dsarDetails" JSONB,
    "complaintContext" JSONB,
    "attachments" JSONB,
    "status" "ContactStatus" NOT NULL DEFAULT 'OPEN',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'disabled',
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "credentialsStatus" "IntegrationCredentialsStatus" NOT NULL DEFAULT 'missing',
    "lastValidatedAt" TIMESTAMP(3),
    "credentials" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeEntry" (
    "id" TEXT NOT NULL,
    "system" "CodeSystem" NOT NULL,
    "code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "type" "CodeType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "synonyms" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeMapping" (
    "id" TEXT NOT NULL,
    "sourceSystem" "CodeSystem" NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "targetSystem" "CodeSystem" NOT NULL,
    "targetCode" TEXT NOT NULL,
    "targetDisplay" TEXT,
    "targetVersion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSyncState" (
    "id" TEXT NOT NULL,
    "system" "CodeSystem" NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "createdByUserId" TEXT,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'CREATED',
    "modality" "LabOrderModality" NOT NULL DEFAULT 'REFERENCE_LAB',
    "idexxOrderId" TEXT,
    "uiUrl" TEXT,
    "pdfUrl" TEXT,
    "tests" JSONB,
    "veterinarian" TEXT,
    "technician" TEXT,
    "notes" TEXT,
    "specimenCollectionDate" TEXT,
    "ivls" JSONB,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "error" TEXT,
    "externalStatus" TEXT,
    "invoiceId" TEXT,
    "billedAt" TIMESTAMP(3),
    "billingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "provider" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "orderId" TEXT,
    "requisitionId" TEXT,
    "accessionId" TEXT,
    "diagnosticSetId" TEXT,
    "status" TEXT,
    "statusDetail" TEXT,
    "modality" TEXT,
    "patientId" TEXT,
    "patientName" TEXT,
    "clientId" TEXT,
    "clientFirstName" TEXT,
    "clientLastName" TEXT,
    "updatedDate" TEXT,
    "updatedAuditDate" TEXT,
    "specimenCollectionDate" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResultSyncState" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "lastBatchId" TEXT,
    "lastTimestamp" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResultSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Companion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompanionType" NOT NULL,
    "breed" TEXT NOT NULL,
    "speciesCode" TEXT,
    "breedCode" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "photoUrl" TEXT,
    "currentWeight" DOUBLE PRECISION,
    "colour" TEXT,
    "allergy" TEXT,
    "bloodGroup" TEXT,
    "isNeutered" BOOLEAN,
    "ageWhenNeutered" TEXT,
    "microchipNumber" TEXT,
    "passportNumber" TEXT,
    "isInsured" BOOLEAN NOT NULL DEFAULT false,
    "insurance" JSONB,
    "countryOfOrigin" TEXT,
    "source" "SourceType",
    "status" "RecordStatus",
    "physicalAttribute" JSONB,
    "breedingInfo" JSONB,
    "medicalRecords" JSONB,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Companion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "visitType" TEXT,
    "title" TEXT NOT NULL,
    "issuingBusinessName" TEXT,
    "issueDate" TIMESTAMP(3),
    "uploadedByParentId" TEXT,
    "uploadedByPmsUserId" TEXT,
    "pmsVisible" BOOLEAN NOT NULL DEFAULT false,
    "syncedFromPms" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAttachment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER,

    CONSTRAINT "DocumentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanionOrganisation" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "organisationId" TEXT,
    "linkedByParentId" TEXT,
    "linkedByPmsUserId" TEXT,
    "organisationType" "OrganisationType" NOT NULL,
    "role" "CompanionOrganisationRole" NOT NULL DEFAULT 'ORGANISATION',
    "status" "CompanionOrganisationStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedViaEmail" TEXT,
    "organisationName" TEXT,
    "organisationPlacesId" TEXT,
    "inviteToken" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanionOrganisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentCompanion" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "role" "ParentCompanionRole" NOT NULL,
    "status" "ParentCompanionStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB NOT NULL,
    "invitedByParentId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "companion" JSONB NOT NULL,
    "lead" JSONB,
    "supportStaff" JSONB,
    "room" JSONB,
    "appointmentType" JSONB,
    "organisationId" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "concern" TEXT,
    "attachments" JSONB,
    "formIds" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "type" "ChatSessionType" NOT NULL,
    "appointmentId" TEXT,
    "channelId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "companionId" TEXT,
    "parentId" TEXT,
    "vetId" TEXT,
    "supportStaffIds" TEXT[],
    "createdBy" TEXT,
    "title" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "members" TEXT[],
    "participants" JSONB,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'PENDING',
    "allowedFrom" TIMESTAMP(3),
    "allowedUntil" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "birthDate" TIMESTAMP(3),
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "profileImageUrl" TEXT,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "linkedUserId" TEXT,
    "createdFrom" "ParentCreatedFrom" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAddress" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "addressLine" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "fhirId" TEXT,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "dunsNumber" TEXT,
    "imageUrl" TEXT,
    "type" "OrganizationType" NOT NULL,
    "petNamePreference" "PetNamePreference" DEFAULT 'COMPANION',
    "phoneNo" TEXT NOT NULL,
    "website" TEXT,
    "documensoTeamId" TEXT,
    "documensoApiKey" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "typeCoding" JSONB,
    "healthAndSafetyCertNo" TEXT,
    "animalWelfareComplianceCertNo" TEXT,
    "fireAndEmergencyCertNo" TEXT,
    "googlePlacesId" TEXT,
    "stripeAccountId" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "appointmentCheckInBufferMinutes" INTEGER NOT NULL DEFAULT 5,
    "appointmentCheckInRadiusMeters" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addressLine" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personalDetails" JSONB,
    "professionalDetails" JSONB,
    "status" "UserProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfileAddress" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "addressLine" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "id" TEXT NOT NULL,
    "fhirId" TEXT,
    "practitionerReference" TEXT NOT NULL,
    "organizationReference" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "roleDisplay" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "extraPermissions" TEXT[],
    "revokedPermissions" TEXT[],
    "effectivePermissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "authProvider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgBilling" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "connectAccountId" TEXT,
    "canAcceptPayments" BOOLEAN NOT NULL DEFAULT false,
    "connectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "connectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "connectDisabledReason" TEXT,
    "connectRequirements" JSONB,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSubscriptionItemId" TEXT,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "stripeLivemode" BOOLEAN NOT NULL DEFAULT false,
    "plan" "BillingPlan" NOT NULL DEFAULT 'free',
    "billingInterval" "BillingInterval",
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "seatQuantity" INTEGER NOT NULL DEFAULT 0,
    "seatQuantityUpdatedAt" TIMESTAMP(3),
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'none',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextInvoiceAt" TIMESTAMP(3),
    "lastInvoiceId" TEXT,
    "lastPaymentStatus" TEXT,
    "lastPaymentAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upgradedAt" TIMESTAMP(3),
    "downgradedAt" TIMESTAMP(3),
    "accessState" "AccessState" NOT NULL DEFAULT 'free',
    "gracePeriodEndsAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastStripeEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "category" "OrgDocumentCategory" NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "visibility" "OrgDocumentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationRoom" (
    "id" TEXT NOT NULL,
    "fhirId" TEXT,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "assignedSpecialiteis" TEXT[],
    "assignedStaffs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationInvite" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "departmentIds" TEXT[],
    "inviteeEmail" TEXT NOT NULL,
    "inviteeName" TEXT,
    "role" TEXT NOT NULL,
    "employmentType" "OrganisationInviteEmploymentType",
    "token" TEXT NOT NULL,
    "status" "OrganisationInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationRating" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUsageCounters" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "appointmentsUsed" INTEGER NOT NULL DEFAULT 0,
    "toolsUsed" INTEGER NOT NULL DEFAULT 0,
    "usersActiveCount" INTEGER NOT NULL DEFAULT 0,
    "usersBillableCount" INTEGER NOT NULL DEFAULT 0,
    "freeAppointmentsLimit" INTEGER NOT NULL DEFAULT 120,
    "freeToolsLimit" INTEGER NOT NULL DEFAULT 200,
    "freeUsersLimit" INTEGER NOT NULL DEFAULT 10,
    "freeLimitReachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUsageCounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoParentInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviteeName" TEXT,
    "companionId" TEXT NOT NULL,
    "invitedByParentId" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "diclinedAt" TIMESTAMP(3),
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoParentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalExpense" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "visitType" TEXT,
    "expenseName" TEXT NOT NULL,
    "businessName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "attachments" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "businessType" "OrganizationType",
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "visibilityType" "FormVisibilityType" NOT NULL,
    "serviceId" TEXT[],
    "speciesFilter" TEXT[],
    "requiredSigner" "FormRequiredSigner",
    "status" "FormStatus" NOT NULL DEFAULT 'draft',
    "schema" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN,
    "order" INTEGER,
    "group" TEXT,
    "options" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaSnapshot" JSONB NOT NULL,
    "fieldsSnapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersion" INTEGER NOT NULL,
    "appointmentId" TEXT,
    "companionId" TEXT,
    "parentId" TEXT,
    "submittedBy" TEXT,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signing" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "maxDiscount" DOUBLE PRECISION,
    "specialityId" TEXT,
    "serviceType" "ServiceType" NOT NULL DEFAULT 'CONSULTATION',
    "observationToolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "appointmentId" TEXT,
    "companionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedTo" TEXT NOT NULL,
    "audience" "TaskAudience" NOT NULL,
    "source" "TaskSource" NOT NULL,
    "libraryTaskId" TEXT,
    "templateId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "additionalNotes" TEXT,
    "medication" JSONB,
    "observationToolId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "recurrence" JSONB,
    "reminder" JSONB,
    "syncWithCalendar" BOOLEAN,
    "calendarEventId" TEXT,
    "attachments" JSONB,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "filledBy" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "source" "TaskSource" NOT NULL DEFAULT 'ORG_TEMPLATE',
    "organisationId" TEXT NOT NULL,
    "libraryTaskId" TEXT,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "TaskKind" NOT NULL,
    "defaultRole" "TaskTemplateRole" NOT NULL,
    "defaultMedication" JSONB,
    "defaultObservationToolId" TEXT,
    "defaultRecurrence" JSONB,
    "defaultReminderOffsetMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLibraryDefinition" (
    "id" TEXT NOT NULL,
    "source" "TaskSource" NOT NULL DEFAULT 'YC_LIBRARY',
    "kind" "TaskKind" NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDescription" TEXT,
    "schema" JSONB NOT NULL,
    "applicableSpecies" "TaskLibrarySpecies"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskLibraryDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderJob" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "status" "ReminderJobStatus" NOT NULL DEFAULT 'SCHEDULED',
    "jobKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrail" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "actorType" "AuditActorType",
    "actorId" TEXT,
    "actorName" TEXT,
    "entityType" "AuditEntityType",
    "entityId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "signatureText" TEXT,
    "message" TEXT,
    "checkboxConfirmed" BOOLEAN NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "processedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "businessType" "InventoryBusinessType" NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "allocated" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER,
    "unitCost" DOUBLE PRECISION,
    "sellingPrice" DOUBLE PRECISION,
    "currency" TEXT,
    "vendorId" TEXT,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "regulatoryTrackingId" TEXT,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "minShelfLifeAlertDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "allocated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryVendor" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "vendorType" TEXT,
    "licenseNumber" TEXT,
    "paymentTerms" TEXT,
    "deliveryFrequency" TEXT,
    "leadTimeDays" INTEGER,
    "contactInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMetaField" (
    "id" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "values" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMetaField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "batchId" TEXT,
    "change" INTEGER,
    "reason" TEXT,
    "referenceId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "slots" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAvailabilityOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "overrides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationToolDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "scoringRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationToolDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationToolSubmission" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "taskId" TEXT,
    "companionId" TEXT NOT NULL,
    "filledBy" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "evaluationAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationToolSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "sourceType" "OccupancySourceType" NOT NULL DEFAULT 'APPOINTMENT',
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryAuthority" (
    "id" TEXT NOT NULL,
    "country" TEXT,
    "iso2" TEXT,
    "iso3" TEXT,
    "authorityName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "RegulatoryAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdverseEventReport" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "appointmentId" TEXT,
    "reporter" JSONB NOT NULL,
    "companion" JSONB NOT NULL,
    "product" JSONB NOT NULL,
    "destinations" JSONB NOT NULL,
    "consent" JSONB NOT NULL,
    "status" "AdverseEventStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseEventReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Speciality" (
    "id" TEXT NOT NULL,
    "fhirId" TEXT,
    "organisationId" TEXT NOT NULL,
    "departmentMasterId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headUserId" TEXT,
    "headName" TEXT,
    "headProfilePicUrl" TEXT,
    "services" TEXT[],
    "memberUserIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Speciality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isSeen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "companionId" TEXT,
    "organisationId" TEXT,
    "appointmentId" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentCollectionMethod" "PaymentCollectionMethod" NOT NULL DEFAULT 'PAYMENT_INTENT',
    "stripePaymentIntentId" TEXT,
    "stripePaymentLinkId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeChargeId" TEXT,
    "stripeReceiptUrl" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeCheckoutUrl" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRequest_type_idx" ON "ContactRequest"("type");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "ContactRequest_userId_idx" ON "ContactRequest"("userId");

-- CreateIndex
CREATE INDEX "ContactRequest_organisationId_idx" ON "ContactRequest"("organisationId");

-- CreateIndex
CREATE INDEX "ContactRequest_companionId_idx" ON "ContactRequest"("companionId");

-- CreateIndex
CREATE INDEX "ContactRequest_parentId_idx" ON "ContactRequest"("parentId");

-- CreateIndex
CREATE INDEX "IntegrationAccount_organisationId_idx" ON "IntegrationAccount"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_organisationId_provider_key" ON "IntegrationAccount"("organisationId", "provider");

-- CreateIndex
CREATE INDEX "CodeEntry_system_type_active_idx" ON "CodeEntry"("system", "type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CodeEntry_system_code_key" ON "CodeEntry"("system", "code");

-- CreateIndex
CREATE INDEX "CodeMapping_sourceSystem_sourceCode_idx" ON "CodeMapping"("sourceSystem", "sourceCode");

-- CreateIndex
CREATE INDEX "CodeMapping_targetSystem_targetCode_idx" ON "CodeMapping"("targetSystem", "targetCode");

-- CreateIndex
CREATE UNIQUE INDEX "CodeMapping_sourceSystem_sourceCode_targetSystem_targetCode_key" ON "CodeMapping"("sourceSystem", "sourceCode", "targetSystem", "targetCode");

-- CreateIndex
CREATE INDEX "CodeSyncState_system_kind_idx" ON "CodeSyncState"("system", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSyncState_system_kind_key" ON "CodeSyncState"("system", "kind");

-- CreateIndex
CREATE INDEX "LabOrder_organisationId_idx" ON "LabOrder"("organisationId");

-- CreateIndex
CREATE INDEX "LabOrder_provider_idx" ON "LabOrder"("provider");

-- CreateIndex
CREATE INDEX "LabOrder_idexxOrderId_idx" ON "LabOrder"("idexxOrderId");

-- CreateIndex
CREATE INDEX "LabOrder_invoiceId_idx" ON "LabOrder"("invoiceId");

-- CreateIndex
CREATE INDEX "LabResult_provider_orderId_idx" ON "LabResult"("provider", "orderId");

-- CreateIndex
CREATE INDEX "LabResult_organisationId_idx" ON "LabResult"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_provider_resultId_key" ON "LabResult"("provider", "resultId");

-- CreateIndex
CREATE UNIQUE INDEX "LabResultSyncState_provider_key" ON "LabResultSyncState"("provider");

-- CreateIndex
CREATE INDEX "Companion_type_idx" ON "Companion"("type");

-- CreateIndex
CREATE INDEX "Companion_status_idx" ON "Companion"("status");

-- CreateIndex
CREATE INDEX "Document_companionId_idx" ON "Document"("companionId");

-- CreateIndex
CREATE INDEX "Document_companionId_category_idx" ON "Document"("companionId", "category");

-- CreateIndex
CREATE INDEX "Document_companionId_pmsVisible_idx" ON "Document"("companionId", "pmsVisible");

-- CreateIndex
CREATE INDEX "Document_appointmentId_idx" ON "Document"("appointmentId");

-- CreateIndex
CREATE INDEX "DocumentAttachment_documentId_idx" ON "DocumentAttachment"("documentId");

-- CreateIndex
CREATE INDEX "CompanionOrganisation_companionId_idx" ON "CompanionOrganisation"("companionId");

-- CreateIndex
CREATE INDEX "CompanionOrganisation_organisationId_idx" ON "CompanionOrganisation"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "companion_org_unique_active" ON "CompanionOrganisation"("companionId", "organisationId", "organisationType");

-- CreateIndex
CREATE INDEX "ParentCompanion_parentId_idx" ON "ParentCompanion"("parentId");

-- CreateIndex
CREATE INDEX "ParentCompanion_companionId_idx" ON "ParentCompanion"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentCompanion_parentId_companionId_key" ON "ParentCompanion"("parentId", "companionId");

-- CreateIndex
CREATE INDEX "Appointment_organisationId_appointmentDate_idx" ON "Appointment"("organisationId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_organisationId_idx" ON "Appointment"("organisationId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_expiresAt_idx" ON "Appointment"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatSession_type_idx" ON "ChatSession"("type");

-- CreateIndex
CREATE INDEX "ChatSession_appointmentId_idx" ON "ChatSession"("appointmentId");

-- CreateIndex
CREATE INDEX "ChatSession_organisationId_idx" ON "ChatSession"("organisationId");

-- CreateIndex
CREATE INDEX "ChatSession_status_idx" ON "ChatSession"("status");

-- CreateIndex
CREATE INDEX "ChatSession_organisationId_status_idx" ON "ChatSession"("organisationId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_parentId_idx" ON "ChatSession"("parentId");

-- CreateIndex
CREATE INDEX "ChatSession_vetId_idx" ON "ChatSession"("vetId");

-- CreateIndex
CREATE INDEX "Parent_email_idx" ON "Parent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAddress_parentId_key" ON "ParentAddress"("parentId");

-- CreateIndex
CREATE INDEX "Organization_googlePlacesId_name_idx" ON "Organization"("googlePlacesId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAddress_organizationId_key" ON "OrganizationAddress"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_organizationId_idx" ON "UserProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_organizationId_key" ON "UserProfile"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileAddress_userProfileId_key" ON "UserProfileAddress"("userProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_org_role" ON "UserOrganization"("practitionerReference", "organizationReference", "roleCode");

-- CreateIndex
CREATE INDEX "AuthUser_providerUserId_idx" ON "AuthUser"("providerUserId");

-- CreateIndex
CREATE INDEX "AuthUser_email_idx" ON "AuthUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrgBilling_orgId_key" ON "OrgBilling"("orgId");

-- CreateIndex
CREATE INDEX "OrgBilling_connectAccountId_idx" ON "OrgBilling"("connectAccountId");

-- CreateIndex
CREATE INDEX "OrgBilling_canAcceptPayments_idx" ON "OrgBilling"("canAcceptPayments");

-- CreateIndex
CREATE INDEX "OrgBilling_stripeCustomerId_idx" ON "OrgBilling"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "OrgBilling_stripeSubscriptionId_idx" ON "OrgBilling"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "OrgBilling_plan_idx" ON "OrgBilling"("plan");

-- CreateIndex
CREATE INDEX "OrgBilling_subscriptionStatus_idx" ON "OrgBilling"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "OrgBilling_accessState_idx" ON "OrgBilling"("accessState");

-- CreateIndex
CREATE INDEX "OrgBilling_orgId_plan_idx" ON "OrgBilling"("orgId", "plan");

-- CreateIndex
CREATE INDEX "OrganizationDocument_organisationId_idx" ON "OrganizationDocument"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationRoom_fhirId_idx" ON "OrganisationRoom"("fhirId");

-- CreateIndex
CREATE INDEX "OrganisationRoom_organisationId_idx" ON "OrganisationRoom"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationInvite_token_key" ON "OrganisationInvite"("token");

-- CreateIndex
CREATE INDEX "OrganisationInvite_organisationId_idx" ON "OrganisationInvite"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationInvite_token_idx" ON "OrganisationInvite"("token");

-- CreateIndex
CREATE INDEX "OrganisationInvite_status_idx" ON "OrganisationInvite"("status");

-- CreateIndex
CREATE INDEX "OrganisationInvite_expiresAt_idx" ON "OrganisationInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationRating_organizationId_userId_key" ON "OrganisationRating"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUsageCounters_orgId_key" ON "OrgUsageCounters"("orgId");

-- CreateIndex
CREATE INDEX "OrgUsageCounters_freeLimitReachedAt_idx" ON "OrgUsageCounters"("freeLimitReachedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoParentInvite_inviteToken_key" ON "CoParentInvite"("inviteToken");

-- CreateIndex
CREATE INDEX "CoParentInvite_email_idx" ON "CoParentInvite"("email");

-- CreateIndex
CREATE INDEX "ExternalExpense_companionId_idx" ON "ExternalExpense"("companionId");

-- CreateIndex
CREATE INDEX "ExternalExpense_parentId_idx" ON "ExternalExpense"("parentId");

-- CreateIndex
CREATE INDEX "Form_orgId_status_idx" ON "Form"("orgId", "status");

-- CreateIndex
CREATE INDEX "Form_orgId_category_idx" ON "Form"("orgId", "category");

-- CreateIndex
CREATE INDEX "Form_orgId_businessType_category_status_idx" ON "Form"("orgId", "businessType", "category", "status");

-- CreateIndex
CREATE INDEX "Form_serviceId_idx" ON "Form"("serviceId");

-- CreateIndex
CREATE INDEX "Form_status_idx" ON "Form"("status");

-- CreateIndex
CREATE INDEX "FormField_formId_idx" ON "FormField"("formId");

-- CreateIndex
CREATE INDEX "FormField_type_idx" ON "FormField"("type");

-- CreateIndex
CREATE INDEX "FormVersion_formId_idx" ON "FormVersion"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_formVersion_idx" ON "FormSubmission"("formId", "formVersion");

-- CreateIndex
CREATE INDEX "FormSubmission_appointmentId_idx" ON "FormSubmission"("appointmentId");

-- CreateIndex
CREATE INDEX "FormSubmission_companionId_idx" ON "FormSubmission"("companionId");

-- CreateIndex
CREATE INDEX "FormSubmission_parentId_idx" ON "FormSubmission"("parentId");

-- CreateIndex
CREATE INDEX "FormSubmission_submittedAt_idx" ON "FormSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "Service_organisationId_idx" ON "Service"("organisationId");

-- CreateIndex
CREATE INDEX "Service_organisationId_specialityId_idx" ON "Service"("organisationId", "specialityId");

-- CreateIndex
CREATE INDEX "Task_assignedTo_dueAt_idx" ON "Task"("assignedTo", "dueAt");

-- CreateIndex
CREATE INDEX "Task_companionId_dueAt_idx" ON "Task"("companionId", "dueAt");

-- CreateIndex
CREATE INDEX "Task_organisationId_dueAt_idx" ON "Task"("organisationId", "dueAt");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "TaskCompletion_taskId_idx" ON "TaskCompletion"("taskId");

-- CreateIndex
CREATE INDEX "TaskCompletion_companionId_idx" ON "TaskCompletion"("companionId");

-- CreateIndex
CREATE INDEX "TaskTemplate_organisationId_idx" ON "TaskTemplate"("organisationId");

-- CreateIndex
CREATE INDEX "TaskLibraryDefinition_kind_idx" ON "TaskLibraryDefinition"("kind");

-- CreateIndex
CREATE INDEX "TaskLibraryDefinition_category_idx" ON "TaskLibraryDefinition"("category");

-- CreateIndex
CREATE INDEX "ReminderJob_taskId_idx" ON "ReminderJob"("taskId");

-- CreateIndex
CREATE INDEX "ReminderJob_userId_idx" ON "ReminderJob"("userId");

-- CreateIndex
CREATE INDEX "AuditTrail_organisationId_idx" ON "AuditTrail"("organisationId");

-- CreateIndex
CREATE INDEX "AuditTrail_companionId_idx" ON "AuditTrail"("companionId");

-- CreateIndex
CREATE INDEX "AuditTrail_eventType_idx" ON "AuditTrail"("eventType");

-- CreateIndex
CREATE INDEX "AuditTrail_occurredAt_idx" ON "AuditTrail"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditTrail_organisationId_companionId_occurredAt_idx" ON "AuditTrail"("organisationId", "companionId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditTrail_organisationId_occurredAt_idx" ON "AuditTrail"("organisationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AccountWithdrawal_email_idx" ON "AccountWithdrawal"("email");

-- CreateIndex
CREATE INDEX "AccountWithdrawal_status_idx" ON "AccountWithdrawal"("status");

-- CreateIndex
CREATE INDEX "InventoryItem_organisationId_name_idx" ON "InventoryItem"("organisationId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_category_subCategory_idx" ON "InventoryItem"("category", "subCategory");

-- CreateIndex
CREATE INDEX "InventoryItem_businessType_idx" ON "InventoryItem"("businessType");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryBatch_itemId_idx" ON "InventoryBatch"("itemId");

-- CreateIndex
CREATE INDEX "InventoryBatch_organisationId_idx" ON "InventoryBatch"("organisationId");

-- CreateIndex
CREATE INDEX "InventoryBatch_expiryDate_idx" ON "InventoryBatch"("expiryDate");

-- CreateIndex
CREATE INDEX "InventoryBatch_minShelfLifeAlertDate_idx" ON "InventoryBatch"("minShelfLifeAlertDate");

-- CreateIndex
CREATE INDEX "InventoryVendor_organisationId_name_idx" ON "InventoryVendor"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMetaField_businessType_fieldKey_key" ON "InventoryMetaField"("businessType", "fieldKey");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_itemId_idx" ON "InventoryStockMovement"("itemId");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_batchId_idx" ON "InventoryStockMovement"("batchId");

-- CreateIndex
CREATE INDEX "BaseAvailability_userId_idx" ON "BaseAvailability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BaseAvailability_userId_organisationId_dayOfWeek_key" ON "BaseAvailability"("userId", "organisationId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAvailabilityOverride_userId_organisationId_weekStartD_key" ON "WeeklyAvailabilityOverride"("userId", "organisationId", "weekStartDate");

-- CreateIndex
CREATE INDEX "ObservationToolSubmission_toolId_idx" ON "ObservationToolSubmission"("toolId");

-- CreateIndex
CREATE INDEX "ObservationToolSubmission_taskId_idx" ON "ObservationToolSubmission"("taskId");

-- CreateIndex
CREATE INDEX "ObservationToolSubmission_companionId_idx" ON "ObservationToolSubmission"("companionId");

-- CreateIndex
CREATE INDEX "Occupancy_userId_startTime_endTime_idx" ON "Occupancy"("userId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Occupancy_userId_organisationId_startTime_idx" ON "Occupancy"("userId", "organisationId", "startTime");

-- CreateIndex
CREATE INDEX "AdverseEventReport_organisationId_idx" ON "AdverseEventReport"("organisationId");

-- CreateIndex
CREATE INDEX "AdverseEventReport_status_idx" ON "AdverseEventReport"("status");

-- CreateIndex
CREATE INDEX "Speciality_organisationId_idx" ON "Speciality"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_deviceToken_key" ON "DeviceToken"("deviceToken");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Invoice_parentId_idx" ON "Invoice"("parentId");

-- CreateIndex
CREATE INDEX "Invoice_organisationId_idx" ON "Invoice"("organisationId");

-- CreateIndex
CREATE INDEX "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_stripePaymentIntentId_idx" ON "Invoice"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_stripeCheckoutSessionId_idx" ON "Invoice"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Invoice_paymentCollectionMethod_idx" ON "Invoice"("paymentCollectionMethod");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAttachment" ADD CONSTRAINT "DocumentAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanionOrganisation" ADD CONSTRAINT "CompanionOrganisation_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentCompanion" ADD CONSTRAINT "ParentCompanion_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "Companion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAddress" ADD CONSTRAINT "ParentAddress_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAddress" ADD CONSTRAINT "OrganizationAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileAddress" ADD CONSTRAINT "UserProfileAddress_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
