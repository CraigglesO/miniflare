import { Response } from "@d1testflare/core";
import { HTMLRewriter, HTMLRewriterPlugin } from "@d1testflare/html-rewriter";
import { Compatibility, NoOpLog, PluginContext } from "@d1testflare/shared";
import test from "ava";
import type { ElementHandlers } from "html-rewriter-wasm";

const log = new NoOpLog();
const compat = new Compatibility();
const rootPath = process.cwd();
const ctx: PluginContext = { log, compat, rootPath };

test("HTMLRewriterPlugin: setup: includes HTMLRewriter in globals", (t) => {
  const plugin = new HTMLRewriterPlugin(ctx);
  const result = plugin.setup();
  t.is(result.globals?.HTMLRewriter, HTMLRewriter);
});

test("HTMLRewriterPlugin: setup: treats esi tags as void only if compatibility flag enabled", async (t) => {
  const handlers: ElementHandlers = {
    element(element) {
      element.replace("replacement");
    },
  };
  const input = '<span><esi:include src="a" /> text<span>';

  // Check with flag disabled
  let plugin = new HTMLRewriterPlugin(ctx);
  let result = plugin.setup();
  let impl: typeof HTMLRewriter = result.globals?.HTMLRewriter;
  let res = new impl()
    .on("esi\\:include", handlers)
    .transform(new Response(input));
  t.is(await res.text(), "<span>replacement");

  // Check with flag enabled
  const compat = new Compatibility(undefined, [
    "html_rewriter_treats_esi_include_as_void_tag",
  ]);
  plugin = new HTMLRewriterPlugin({ ...ctx, compat });
  result = plugin.setup();
  impl = result.globals?.HTMLRewriter;
  res = new impl().on("esi\\:include", handlers).transform(new Response(input));
  t.is(await res.text(), "<span>replacement text<span>");
});
