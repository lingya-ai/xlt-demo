import path from "node:path";

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [path.resolve(
      process.cwd(),
      "src/components/xlt-agent/styles/postcss-chromium102.cjs",
    )]: {},
  },
};

export default config;
