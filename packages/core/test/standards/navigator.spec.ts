import { Navigator } from "@d1testflare/core";
import test from "ava";

test("Navigator: userAgent is Cloudflare-Workers", (t) => {
  const navigator = new Navigator();
  t.is(navigator.userAgent, "Cloudflare-Workers");
});
