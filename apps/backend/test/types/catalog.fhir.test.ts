import {
  CATALOG_CODE_SYSTEM,
  CATALOG_HEALTHCARE_SERVICE_PROFILE,
  fromCatalogRequestDTO,
  toCatalogBundleResponseDTO,
  toCatalogResponseDTO,
} from "@yosemite-crew/types";

describe("Catalog FHIR DTOs", () => {
  it("parses a HealthcareService resource into catalog input", () => {
    const input = fromCatalogRequestDTO({
      resourceType: "HealthcareService",
      id: "prod_consult",
      active: true,
      providedBy: {
        reference: "Organization/org_1",
      },
      name: "General Consultation",
      comment: "Consult desc",
      specialty: [
        {
          coding: [
            {
              system: "https://yosemite.health/fhir/CodeSystem/specialities",
              code: "spec_1",
            },
          ],
        },
      ],
      extension: [
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-product-kind",
          valueString: "CONSULTATION",
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-code",
          valueString: "CS-001",
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-unit-price",
          valueDecimal: 100,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-default-discount-percent",
          valueDecimal: 10,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-max-discount-percent",
          valueDecimal: 15,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-duration-minutes",
          valueInteger: 30,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-outpatient",
          valueBoolean: true,
        },
        {
          url: "https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-inpatient",
          valueBoolean: false,
        },
      ],
    });

    expect(input).toEqual({
      organisationId: "org_1",
      name: "General Consultation",
      description: "Consult desc",
      code: "CS-001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: null,
      isActive: true,
      price: {
        unitPrice: 100,
        defaultDiscountPercent: 10,
        maxDiscountPercent: 15,
      },
      bookable: {
        id: "",
        productItemId: "prod_consult",
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      packageItems: null,
    });
  });

  it("serializes catalog products into HealthcareService and Bundle", () => {
    const resource = toCatalogResponseDTO({
      id: "prod_consult",
      organisationId: "org_1",
      name: "General Consultation",
      description: "Consult desc",
      code: "CS-001",
      kind: "CONSULTATION",
      specialityId: "spec_1",
      legacyServiceId: "svc_1",
      isActive: true,
      defaultPrice: {
        unitPrice: 100,
        defaultDiscountPercent: 10,
        maxDiscountPercent: 15,
      },
      bookable: {
        durationMinutes: 30,
        supportsOutpatient: true,
        supportsInpatient: false,
      },
      packageItems: [],
    });

    expect(resource.resourceType).toBe("HealthcareService");
    expect(resource.id).toBe("prod_consult");
    expect(resource.providedBy?.reference).toBe("Organization/org_1");
    expect(resource.meta?.profile).toEqual([
      CATALOG_HEALTHCARE_SERVICE_PROFILE,
    ]);
    expect(resource.identifier).toEqual([
      {
        system: CATALOG_CODE_SYSTEM,
        value: "CS-001",
      },
    ]);

    const bundle = toCatalogBundleResponseDTO(
      [
        {
          id: "prod_consult",
          organisationId: "org_1",
          name: "General Consultation",
          description: "Consult desc",
          code: "CS-001",
          kind: "CONSULTATION",
          specialityId: "spec_1",
          legacyServiceId: null,
          isActive: true,
          defaultPrice: {
            unitPrice: 100,
          },
          bookable: null,
          packageItems: [],
        },
      ],
      {
        baseUrl: "/fhir/v1/healthcare-service",
        searchMode: "match",
      },
    );

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("searchset");
    expect(bundle.total).toBe(1);
    expect(bundle.entry?.[0]?.resource?.resourceType).toBe("HealthcareService");
    expect(bundle.entry?.[0]?.fullUrl).toBe(
      "/fhir/v1/healthcare-service/prod_consult",
    );
    expect(bundle.entry?.[0]?.search?.mode).toBe("match");
  });
});
