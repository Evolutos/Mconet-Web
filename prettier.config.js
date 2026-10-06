// Copyright © 2026 Mcont.

/**
 * Repository-wide deterministic formatting policy.
 *
 * @satisfies {import("prettier").Config}
 */
const prettierConfig = {
  endOfLine: "lf",
  printWidth: 100,
  proseWrap: "preserve",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
};

export default prettierConfig;
