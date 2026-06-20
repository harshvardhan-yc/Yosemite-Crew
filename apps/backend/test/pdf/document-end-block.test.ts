import PDFDocument from "pdfkit";
import { clinicalPdfTheme } from "@yosemite-crew/lib";
import { PdfContext } from "../../../../packages/lib/src/pdf/PdfContext";
import { renderDocumentEndBlock } from "../../../../packages/lib/src/pdf/sections/DocumentEndBlock";

describe("renderDocumentEndBlock", () => {
  const createContext = () => {
    const document = new PDFDocument({
      size: [595, 842],
      margin: 0,
      autoFirstPage: true,
      bufferPages: true,
    });

    return new PdfContext({
      document,
      organization: {
        name: "MediCare Hospital",
        addressLine1: "123 Clinic Road",
      },
      theme: clinicalPdfTheme,
    });
  };

  it("returns placement anchored to the signature row instead of the full block top", () => {
    const ctx = createContext();
    ctx.cursorY = 517;

    const placement = renderDocumentEndBlock(ctx, {
      printedBy: "Dr. Jane Doe",
      signature: {
        status: "PENDING",
      },
    });

    expect(placement).toEqual({
      pageNumber: 1,
      pageX: 355,
      pageY: 553,
      width: 220,
      height: 64,
    });
  });
});
