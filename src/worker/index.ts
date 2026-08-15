/**
 * The whole app is client-side. The worker exists only to serve the build and
 * to make it explicit that /api/* is not a thing here: no statement is ever
 * transmitted, so there is nothing for a server to receive.
 */

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return new Response("This app has no API. Nothing is sent anywhere.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
