import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Registry 安装的源码由上游项目统一校验；宿主只 lint 接入代码，
    // 避免 Next 16 的 React Compiler 规则误报上游保留实现。
    "src/components/xlt-agent/**",
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
