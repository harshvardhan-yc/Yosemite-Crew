import {
  FhirSupportTicket,
  CreateSupportTicket,
  TicketStatus,
} from "@yosemite-crew/types";

/* -------------------------
   Mapping Helpers
------------------------- */
function mapStatusToFhir(status?: TicketStatus): FhirSupportTicket["status"] {
  switch (status) {
    case "New Ticket":
      return "requested";
    case "In Progress":
      return "in-progress";
    case "Waiting":
      return "on-hold";
    case "Closed":
      return "completed";
    case "Escalated":
    case "Reopened":
      return "in-progress";
    default:
      return "requested";
  }
}

function reverseMapStatus(status: FhirSupportTicket["status"]): TicketStatus {
  switch (status) {
    case "in-progress":
      return "In Progress";
    case "on-hold":
      return "Waiting";
    case "completed":
      return "Closed";
    case "cancelled":
    case "rejected":
      return "Closed";
    default:
      return "New Ticket";
  }
}

function mapPriorityToFhir(
  priority?: "Low" | "Medium" | "High" | "Critical"
): FhirSupportTicket["priority"] {
  switch (priority) {
    case "Low":
      return "routine";
    case "Medium":
      return "urgent";
    case "High":
      return "asap";
    case "Critical":
      return "stat";
    default:
      return "routine";
  }
}

function reverseMapPriority(
  priority?: FhirSupportTicket["priority"]
): "Low" | "Medium" | "High" | "Critical" {
  switch (priority) {
    case "urgent":
      return "Medium";
    case "asap":
      return "High";
    case "stat":
      return "Critical";
    default:
      return "Low";
  }
}

/* -------------------------
   Converters
------------------------- */
export function toFhirSupportTicket(
  ticket: CreateSupportTicket
): FhirSupportTicket {
  return {
    resourceType: "request-support",
    id: ticket.ticketId,
    status: mapStatusToFhir(ticket.status),
    intent: "order",
    priority: mapPriorityToFhir(ticket.priority),
    code: {
      coding: [
        {
          system: "http://example.com/ticket-category",
          code: ticket.category,
          display: ticket.category,
        },
      ],
      text: ticket.category,
    },
    description: ticket.message,
    authoredOn: new Date().toISOString(),
    for: {
      display: ticket.fullName,
      reference: `mailto:${ticket.emailAddress}`,
    },
    requester: {
      display: ticket.createdBy,
    },
    note: ticket.notes?.map((n) => ({ text: n })),
    input: ticket.attachments?.map((url) => ({
      type: { text: "Attachment" },
      valueAttachment: { url },
    })),
  };
}
