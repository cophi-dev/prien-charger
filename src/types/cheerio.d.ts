declare module 'cheerio' {
  export interface CheerioElement {
    type: string;
    name: string;
    attribs: { [key: string]: string };
    children: CheerioElement[];
    parent: CheerioElement | null;
  }

  export interface CheerioAPI {
    (selector: string): Cheerio;
    load(html: string): CheerioAPI;
  }

  export interface Cheerio {
    length: number;
    each(callback: (index: number, element: CheerioElement) => void): Cheerio;
    text(): string;
    attr(name: string): string | undefined;
  }
} 