import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/shared/ui/button";

describe("Button", () => {
  it("renders its children as a button element", () => {
    render(<Button>로그인</Button>);

    const button = screen.getByRole("button", { name: "로그인" });
    expect(button).toBeInTheDocument();
  });
});
