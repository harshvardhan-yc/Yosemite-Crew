export const createDocumentReference = ({
  resourceType = 'DocumentReference',
  typeText,
  description,
  date,
  contextPeriodEnd,
  patientId,
  folderId,
}) => {
  return {
    resourceType,
    type: {text: typeText || '', reference: folderId},
    author: {
      display: 'petOwner',
    },
    description,
    date,
    context: {
      period: {
        end: contextPeriodEnd,
      },
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
};
