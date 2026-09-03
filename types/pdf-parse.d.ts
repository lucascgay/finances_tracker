// Ambient types for pdf-parse's internal extractor, which is not covered by
// @types/pdf-parse (that only types the package root). We import the internal
// module directly to dodge its broken debug-mode wrapper.
declare module "pdf-parse/lib/pdf-parse.js" {
  namespace PdfParse {
    type Version =
      | "default"
      | "v1.9.426"
      | "v1.10.88"
      | "v1.10.100"
      | "v2.0.550";
    interface Result {
      numpages: number;
      numrender: number;
      info: unknown;
      metadata: unknown;
      version: Version;
      text: string;
    }
    interface Options {
      pagerender?: (pageData: unknown) => string | Promise<string>;
      max?: number;
      version?: Version;
    }
  }

  declare function PdfParse(
    dataBuffer: Buffer,
    options?: PdfParse.Options
  ): Promise<PdfParse.Result>;

  export = PdfParse;
}
