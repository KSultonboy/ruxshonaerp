declare module "jsbarcode" {
  type BarcodeTarget = SVGElement | HTMLCanvasElement | string;

  type BarcodeOptions = {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    margin?: number;
  };

  function JsBarcode(
    element: BarcodeTarget,
    text: string,
    options?: BarcodeOptions
  ): void;

  export default JsBarcode;
}
