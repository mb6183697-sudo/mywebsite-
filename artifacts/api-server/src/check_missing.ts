(async () => {
  const { default: yf } = await import("./lib/stocks.js").then(() => import("yahoo-finance2"));
  console.log("test");
})();
