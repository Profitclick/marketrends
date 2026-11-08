import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeImageUrl } from "./image-url.ts";

Deno.test("RSS image URL decodes TU and Digi hexadecimal separators", () => {
  assertEquals(normalizeImageUrl('https:&#x2F;&#x2F;image.tu.no&#x2F;7141789.webp?imageId&#x3D;7141789&amp;width&#x3D;1920'),
    'https://image.tu.no/7141789.webp?imageId=7141789&width=1920');
});
Deno.test("RSS image URL decodes CoinDesk query parameters", () => {
  assertEquals(normalizeImageUrl('https://cdn.sanity.io/photo.jpg?fm=jpg&amp;w=1920&amp;h=1080'),
    'https://cdn.sanity.io/photo.jpg?fm=jpg&w=1920&h=1080');
});
Deno.test("RSS image URL preserves signed and percent-encoded parameters", () => {
  const url = 'https://example.com/photo.jpg?token=a%2Fb%3D%3D&width=1920';
  assertEquals(normalizeImageUrl(url), url);
  assertEquals(normalizeImageUrl(normalizeImageUrl(url)), url);
});
Deno.test("RSS image URL handles nested and decimal entities", () => {
  assertEquals(normalizeImageUrl('https:&#47;&#47;example.com/image.jpg?a=1&amp;amp;b=2'),
    'https://example.com/image.jpg?a=1&b=2');
});
Deno.test("RSS image URL rejects missing, malformed and non-web URLs", () => {
  for (const url of [null, undefined, '', '/image.jpg', 'javascript:alert(1)', 'data:image/png;base64,abc']) {
    assertEquals(normalizeImageUrl(url), null);
  }
});