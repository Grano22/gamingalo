// Sends /api to the web services during development, so the browser sees one origin.
export default {
  '/api': {
    target: `http://127.0.0.1:${process.env.API_PORT ?? 3000}`,
    pathRewrite: { '^/api': '' },
  },
};
