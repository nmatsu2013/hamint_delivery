import { app } from '../src/server/runtime.js';

export default {
  fetch(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    const apiPath = url.searchParams.get('__path');

    if (apiPath !== null) {
      url.pathname = `/api/${apiPath}`;
      url.searchParams.delete('__path');
      request = new Request(url, request);
    }

    return app.fetch(request);
  },
};
