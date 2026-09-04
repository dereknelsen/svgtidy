import { describe, expect, it } from "vitest";
import {
  encodeSvgForUri,
  toBase64,
  toCssUrl,
  toDataUri,
  toJsx,
} from "./export";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>';

describe("toDataUri", () => {
  it("flips attribute quotes to single so a double-quoted url() needs no escapes", () => {
    const uri = toDataUri(SVG);
    expect(uri).toBe(
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'/%3E",
    );
    expect(uri).not.toContain('"');
  });

  it("keeps double quotes and encodes singles when wrapping in single quotes", () => {
    const uri = toDataUri(SVG, { quotes: "single" });
    expect(uri).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(uri).not.toContain("'");
  });

  it("percent-encodes the wrapper quote when the markup uses both kinds", () => {
    const both = `<svg xmlns="http://www.w3.org/2000/svg"><text style="font-family:'Foo'">it's</text></svg>`;
    const uri = encodeSvgForUri(both, "double");
    expect(uri).not.toContain('"');
    expect(uri).toContain("%22http://www.w3.org/2000/svg%22");
    expect(uri).toContain("'Foo'");
  });

  it("encodes # so hex colors don't start a URL fragment", () => {
    expect(toDataUri('<svg fill="#1a1a1a"/>')).toContain("fill='%231a1a1a'");
  });

  it("collapses whitespace between tags and newlines", () => {
    const pretty = `<svg>\n  <path d="M0 0"/>\n  <path d="M1 1"/>\n</svg>`;
    expect(encodeSvgForUri(pretty)).toBe(
      "%3Csvg%3E%3Cpath d='M0 0'/%3E%3Cpath d='M1 1'/%3E%3C/svg%3E",
    );
  });

  it("emits base64 when asked, surviving non-Latin-1 text", () => {
    const uri = toDataUri("<svg>é</svg>", { encoding: "base64" });
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const body = uri.slice("data:image/svg+xml;base64,".length);
    expect(
      new TextDecoder().decode(
        Uint8Array.from(atob(body), (c) => c.charCodeAt(0)),
      ),
    ).toBe("<svg>é</svg>");
  });
});

describe("toBase64", () => {
  it("round-trips ASCII", () => {
    expect(toBase64("<svg/>")).toBe(btoa("<svg/>"));
  });
});

describe("toCssUrl", () => {
  it("wraps the URI in url() with the matching quote", () => {
    expect(toCssUrl("<svg/>")).toBe('url("data:image/svg+xml,%3Csvg/%3E")');
    expect(toCssUrl("<svg/>", { quotes: "single" })).toBe(
      "url('data:image/svg+xml,%3Csvg/%3E')",
    );
  });
});

describe("toJsx", () => {
  it("camelizes kebab-case and namespaced attributes", () => {
    expect(
      toJsx('<path fill-rule="evenodd" stroke-width="2" xlink:href="#a"/>'),
    ).toBe('<path fillRule="evenodd" strokeWidth="2" xlinkHref="#a"/>');
  });

  it("renames class to className and keeps data-/aria- attributes", () => {
    expect(toJsx('<svg class="icon" data-name="x" aria-hidden="true"/>')).toBe(
      '<svg className="icon" data-name="x" aria-hidden="true"/>',
    );
  });

  it("converts style strings to JSX style objects", () => {
    expect(toJsx('<rect style="fill:red;stroke-width:2"/>')).toBe(
      '<rect style={{ fill: "red", strokeWidth: "2" }}/>',
    );
  });

  it("leaves plain attributes and content untouched", () => {
    const svg = '<svg viewBox="0 0 24 24"><title>hi</title></svg>';
    expect(toJsx(svg)).toBe(svg);
  });
});
